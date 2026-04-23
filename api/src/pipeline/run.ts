/**
 * Pipeline stub — F3-E1 will implement the real pipeline.
 *
 * runPipeline is called fire-and-forget from POST /api/pods/:id/complete.
 * It is exported so tests can spy on it.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runPipeline(_podId: string): Promise<void> {
  // stub — F3-E1 will implement: vision → grounding → script → tts → upload
}

