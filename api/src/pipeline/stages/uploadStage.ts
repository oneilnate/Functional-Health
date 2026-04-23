import fsPromises from 'node:fs/promises';
import { parseBuffer } from 'music-metadata';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { supabaseAdmin } from '../../db/supabase.js';

/**
 * Stage 5 — Supabase MP3 Upload
 *
 * Uploads the MP3 produced by Stage 4 to Supabase Storage at
 * pods/{podId}/podcast.mp3, extracts duration via music-metadata,
 * updates podcasts.mp3_storage_path, podcasts.duration_seconds,
 * podcasts.voice_id, and sets pods.status = 'ready'.
 */

export interface UploadStageInput {
  podId: string;
  /** Absolute path to the MP3 file written by ttsStage */
  mp3Path: string;
  /** Voice ID that was used for synthesis */
  voiceId: string;
}

export interface UploadStageOutput {
  /** Storage path in the 'pods' bucket, e.g. {podId}/podcast.mp3 */
  storagePath: string;
  /** Duration extracted from MP3 metadata (seconds) */
  durationSeconds: number;
}

/**
 * Run Stage 5: upload MP3 to Supabase Storage and update DB records.
 */
export async function uploadStage(input: UploadStageInput): Promise<UploadStageOutput> {
  const { podId, mp3Path, voiceId } = input;
  const storagePath = `${podId}/podcast.mp3`;

  // 1. Read MP3 file
  const mp3Buffer = await fsPromises.readFile(mp3Path);

  // 2. Extract duration from MP3 metadata
  const metadata = await parseBuffer(mp3Buffer, { mimeType: 'audio/mpeg' });
  const durationSeconds = metadata.format.duration ?? 0;

  // 3. Upload to Supabase Storage bucket 'pods'
  const { error: uploadError } = await supabaseAdmin.storage
    .from('pods')
    .upload(storagePath, mp3Buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  // 4. Update podcasts row: mp3_storage_path, duration_seconds, voice_id
  await db.execute(
    sql`UPDATE podcasts
        SET mp3_storage_path  = ${storagePath},
            duration_seconds  = ${durationSeconds},
            voice_id          = ${voiceId}
        WHERE pod_id = ${podId}::uuid`,
  );

  // 5. Mark pod as 'ready'
  await db.execute(
    sql`UPDATE pods
        SET status = 'ready'
        WHERE id = ${podId}::uuid`,
  );

  // 6. Clean up temp file (best-effort, don't fail the stage)
  await fsPromises.unlink(mp3Path).catch(() => {
    // ignore cleanup errors
  });

  return { storagePath, durationSeconds };
}

