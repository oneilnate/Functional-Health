import fs from "fs";
import path from "path";
import { db } from "./db.js";

export const MEDIA_ROOT =
  process.env.FOODPOD_MEDIA_ROOT ?? "/srv/foodpod/media";
export const IMAGES_DIR = path.join(MEDIA_ROOT, "images");
export const AUDIO_DIR = path.join(MEDIA_ROOT, "audio");

/**
 * Ensure media directories exist (runs at boot; no-op if already present)
 */
export function ensureMediaDirs(): void {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Get next sequence number for images in a pod.
 */
export function nextSequenceNumber(podId: string): number {
  const row = db
    .query<{ next: number }, [string]>(
      "SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next FROM meal_images WHERE pod_id = ?"
    )
    .get(podId);
  return row?.next ?? 1;
}

/**
 * Save image buffer to disk and return the full path.
 */
export async function saveImage(
  podId: string,
  buffer: ArrayBuffer,
  ext: string
): Promise<string> {
  const podDir = path.join(IMAGES_DIR, podId);
  fs.mkdirSync(podDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  const filepath = path.join(podDir, filename);
  fs.writeFileSync(filepath, Buffer.from(buffer));
  return filepath;
}

/**
 * Get public-facing URL for a media file (served by nginx at /media/).
 */
export function mediaUrl(filePath: string): string {
  const rel = filePath.replace(MEDIA_ROOT, "").replace(/^\/+/, "");
  return `/media/${rel}`;
}
