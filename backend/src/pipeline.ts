import { db } from "./db.js";

/**
 * E1 STUB — E2 will replace the body of this function.
 *
 * Signature must remain:
 *   runPipeline(podId: string): Promise<void>
 *
 * E2 will:
 *   1. Read all meal_images for the pod
 *   2. Call Gemini 1.5 Pro (one call, all images) → { title, summaryText, scriptText }
 *   3. Call ElevenLabs Sarah voice → audio file
 *   4. Insert into episodes, set pod.status = 'ready'
 *
 * On error (after 1 retry): set pod.status = 'error' with reason — don't crash service.
 */
export async function runPipeline(podId: string): Promise<void> {
  // E2 will run here
  console.log(`[pipeline] E2 will run here — podId=${podId}`);

  // Stub: wait 2s then mark error (E2 not implemented yet)
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  db.run("UPDATE pods SET status = 'error' WHERE id = ?", [podId]);

  console.log(`[pipeline] Stub complete — pod ${podId} set to error (E2 not implemented)`);
}
