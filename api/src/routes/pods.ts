import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { supabaseAdmin } from '../db/supabase.js';
import { runPipeline } from '../pipeline/run.js';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Pod row shape returned by DB queries (Drizzle snake_case → camelCase mapping
 * happens at the route boundary before sending the response).
 */
interface PodRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  status: string;
  timespan_days: number;
  meals_count: number;
  grounded_facts: unknown | null;
  stage_status: unknown;
  created_at: string;
  completed_at: string | null;
}

interface MealRow extends Record<string, unknown> {
  id: string;
  pod_id: string;
  status: string;
  image_url: string | null;
  captured_at: string | null;
  created_at: string;
}

interface MealCountRow extends Record<string, unknown> {
  count: string;
}

interface PodcastRow extends Record<string, unknown> {
  id: string;
  pod_id: string;
  transcript_json: unknown;
  mp3_storage_path: string | null;
  duration_seconds: string | null;
}

const STAGE_STATUS_INITIAL = {
  vision: { status: 'pending' },
  grounding: { status: 'pending' },
  script: { status: 'pending' },
  tts: { status: 'pending' },
  upload: { status: 'pending' },
};

/**
 * Map a DB PodRow (snake_case) → camelCase Pod response object.
 * Matches the mobile `Pod` type from src/modules/food/types.ts.
 */
function mapPod(
  row: PodRow,
  mealsList: MealRow[],
): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    timespanDays: row.timespan_days,
    mealsCount: row.meals_count,
    stageStatus: row.stage_status ?? {},
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    groundedFacts: row.grounded_facts ?? undefined,
    mealsList: mealsList.map((m) => ({
      id: m.id,
      podId: m.pod_id,
      status: m.status,
      imageUrl: m.image_url ?? undefined,
      capturedAt: m.captured_at ?? undefined,
    })),
  };
}

/**
 * Pod routes:
 *
 * POST /api/pods              — create a new pod (F2-E2)
 * GET  /api/pods/:id          — fetch pod with meals (F2-E2)
 * POST /api/pods/:id/complete — transition to generating, enqueue pipeline (F2-E4)
 * GET  /api/pods/:id/podcast  — return transcript + signed audio URL (F2-E4)
 */
export async function podRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /api/pods ──────────────────────────────────────────────────────────
  fastify.post('/api/pods', async (request, reply) => {
    const userId = request.user.id;

    const rows = await db.execute<PodRow>(
      sql`
        INSERT INTO pods (user_id, status, timespan_days, meals_count, stage_status)
        VALUES (${userId}, 'draft', 10, 0, '{}'::jsonb)
        RETURNING id, user_id, status, timespan_days, meals_count,
                  grounded_facts, stage_status, created_at, completed_at
      `,
    );

    const pod = rows[0] as PodRow | undefined;

    if (!pod) {
      return reply.status(500).send({
        error: 'internal_error',
        code: 'POD_INSERT_FAILED',
      });
    }

    return reply.status(201).send(mapPod(pod, []));
  });

  // ── GET /api/pods/:id ───────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/pods/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    // Fetch pod with user_id scope check in one query
    const podRows = await db.execute<PodRow>(
      sql`
        SELECT id, user_id, status, timespan_days, meals_count,
               grounded_facts, stage_status, created_at, completed_at
        FROM pods
        WHERE id = ${id}::uuid
          AND user_id = ${userId}
        LIMIT 1
      `,
    );

    const pod = podRows[0] as PodRow | undefined;

    if (!pod) {
      return reply.status(404).send({
        error: 'not_found',
        code: 'POD_NOT_FOUND',
      });
    }

    // Fetch meals ordered by captured_at ASC, falling back to created_at ASC
    const mealRows = await db.execute<MealRow>(
      sql`
        SELECT id, pod_id, status, image_url, captured_at, created_at
        FROM meals
        WHERE pod_id = ${id}::uuid
        ORDER BY COALESCE(captured_at, created_at) ASC
      `,
    );

    return reply.status(200).send(mapPod(pod, mealRows as MealRow[]));
  });

  // ── POST /api/pods/:id/complete ─────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/api/pods/:id/complete',
    async (request, reply) => {
      const { id: podId } = request.params;
      const userId = request.user.id;

      // 1. Fetch pod — 404 if missing or not owned by user
      const podRows = await db.execute<PodRow>(
        sql`SELECT id, user_id, status, stage_status, completed_at
            FROM pods
            WHERE id = ${podId}
            LIMIT 1`,
      );

      const pod = podRows[0];
      if (!pod || pod.user_id !== userId) {
        return reply.status(404).send({
          error: 'pod_not_found',
          code: 'POD_NOT_FOUND',
        });
      }

      // 2. Check for >= 1 uploaded meal
      const mealCountRows = await db.execute<MealCountRow>(
        sql`SELECT COUNT(*) AS count
            FROM meals
            WHERE pod_id = ${podId}
              AND status = 'uploaded'`,
      );

      const uploadedCount = parseInt(mealCountRows[0]?.count ?? '0', 10);
      if (uploadedCount < 1) {
        return reply.status(400).send({
          error: 'no_meals',
          code: 'POD_EMPTY',
        });
      }

      // 3. Transition pod to 'generating' + initialise stage_status
      await db.execute(
        sql`UPDATE pods
            SET status        = 'generating',
                stage_status  = ${JSON.stringify(STAGE_STATUS_INITIAL)}::jsonb,
                completed_at  = now()
            WHERE id = ${podId}`,
      );

      // 4. Fire-and-forget pipeline (stub; F3-E1 replaces)
      void runPipeline(podId).catch((err: unknown) =>
        fastify.log.error({ err, podId }, 'pipeline failed'),
      );

      return reply.status(202).send({
        id: podId,
        status: 'generating',
      });
    },
  );

  // ── GET /api/pods/:id/podcast ───────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/api/pods/:id/podcast',
    async (request, reply) => {
      const { id: podId } = request.params;
      const userId = request.user.id;

      // 1. Fetch pod — 404 if missing or not owned by user
      const podRows = await db.execute<PodRow>(
        sql`SELECT id, user_id, status
            FROM pods
            WHERE id = ${podId}
            LIMIT 1`,
      );

      const pod = podRows[0];
      if (!pod || pod.user_id !== userId) {
        return reply.status(404).send({
          error: 'pod_not_found',
          code: 'POD_NOT_FOUND',
        });
      }

      // 2. If not ready, return 404 (the resource doesn't exist yet)
      if (pod.status !== 'ready') {
        return reply.status(404).send({
          error: 'not_ready',
          code: 'PODCAST_NOT_READY',
        });
      }

      // 3. Fetch podcast row
      const podcastRows = await db.execute<PodcastRow>(
        sql`SELECT id, pod_id, transcript_json, mp3_storage_path, duration_seconds
            FROM podcasts
            WHERE pod_id = ${podId}
            LIMIT 1`,
      );

      const podcast = podcastRows[0];
      if (!podcast) {
        // Podcast row missing even though pod is ready — treat as not ready
        return reply.status(404).send({
          error: 'not_ready',
          code: 'PODCAST_NOT_READY',
        });
      }

      // 4. Generate 1-hour signed GET URL
      const storagePath = podcast.mp3_storage_path ?? `${podId}/podcast.mp3`;
      const { data: signedUrlData, error: storageError } =
        await supabaseAdmin.storage
          .from('pods')
          .createSignedUrl(storagePath, 3600);

      if (storageError || !signedUrlData?.signedUrl) {
        fastify.log.error(
          { err: storageError, podId },
          'Failed to generate signed URL for podcast',
        );
        return reply.status(500).send({
          error: 'storage_error',
          code: 'SIGNED_URL_FAILED',
        });
      }

      return reply.status(200).send({
        transcript: podcast.transcript_json,
        audioUrl: signedUrlData.signedUrl,
        durationSeconds: podcast.duration_seconds
          ? parseFloat(podcast.duration_seconds)
          : null,
      });
    },
  );
}
