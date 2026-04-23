/**
 * F3-E1: Pipeline orchestrator — five-stage generation pipeline.
 *
 * Sequentially runs:
 *   Stage 1 (Vision):     Gemini 1.5 Pro multimodal image analysis   — F3-E2
 *   Stage 2 (Grounding):  USDA RAG nutritional grounding              — F3-E3
 *   Stage 3 (Script):     Gemini 1.5 Pro persona script generation    — F3-E4
 *   Stage 4 (TTS):        ElevenLabs eleven_turbo_v2_5 synthesis      — F3-E5
 *   Stage 5 (Upload):     Supabase Storage MP3 upload                 — F3-E5
 *
 * Design:
 *   - p-queue (concurrency=1) gates the whole pipeline — one pod at a time.
 *   - Each stage is retried up to 2x with exponential backoff (2 s, 8 s).
 *   - Per-stage status is written to pods.stage_status JSONB.
 *   - On exhausted retries: pod.status = 'failed'.
 *   - On all stages complete: pod.status = 'ready' (set by uploadStage internally).
 *
 * Wire-up:
 *   POST /api/pods/:id/complete already calls
 *     `void runPipeline(podId).catch(err => fastify.log.error(...))`
 */

import PQueue from 'p-queue';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { visionStage } from './stages/visionStage.js';
import { runGroundingStage } from './groundingStage.js';
import { scriptStage } from './scriptStage.js';
import { extractTranscriptText, ttsStage } from './stages/ttsStage.js';
import { uploadStage } from './stages/uploadStage.js';

// ── Global queue — concurrency=1: one pod processed at a time ─────────────────

export const pipelineQueue = new PQueue({ concurrency: 1 });

// ── Types ─────────────────────────────────────────────────────────────────────

type StageName = 'vision' | 'grounding' | 'script' | 'tts' | 'upload';
type StageStatusValue = 'pending' | 'running' | 'complete' | 'failed';

interface StageEntry {
  status: StageStatusValue;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ── Retry helper ──────────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [2_000, 8_000] as const;
const MAX_RETRIES = 2;

/**
 * Execute `fn` up to MAX_RETRIES + 1 times with exponential backoff.
 * On each failure (except the last) waits BACKOFF_DELAYS_MS[attempt - 1].
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BACKOFF_DELAYS_MS[attempt - 1] ?? 8_000;
      await sleep(delay);
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function updateStageStatus(
  podId: string,
  stage: StageName,
  entry: StageEntry,
): Promise<void> {
  await db.execute(
    sql`UPDATE pods
        SET stage_status = jsonb_set(
          COALESCE(stage_status, '{}'::jsonb),
          ${JSON.stringify([stage])}::text[],
          ${JSON.stringify(entry)}::jsonb
        )
        WHERE id = ${podId}::uuid`,
  );
}

export async function markPodFailed(
  podId: string,
  stage: StageName,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await updateStageStatus(podId, stage, {
    status: 'failed',
    error: message,
    completedAt: new Date().toISOString(),
  });
  await db.execute(
    sql`UPDATE pods
        SET status = 'failed'
        WHERE id = ${podId}::uuid`,
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Enqueue and run the five-stage pipeline for a given pod.
 *
 * Called fire-and-forget from POST /api/pods/:id/complete:
 *   `void runPipeline(podId).catch(err => fastify.log.error({ err, podId }, 'pipeline failed'))`
 *
 * The global p-queue ensures only one pod is processed at a time (concurrency=1).
 */
export function runPipeline(podId: string): Promise<void> {
  return pipelineQueue.add(() => _executePipeline(podId)) as Promise<void>;
}

async function _executePipeline(podId: string): Promise<void> {
  // ── Stage 1: Vision ──────────────────────────────────────────────────────────
  // visionStage manages its own stage_status writes (running → complete/failed).
  // The orchestrator wraps in retry; on exhaustion marks pod failed.
  try {
    await withRetry(() => visionStage(podId));
  } catch (err) {
    await markPodFailed(podId, 'vision', err);
    return;
  }

  // ── Stage 2: Grounding ───────────────────────────────────────────────────────
  // runGroundingStage manages its own stage_status writes.
  try {
    await withRetry(() => runGroundingStage(podId));
  } catch (err) {
    await markPodFailed(podId, 'grounding', err);
    return;
  }

  // ── Stage 3: Script ──────────────────────────────────────────────────────────
  // scriptStage manages its own stage_status and returns TranscriptJson.
  // We pass the transcript segments directly to ttsStage (avoid re-reading DB).
  let transcriptText: string;
  try {
    const transcript = await withRetry(() => scriptStage(podId));
    transcriptText = extractTranscriptText(transcript.segments);
  } catch (err) {
    await markPodFailed(podId, 'script', err);
    return;
  }

  // ── Stage 4: TTS ─────────────────────────────────────────────────────────────
  // ttsStage does not write stage_status — orchestrator manages it.
  await updateStageStatus(podId, 'tts', {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  let mp3Path: string;
  let voiceId: string;
  try {
    const ttsResult = await withRetry(() => ttsStage({ podId, text: transcriptText }));
    mp3Path = ttsResult.mp3Path;
    voiceId = ttsResult.voiceId;
  } catch (err) {
    await markPodFailed(podId, 'tts', err);
    return;
  }

  await updateStageStatus(podId, 'tts', {
    status: 'complete',
    completedAt: new Date().toISOString(),
  });

  // ── Stage 5: Upload ──────────────────────────────────────────────────────────
  // uploadStage sets pod.status='ready' internally on success.
  await updateStageStatus(podId, 'upload', {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  try {
    await withRetry(() => uploadStage({ podId, mp3Path, voiceId }));
  } catch (err) {
    await markPodFailed(podId, 'upload', err);
    return;
  }

  await updateStageStatus(podId, 'upload', {
    status: 'complete',
    completedAt: new Date().toISOString(),
  });

  // pod.status = 'ready' is set by uploadStage — pipeline complete.
}
