/**
 * Pipeline orchestrator — F3 generation pipeline.
 *
 * runPipeline is called fire-and-forget from POST /api/pods/:id/complete.
 * It is exported so tests can spy on it.
 *
 * Stages:
 *   1. Vision (Gemini 1.5 Pro) — F3-E2
 *   2–5. Grounding / Script / TTS / Upload — stub (sibling executables)
 */

import { visionStage } from './stages/visionStage.js';

export async function runPipeline(podId: string): Promise<void> {
  await visionStage(podId);
  // Stages 2–5 (grounding, script, tts, upload) — implemented in sibling executables
}

