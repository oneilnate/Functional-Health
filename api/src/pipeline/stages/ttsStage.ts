import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../env.js';

/**
 * Stage 4 — ElevenLabs TTS
 *
 * Concatenates all segment texts from transcript_json and calls the
 * ElevenLabs streaming TTS endpoint. Saves the MP3 to /tmp/{podId}.mp3.
 *
 * Retries on 429 (rate-limit) with exponential backoff: 2s, 8s (max 2 retries).
 */

export interface TtsStageInput {
  podId: string;
  /** Concatenated transcript text to synthesize */
  text: string;
}

export interface TtsStageOutput {
  /** Absolute path to the saved MP3 file */
  mp3Path: string;
  /** Voice ID used for synthesis */
  voiceId: string;
}

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';
const MAX_RETRIES = 2;
const BACKOFF_MS = [2_000, 8_000] as const;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract all segment texts from transcript_json and join them.
 * Accepts multiple transcript shapes:
 *   - Array of {text: string} objects (standard pipeline shape)
 *   - Array of strings
 *   - Plain string
 */
export function extractTranscriptText(transcriptJson: unknown): string {
  if (typeof transcriptJson === 'string') {
    return transcriptJson;
  }
  if (!Array.isArray(transcriptJson)) {
    return '';
  }
  return (transcriptJson as unknown[])
    .map((seg) => {
      if (typeof seg === 'string') return seg;
      if (seg !== null && typeof seg === 'object' && 'text' in seg) {
        return String((seg as { text: unknown }).text);
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Run Stage 4: call ElevenLabs TTS and save the streamed MP3 to /tmp.
 */
export async function ttsStage(input: TtsStageInput): Promise<TtsStageOutput> {
  const { podId, text } = input;
  const voiceId = env.ELEVENLABS_VOICE_ID;
  const mp3Path = path.join('/tmp', `${podId}.mp3`);

  const url = `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}/stream`;

  const body = JSON.stringify({
    text,
    model_id: 'eleven_turbo_v2_5',
    optimize_streaming_latency: 2,
  });

  let attempt = 0;

  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env.ELEVENLABS_API_KEY,
        Accept: 'audio/mpeg',
      },
      body,
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const backoff = BACKOFF_MS[attempt] ?? 8_000;
      await sleep(backoff);
      attempt++;
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `ElevenLabs TTS failed: HTTP ${response.status} — ${errText}`,
      );
    }

    // Stream the response body into /tmp/{podId}.mp3
    if (!response.body) {
      throw new Error('ElevenLabs TTS returned an empty body');
    }

    const fileStream = fs.createWriteStream(mp3Path);
    // Web Streams API — response.body is a ReadableStream<Uint8Array>
    const reader = response.body.getReader();

    await new Promise<void>((resolve, reject) => {
      fileStream.on('error', reject);
      fileStream.on('finish', resolve);

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) fileStream.write(value);
          }
          fileStream.end();
        } catch (err) {
          fileStream.destroy(err instanceof Error ? err : new Error(String(err)));
          reject(err);
        }
      })();
    });

    // Verify the file was written
    const stat = await fsPromises.stat(mp3Path);
    if (stat.size === 0) {
      throw new Error('ElevenLabs TTS produced an empty MP3 file');
    }

    return { mp3Path, voiceId };
  }
}

