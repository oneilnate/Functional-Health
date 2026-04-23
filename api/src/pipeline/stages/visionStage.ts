/**
 * Stage 1 — Gemini 1.5 Pro vision analysis
 *
 * For each meal in the pod with status='uploaded':
 *   1. Downloads image bytes from Supabase Storage
 *   2. Calls Gemini 1.5 Pro multimodal with the §7 prompt
 *   3. Writes result to meals.gemini_analysis JSONB
 *   4. Sets meal.status = 'analyzed'
 *
 * Processes meals in parallel (concurrency=4) via p-queue.
 * Retries failed Gemini calls with exponential backoff (max 2 retries).
 */

import PQueue from 'p-queue';
import { GoogleGenerativeAI, type InlineDataPart } from '@google/generative-ai';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { supabase } from '../../lib/supabase.js';
import { env } from '../../env.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  estimated_portion_g: number;
  portion_confidence: number;
}

export interface GeminiAnalysis {
  foods: FoodItem[];
  scene_description: string;
  overall_confidence: number;
}

interface MealRow {
  id: string;
  pod_id: string;
  image_url: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONCURRENCY = 4;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 2_000;
const MEALS_BUCKET = 'meals';

const VISION_PROMPT = `You are a clinical nutrition vision analyst. Analyse this meal photo and return ONLY valid JSON.

Return exactly this structure:
{
  "foods": [
    {
      "name": "<food name, e.g. grilled chicken breast>",
      "estimated_portion_g": <number in grams>,
      "portion_confidence": <0.0 to 1.0>
    }
  ],
  "scene_description": "<one sentence describing what you see in the image>",
  "overall_confidence": <0.0 to 1.0, your confidence in the overall analysis>
}

Rules:
- Include ALL visible food items. Each item is a separate entry in foods[].
- estimated_portion_g should be a reasonable gram estimate for the visible portion.
- If you cannot identify a food item, name it descriptively (e.g. "unknown brown sauce") and set portion_confidence to 0.3.
- overall_confidence reflects how clearly the food is visible and identifiable.
- No prose, no markdown fences, no explanation — output ONLY the JSON object.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download image bytes from Supabase Storage and return as base64.
 * image_url is stored as "meals/<podId>/<mealId>.jpg" (bucket-relative path).
 */
export async function downloadImageAsBase64(
  imageUrl: string,
): Promise<{ base64: string; mimeType: string }> {
  // imageUrl may be "meals/<path>" (with bucket prefix) or just "<path>"
  const storagePath = imageUrl.startsWith(`${MEALS_BUCKET}/`)
    ? imageUrl.slice(MEALS_BUCKET.length + 1)
    : imageUrl;

  const { data, error } = await supabase.storage
    .from(MEALS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Storage download failed for path "${storagePath}": ${
        error?.message ?? 'no data'
      }`,
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  // Detect mime type from path; default to jpeg
  const ext = storagePath.split('.').pop()?.toLowerCase();
  const mimeType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg';

  return { base64, mimeType };
}

/**
 * Call Gemini 1.5 Pro with the meal image and parse the structured response.
 * Retries up to MAX_RETRIES times with exponential backoff on failure.
 */
export async function analyseWithGemini(
  gemini: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: string,
): Promise<GeminiAnalysis> {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-pro' });

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(4, attempt - 1); // 2s, 8s
      await sleep(backoffMs);
    }

    try {
      const imagePart: InlineDataPart = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      };

      const result = await model.generateContent([VISION_PROMPT, imagePart]);
      const rawText = result.response.text().trim();

      // Strip markdown code fences if the model adds them
      const jsonText = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonText) as GeminiAnalysis;

      // Basic validation
      if (!Array.isArray(parsed.foods)) {
        throw new Error('Gemini response missing foods array');
      }
      if (typeof parsed.overall_confidence !== 'number') {
        throw new Error('Gemini response missing overall_confidence');
      }

      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('analyseWithGemini: all retries exhausted');
}

/**
 * Update a single meal's gemini_analysis and status in the DB.
 */
export async function saveMealAnalysis(
  mealId: string,
  analysis: GeminiAnalysis,
): Promise<void> {
  await db.execute(
    sql`UPDATE meals
        SET gemini_analysis  = ${JSON.stringify(analysis)}::jsonb,
            status           = 'analyzed',
            confidence_score = ${analysis.overall_confidence}
        WHERE id = ${mealId}`,
  );
}

/**
 * Update the pod's stage_status for the vision stage.
 */
export async function updatePodVisionStatus(
  podId: string,
  status: 'running' | 'complete' | 'failed',
  error?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    stage: 'vision',
    status,
    ...(status === 'running' && { startedAt: new Date().toISOString() }),
    ...(status !== 'running' && { completedAt: new Date().toISOString() }),
    ...(error !== undefined && { error }),
  };

  await db.execute(
    sql`UPDATE pods
        SET stage_status = stage_status || ${
          JSON.stringify({ vision: patch })
        }::jsonb
        WHERE id = ${podId}`,
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run Stage 1 (vision analysis) for all uploaded meals in the pod.
 *
 * Processes up to CONCURRENCY=4 meals in parallel.
 * On any individual meal failure, logs the error and continues (resilient per-meal).
 * If ALL meals fail, throws so the orchestrator can mark the pod failed.
 */
export async function visionStage(podId: string): Promise<void> {
  // 1. Fetch all uploaded meals for this pod
  const mealRows = await db.execute(
    sql`SELECT id, pod_id, image_url
        FROM meals
        WHERE pod_id = ${podId}
          AND status = 'uploaded'
          AND image_url IS NOT NULL`,
  );

  const meals = mealRows as unknown as MealRow[];

  if (meals.length === 0) {
    throw new Error(`visionStage: no uploaded meals found for pod ${podId}`);
  }

  // 2. Mark vision stage as running
  await updatePodVisionStatus(podId, 'running');

  const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const queue = new PQueue({ concurrency: CONCURRENCY });

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  // 3. Process meals in parallel via p-queue
  await queue.addAll(
    meals.map((meal) => async () => {
      try {
        const { base64, mimeType } = await downloadImageAsBase64(meal.image_url);
        const analysis = await analyseWithGemini(gemini, base64, mimeType);
        await saveMealAnalysis(meal.id, analysis);
        successCount++;
      } catch (err) {
        failureCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`meal ${meal.id}: ${msg}`);
        // Do NOT re-throw — continue processing remaining meals
      }
    }),
  );

  // 4. Handle outcomes
  if (successCount === 0) {
    const errorSummary = errors.slice(0, 3).join('; ');
    await updatePodVisionStatus(podId, 'failed', errorSummary);
    throw new Error(
      `visionStage: all ${meals.length} meals failed. Errors: ${errorSummary}`,
    );
  }

  // Partial success is acceptable — log failures but continue
  if (failureCount > 0) {
    console.warn(
      `[visionStage] pod ${podId}: ${failureCount}/${meals.length} meals failed analysis`,
    );
  }

  await updatePodVisionStatus(podId, 'complete');
}

