/**
 * Pipeline orchestrator — F3 five-stage generation pipeline.
 *
 * Stage 1 (Vision):  Gemini 1.5 Pro image analysis — F3-E2
 * Stage 4 (TTS):     Call ElevenLabs to synthesize transcript audio — F3-E5
 * Stage 5 (Upload):  Upload MP3 to Supabase Storage; mark pod ready — F3-E5
 *
 * runPipeline is called fire-and-forget from POST /api/pods/:id/complete.
 * It is exported so tests can spy on it.
 *
 * Per-stage status is written to pods.stage_status JSONB after each stage
 * transition (running → complete | failed).  On any failure the pod is
 * marked status='failed'.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { visionStage } from './stages/visionStage.js';
import { extractTranscriptText, ttsStage } from './stages/ttsStage.js';
import { uploadStage } from './stages/uploadStage.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type StageName = 'vision' | 'grounding' | 'script' | 'tts' | 'upload';
type StageStatusValue = 'pending' | 'running' | 'complete' | 'failed';

interface StageEntry {
  status: StageStatusValue;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface PodcastRow extends Record<string, unknown> {
  transcript_json: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function updateStageStatus(
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

async function markPodFailed(podId: string, stage: StageName, error: unknown): Promise<void> {
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

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runPipeline(podId: string): Promise<void> {
  // ── Stage 1: Vision (F3-E2) ─────────────────────────────────────────────────
  await visionStage(podId);

  // Stages 2–3 (grounding, script) — implemented in sibling executables

  // ── Stage 4: TTS ────────────────────────────────────────────────────────────

  // Mark stage 4 as running
  await updateStageStatus(podId, 'tts', {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  // Fetch transcript from podcasts table
  let transcriptText: string;
  try {
    const rows = await db.execute<PodcastRow>(
      sql`SELECT transcript_json FROM podcasts WHERE pod_id = ${podId}::uuid LIMIT 1`,
    );
    const podcast = rows[0] as PodcastRow | undefined;
    if (!podcast) {
      throw new Error('No podcast row found for pod — cannot synthesize TTS without transcript');
    }
    transcriptText = extractTranscriptText(podcast.transcript_json);
    if (!transcriptText) {
      throw new Error('transcript_json is empty or has no text segments');
    }
  } catch (err) {
    await markPodFailed(podId, 'tts', err);
    return;
  }

  let mp3Path: string;
  let voiceId: string;
  try {
    const ttsResult = await ttsStage({ podId, text: transcriptText });
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

  // ── Stage 5: Upload ─────────────────────────────────────────────────────────

  await updateStageStatus(podId, 'upload', {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  try {
    await uploadStage({ podId, mp3Path, voiceId });
  } catch (err) {
    await markPodFailed(podId, 'upload', err);
    return;
  }

  await updateStageStatus(podId, 'upload', {
    status: 'complete',
    completedAt: new Date().toISOString(),
  });
}

