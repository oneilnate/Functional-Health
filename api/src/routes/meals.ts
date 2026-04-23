import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { supabase } from '../lib/supabase.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const UPLOAD_TTL_SECONDS = 120;
const MEALS_BUCKET = 'meals';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MealRow {
  id: string;
  pod_id: string;
  captured_at: string | null;
  image_url: string | null;
  gemini_analysis: unknown | null;
  usda_matched_foods: unknown | null;
  confidence_score: string | null;
  status: string;
  created_at: string;
}

interface PodRow {
  id: string;
  user_id: string;
}

/**
 * POST /api/pods/:podId/meals
 * - Validates pod exists and belongs to the authenticated user
 * - Creates a meal row with status='pending_upload'
 * - Returns a Supabase Storage presigned upload URL (2 min TTL)
 *
 * PATCH /api/meals/:id
 * - Validates meal exists and belongs to the authenticated user's pod
 * - Marks meal status='uploaded', sets image_url, sets captured_at if null
 * - Returns the full updated meal row
 */
export async function mealRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /api/pods/:podId/meals ──────────────────────────────────────────────
  fastify.post<{
    Params: { podId: string };
  }>('/api/pods/:podId/meals', async (request, reply) => {
    const { podId } = request.params;
    const userId = request.user.id;

    // 1. Validate pod exists and belongs to user
    const podRows = await db.execute(
      sql`SELECT id, user_id FROM pods WHERE id = ${podId} LIMIT 1`,
    );
    const pod = podRows[0] as unknown as PodRow | undefined;

    if (!pod || pod.user_id !== userId) {
      return reply.status(404).send({
        error: 'pod_not_found',
        code: 'POD_NOT_FOUND',
      });
    }

    // 2. Generate meal UUID and storage path
    const mealId = crypto.randomUUID();
    const storagePath = `${podId}/${mealId}.jpg`;

    // 3. Insert meal row with status='pending_upload'
    await db.execute(
      sql`INSERT INTO meals (id, pod_id, status, created_at)
          VALUES (${mealId}, ${podId}, 'pending_upload', now())`,
    );

    // 4. Generate presigned upload URL via Supabase Storage
    // Note: createSignedUploadUrl always uses a server-side 2-minute TTL;
    // there is no expiresIn option on this method (unlike createSignedUrl).
    const { data, error } = await supabase.storage
      .from(MEALS_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      fastify.log.error({ error, podId, mealId }, 'Failed to create signed upload URL');
      return reply.status(500).send({
        error: 'storage_error',
        code: 'STORAGE_UPLOAD_URL_FAILED',
      });
    }

    return reply.status(201).send({
      mealId,
      uploadUrl: data.signedUrl,
      storagePath: `${MEALS_BUCKET}/${storagePath}`,
      expiresIn: UPLOAD_TTL_SECONDS,
    });
  });

  // ── PATCH /api/meals/:id ─────────────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: { imageUrl?: string };
  }>('/api/meals/:id', async (request, reply) => {
    const { id: mealId } = request.params;
    const userId = request.user.id;
    const { imageUrl } = request.body ?? {};

    // 1. Load meal + its pod to verify ownership
    const mealRows = await db.execute(
      sql`SELECT m.id, m.pod_id, m.captured_at, m.image_url, m.status, m.created_at,
                 p.user_id
          FROM meals m
          JOIN pods p ON p.id = m.pod_id
          WHERE m.id = ${mealId}
          LIMIT 1`,
    );
    const mealWithPod = mealRows[0] as unknown as
      | (MealRow & { user_id: string })
      | undefined;

    if (!mealWithPod || mealWithPod.user_id !== userId) {
      return reply.status(404).send({
        error: 'meal_not_found',
        code: 'MEAL_NOT_FOUND',
      });
    }

    // 2. Derive image_url: use client-supplied value or construct from storage path
    const resolvedImageUrl =
      imageUrl ?? `${MEALS_BUCKET}/${mealWithPod.pod_id}/${mealId}.jpg`;

    // 3. Update meal: status='uploaded', image_url, captured_at (if null)
    const updated = await db.execute(
      sql`UPDATE meals
          SET status      = 'uploaded',
              image_url   = ${resolvedImageUrl},
              captured_at = COALESCE(captured_at, now())
          WHERE id = ${mealId}
          RETURNING id, pod_id, captured_at, image_url, gemini_analysis,
                    usda_matched_foods, confidence_score, status, created_at`,
    );

    const meal = updated[0] as unknown as MealRow | undefined;

    if (!meal) {
      // Should never happen — we already confirmed the row exists
      return reply.status(500).send({
        error: 'update_failed',
        code: 'MEAL_UPDATE_FAILED',
      });
    }

    return reply.status(200).send(meal);
  });
}

