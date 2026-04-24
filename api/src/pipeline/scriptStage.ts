/**
 * F3-E4: Stage 3 — Persona script generation using Gemini 1.5 Pro.
 *
 * Reads grounded_facts from pods, user dietary_prefs from users,
 * renders the prompt template, calls Gemini 1.5 Pro, validates the
 * JSON output against the required schema, and writes result to
 * podcasts.transcript_json.
 *
 * Spec: art_1byWlV0c §9.3, §10.1, §10.2, §10.3
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { env } from '../env.js';
import { updateStageStatus } from './run.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  startSec: number;
  endSec: number;
  text: string;
  emphasis_words: string[];
}

export interface TranscriptJson {
  title: string;
  totalDurationSec: number;
  segments: TranscriptSegment[];
}

export interface GroundedFacts {
  avg_daily_calories?: number;
  avg_daily_protein_g?: number;
  avg_daily_fiber_g?: number;
  avg_daily_added_sugar_g?: number;
  avg_daily_fat_g?: number;
  avg_daily_carb_g?: number;
  avg_daily_sodium_mg?: number;
  total_pod_calories?: number;
  diversity_score_0_100?: number;
  top_foods?: string[];
  patterns?: string[];
  gaps?: Array<{
    nutrient: string;
    actual: number;
    target: number;
    unit: string;
  }>;
  [key: string]: unknown;
}

export interface UserRow {
  id: string;
  name: string | null;
  dietary_prefs: { avoid?: string[]; aims?: string[]; restrictions?: string[] } | null;
  daily_targets: Record<string, number> | null;
}

export interface PodRow {
  id: string;
  user_id: string;
  grounded_facts: GroundedFacts | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'prompts',
  'script.txt'
);

const MIN_DURATION_SEC = 300;
const MAX_DURATION_SEC = 600;
const MIN_WORDS = 750;
const MAX_WORDS = 1500;
const REQUIRED_SEGMENTS = 6;

// Banned phrases per spec §10.1 and Appendix A.3
const BANNED_PATTERNS = [
  /\bfail(ed|ure|ing)?\b/i,
  /\bcheat\s+(day|meal)\b/i,
  /\bshould('?ve|\s+have)\b/i,
  /\bbad\s+(choice|decision|food)\b/i,
  /\bjunk\s+food\b/i,
  /\bguilty\b/i,
  /\bwillpower\b/i,
  /\brestrict(ion|ing|ed)?\b/i,
];

// ─── Prompt rendering ─────────────────────────────────────────────────────────

function renderPrompt(
  template: string,
  user: UserRow,
  pod: PodRow,
  podNumber: number,
): string {
  const avoidList = user.dietary_prefs?.avoid ?? [];
  const avoidStr = avoidList.length > 0 ? avoidList.join(', ') : 'none';

  return template
    .replace(/{user_name}/g, user.name ?? 'there')
    .replace(/{timespan_days}/g, String(10))
    .replace(/{dietary_prefs_avoid}/g, avoidStr)
    .replace(/{pod_number}/g, String(podNumber))
    .replace(/{grounded_facts_json}/g, JSON.stringify(pod.grounded_facts ?? {}, null, 2));
}

// ─── Validation ───────────────────────────────────────────────────────────────

export class ScriptValidationError extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail?: unknown,
  ) {
    super(`Script validation failed: ${reason}`);
    this.name = 'ScriptValidationError';
  }
}

function validateTranscript(
  raw: unknown,
  avoidList: string[],
): TranscriptJson {
  if (typeof raw !== 'object' || raw === null) {
    throw new ScriptValidationError('transcript is not an object', raw);
  }
  const t = raw as Record<string, unknown>;

  if (typeof t['title'] !== 'string' || !t['title']) {
    throw new ScriptValidationError('missing or empty title');
  }
  if (typeof t['totalDurationSec'] !== 'number') {
    throw new ScriptValidationError('totalDurationSec is not a number');
  }
  if (t['totalDurationSec'] < MIN_DURATION_SEC || t['totalDurationSec'] > MAX_DURATION_SEC) {
    throw new ScriptValidationError(
      `totalDurationSec ${t['totalDurationSec']} out of range [${MIN_DURATION_SEC}, ${MAX_DURATION_SEC}]`,
    );
  }
  if (!Array.isArray(t['segments'])) {
    throw new ScriptValidationError('segments is not an array');
  }
  if (t['segments'].length !== REQUIRED_SEGMENTS) {
    throw new ScriptValidationError(
      `expected ${REQUIRED_SEGMENTS} segments, got ${t['segments'].length}`,
    );
  }

  const segments: TranscriptSegment[] = [];
  let totalWords = 0;

  for (let i = 0; i < t['segments'].length; i++) {
    const seg = t['segments'][i] as Record<string, unknown>;
    if (typeof seg['startSec'] !== 'number') {
      throw new ScriptValidationError(`segment ${i} missing startSec`);
    }
    if (typeof seg['endSec'] !== 'number') {
      throw new ScriptValidationError(`segment ${i} missing endSec`);
    }
    if (seg['endSec'] <= seg['startSec']) {
      throw new ScriptValidationError(
        `segment ${i} endSec (${seg['endSec']}) must be > startSec (${seg['startSec']})`,
      );
    }
    if (typeof seg['text'] !== 'string' || !seg['text'].trim()) {
      throw new ScriptValidationError(`segment ${i} missing or empty text`);
    }
    if (!Array.isArray(seg['emphasis_words'])) {
      throw new ScriptValidationError(`segment ${i} emphasis_words is not an array`);
    }
    // Check segment continuity
    if (i > 0) {
      const prevEnd = (t['segments'][i - 1] as Record<string, unknown>)['endSec'] as number;
      if (Math.abs(seg['startSec'] as number - prevEnd) > 0.01) {
        throw new ScriptValidationError(
          `segment ${i} startSec (${seg['startSec']}) does not match previous endSec (${prevEnd})`,
        );
      }
    }
    totalWords += (seg['text'] as string).split(/\s+/).filter(Boolean).length;
    segments.push(seg as unknown as TranscriptSegment);
  }

  // Word count check
  if (totalWords < MIN_WORDS || totalWords > MAX_WORDS) {
    throw new ScriptValidationError(
      `word count ${totalWords} out of range [${MIN_WORDS}, ${MAX_WORDS}]`,
    );
  }

  // totalDurationSec must match last segment's endSec
  const lastEnd = segments[segments.length - 1]!.endSec;
  if (Math.abs(t['totalDurationSec'] - lastEnd) > 0.01) {
    throw new ScriptValidationError(
      `totalDurationSec (${t['totalDurationSec']}) does not match last segment endSec (${lastEnd})`,
    );
  }

  // Banned phrase scan — across all segment texts
  const fullText = segments.map((s) => s.text).join('\n');
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(fullText)) {
      throw new ScriptValidationError(`banned phrase found: ${pattern.toString()}`);
    }
  }

  // Dietary safety scan — avoid list
  const fullTextLower = fullText.toLowerCase();
  for (const item of avoidList) {
    // Check for exact item and common variants
    const itemLower = item.toLowerCase().trim();
    if (fullTextLower.includes(itemLower)) {
      throw new ScriptValidationError(
        `dietary safety violation: "${item}" from avoid list found in transcript`,
      );
    }
    // Expand shellfish family if shellfish is avoided
    if (itemLower === 'shellfish') {
      const shellfishTerms = ['shrimp', 'lobster', 'crab', 'scallop', 'clam', 'oyster', 'prawn', 'mussel', 'crayfish', 'squid', 'octopus'];
      for (const term of shellfishTerms) {
        if (fullTextLower.includes(term)) {
          throw new ScriptValidationError(
            `dietary safety violation: "${term}" (shellfish family) found in transcript`,
          );
        }
      }
    }
  }

  return {
    title: t['title'] as string,
    totalDurationSec: t['totalDurationSec'] as number,
    segments,
  };
}

// ─── Gemini call ──────────────────────────────────────────────────────────────

async function generateWithGemini(prompt: string): Promise<TranscriptJson> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Gemini sometimes wraps JSON in markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch?.[1]) {
      parsed = JSON.parse(fenceMatch[1]);
    } else {
      throw new ScriptValidationError('Gemini response is not valid JSON', text);
    }
  }

  return parsed as TranscriptJson;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchPodAndUser(
  podId: string,
): Promise<{ pod: PodRow; user: UserRow }> {
  type PodUserRow = Record<string, unknown>;
  const rows = await db.execute<PodUserRow>(
    sql`
      SELECT
        p.id,
        p.user_id,
        p.grounded_facts,
        u.name,
        u.dietary_prefs,
        u.daily_targets
      FROM pods p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ${podId}
      LIMIT 1
    `,
  );
  if (rows.length === 0) {
    throw new Error(`Pod not found: ${podId}`);
  }
  const row = rows[0]!;
  return {
    pod: {
      id: row.id as string,
      user_id: row.user_id as string,
      grounded_facts: row.grounded_facts as GroundedFacts | null,
    },
    user: {
      id: row.user_id as string,
      name: row.name as string | null,
      dietary_prefs: row.dietary_prefs as UserRow['dietary_prefs'],
      daily_targets: row.daily_targets as UserRow['daily_targets'],
    },
  };
}

async function upsertPodcastTranscript(
  podId: string,
  transcript: TranscriptJson,
): Promise<void> {
  await db.execute(
    sql`
      INSERT INTO podcasts (pod_id, transcript_json, duration_seconds)
      VALUES (
        ${podId},
        ${JSON.stringify(transcript)}::json,
        ${transcript.totalDurationSec}
      )
      ON CONFLICT (pod_id) DO UPDATE
        SET transcript_json = EXCLUDED.transcript_json,
            duration_seconds = EXCLUDED.duration_seconds
    `,
  );
}



// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Reads grounded_facts + user from DB, calls Gemini 1.5 Pro with the
 * persona prompt, validates the JSON output, and writes to podcasts.transcript_json.
 *
 * Throws on unrecoverable error. Caller is responsible for retry/backoff.
 */
export async function scriptStage(podId: string): Promise<TranscriptJson> {
  const template = readFileSync(PROMPT_PATH, 'utf-8');

  await updateStageStatus(podId, 'script', {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  const { pod, user } = await fetchPodAndUser(podId);

  // Pod number is 1 for now; future: count prior completed pods for user
  const podNumber = 1;

  const avoidList = user.dietary_prefs?.avoid ?? [];
  const prompt = renderPrompt(template, user, pod, podNumber);

  // Attempt 1
  let transcript: TranscriptJson;
  try {
    const raw = await generateWithGemini(prompt);
    transcript = validateTranscript(raw, avoidList);
  } catch (firstErr) {
    // Attempt 2 — append error context to prompt
    const retryPrompt = [
      prompt,
      '',
      `## Previous attempt failed validation`,
      `Error: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`,
      `Please fix the issue and return valid JSON that passes all requirements.`,
    ].join('\n');

    const raw2 = await generateWithGemini(retryPrompt);
    transcript = validateTranscript(raw2, avoidList);
  }

  await upsertPodcastTranscript(podId, transcript);
  await updateStageStatus(podId, 'script', {
    status: 'complete',
    completedAt: new Date().toISOString(),
  });

  return transcript;
}
