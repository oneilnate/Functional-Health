/**
 * Golden tests for scriptStage — F3-E4
 *
 * Uses a fixture grounded_facts for Sarah Chen (demo user).
 * All external dependencies (DB, Gemini) are mocked.
 *
 * DB call order inside scriptStage:
 *   1. updateStageStatus('running')    → UPDATE pods  → []
 *   2. fetchPodAndUser(podId)          → SELECT       → [row]
 *   3. <Gemini call(s)>
 *   4. upsertPodcastTranscript(...)    → INSERT/UPSERT → []
 *   5. updateStageStatus('complete')   → UPDATE pods  → []
 *
 * Assertions:
 *  - Transcript mentions "fiber" + number 19 or 32
 *  - Transcript mentions added sugar
 *  - Transcript mentions >= 3 real foods from patterns
 *  - Transcript does NOT contain "shellfish" (or shellfish-family words)
 *  - totalDurationSec in [300, 600]
 *  - JSON structure valid (title, segments[6], startSec/endSec chain)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TranscriptJson, GroundedFacts } from '../pipeline/scriptStage.js';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const SARAH_GROUNDED_FACTS: GroundedFacts = {
  avg_daily_calories: 1820,
  avg_daily_protein_g: 72,
  avg_daily_fiber_g: 19,
  avg_daily_added_sugar_g: 38,
  avg_daily_fat_g: 68,
  avg_daily_carb_g: 210,
  avg_daily_sodium_mg: 2100,
  total_pod_calories: 18200,
  diversity_score_0_100: 58,
  top_foods: [
    'grilled chicken breast',
    'white rice',
    'broccoli',
    'greek yogurt',
    'banana',
    'almonds',
    'eggs',
    'spinach salad',
    'oatmeal',
    'apple',
  ],
  patterns: [
    'Most dinners include grilled chicken breast',
    'Breakfast often features eggs or oatmeal',
    'Low fiber across most days — white rice as staple carb',
    'Added sugar spikes from afternoon snacks',
    'Good vegetable variety at dinner with broccoli, spinach',
  ],
  gaps: [
    { nutrient: 'fiber', actual: 19, target: 32, unit: 'g' },
    { nutrient: 'added_sugar', actual: 38, target: 25, unit: 'g' },
    { nutrient: 'protein', actual: 72, target: 90, unit: 'g' },
  ],
};

const SARAH_USER = {
  id: 'usr_demo_01',
  name: 'Sarah',
  dietary_prefs: {
    avoid: ['shellfish'],
    aims: ['more_fiber', 'less_added_sugar'],
    restrictions: [] as string[],
  },
  daily_targets: {
    protein_g: 90,
    fiber_g: 32,
    added_sugar_g: 25,
    calories: 2000,
  },
};

const SARAH_POD = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'usr_demo_01',
  grounded_facts: SARAH_GROUNDED_FACTS,
};

const SARAH_DB_ROW = {
  id: SARAH_POD.id,
  user_id: SARAH_POD.user_id,
  grounded_facts: SARAH_POD.grounded_facts,
  name: SARAH_USER.name,
  dietary_prefs: SARAH_USER.dietary_prefs,
  daily_targets: SARAH_USER.daily_targets,
};

// ─── Valid mock transcript (750+ words, all guardrails pass) ──────────────────

const VALID_TRANSCRIPT: TranscriptJson = {
  title: 'Food Pod #1 — Your Nutrition Story',
  totalDurationSec: 420,
  segments: [
    {
      startSec: 0,
      endSec: 55,
      text: `Sarah, you did it — pod one is completely wrapped. Thirty meals captured and analyzed across ten days, and I have been sitting with your data, and I genuinely want you to take a moment to appreciate what you just pulled off. Most people intend to pay attention to what they eat and never quite get there. You built a habit that lasted ten days, you showed up consistently, and now we have real data to work with — not guesses, not averages, but the actual story of how you have been fueling yourself. When I first looked at your pod, the thing that immediately jumped out was how reliably grilled chicken breast anchors your dinners. That one anchor tells me a lot about your cooking confidence, your palate, and your approach to protein. It is a genuinely strong foundation to build from.`,
      emphasis_words: ['grilled chicken breast', 'protein', 'foundation'],
    },
    {
      startSec: 55,
      endSec: 150,
      text: `Let me share the three patterns your pod is telling me most clearly. First, your dinners are doing a lot of the nutritional heavy lifting. Broccoli, spinach salad, eggs — those appear repeatedly across your evening meals, and the vegetable variety you are getting at dinner is actually above average for someone who is not intentionally tracking. That is a genuine win and it reflects good kitchen habits. Second, your breakfasts consistently anchor around eggs or oatmeal, which is smart — oatmeal in particular gives you beta-glucan fiber and slow-burning carbohydrates that stabilize your morning blood sugar and set the energy tone for the whole day. Third — and this is the one I want to dig into — your afternoon snack window is where the added sugar is climbing. It shows up clearly across multiple days in your pod, and it is not a large amount each time, but the daily accumulation adds up more than you would expect.`,
      emphasis_words: ['broccoli', 'spinach salad', 'oatmeal', 'added sugar', 'afternoon'],
    },
    {
      startSec: 150,
      endSec: 245,
      text: `Now I want to zoom in on fiber, because this is the single biggest nutritional gap I can see in your pod. You averaged 19 grams of fiber per day across the ten days we are looking at. Your target is 32 grams per day. That 13-gram gap sounds manageable, but fiber is one of those nutrients that has an outsized effect on almost everything else. When fiber is low, your gut microbiome does not get the material it needs to produce short-chain fatty acids, which affects not just digestion but your mood, your immune response, and your energy stability throughout the day. You may also notice that you get hungry sooner after meals when fiber is low, because fiber physically slows digestion and creates satiety signals. The encouraging part is that your evening meals already have vegetables — broccoli and spinach salad are solid fiber contributors. The gap is mostly coming from the carb side of your meals, particularly where white rice is the default. That is the most efficient place to close this gap without overhauling your cooking.`,
      emphasis_words: ['fiber', '19 grams', '32', 'target', 'white rice'],
    },
    {
      startSec: 245,
      endSec: 355,
      text: `Here are three practical swaps that target your two largest nutrient gaps directly. Swap one: replace your white rice side dish with farro or black beans at least twice a week. Each serving of farro adds 5 to 6 grams of fiber compared to white rice, plus 3 additional grams of protein. Black beans go even further — 7 to 8 grams of fiber per half-cup serving. If you do both substitutions twice a week, you close your fiber gap by nearly half without changing how you cook your proteins at all. Swap two: your afternoon snack window is adding roughly 38 grams of added sugar per day against your target of 25 grams. That 13-gram surplus is almost entirely coming from afternoon sweet snacks. Swapping one afternoon snack for almonds or a fresh apple with almond butter reduces your daily added sugar by 8 to 12 grams and adds fiber and healthy fats at the same time. Swap three: stir a handful of spinach into your morning eggs two or three times a week. It takes 30 seconds, you barely taste it, and it adds 2 grams of fiber plus meaningful iron and magnesium — nutrients that support energy production and sleep quality at night.`,
      emphasis_words: ['farro', 'black beans', 'fiber', 'almonds', 'added sugar'],
    },
    {
      startSec: 355,
      endSec: 395,
      text: `Here is the one environmental move that will make the biggest practical difference: rewrite your grocery list this week before you go to the store. Put farro, a can of black beans, and a bag of raw almonds on that list right now — before you forget, before the week gets busy. The single strongest predictor of whether someone makes a food change is whether the ingredient is physically in their kitchen. When farro is in the pantry, you use it instead of white rice because it takes about the same amount of time to cook. When almonds are on the counter, you grab them instead of reaching for something with added sugar. The list is the lever. The rest follows almost automatically once the kitchen is stocked with the right building blocks.`,
      emphasis_words: ['grocery list', 'farro', 'almonds', 'kitchen', 'building blocks'],
    },
    {
      startSec: 395,
      endSec: 420,
      text: `Sarah, this was a genuinely strong first pod. You showed up every day, you captured your meals honestly, and your data now tells a clear story with specific, actionable next steps. The fiber gap at 19 grams against a target of 32 is very closeable — two simple swaps get you most of the way there. The added sugar pattern at 38 grams against a target of 25 is real, but it is coming from one specific window in your day, which makes it one of the most solvable problems in your whole pod. Pod two starts now. I am already looking forward to seeing the data from your next ten days. You have got this — let us go.`,
      emphasis_words: ['strong', 'fiber gap', 'pod two', 'solvable'],
    },
  ],
};

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockDbExecute, mockGeminiGenerate } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  mockGeminiGenerate: vi.fn(),
}));

vi.mock('../env.js', () => ({
  env: {
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-pro',
    DEMO_USER_BEARER_TOKEN: 'test-token',
    NODE_ENV: 'test',
    PORT: 3000,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  },
}));

vi.mock('../db/client.js', () => ({
  db: { execute: mockDbExecute },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGeminiGenerate,
    }),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGeminiResponse(transcript: TranscriptJson) {
  return { response: { text: () => JSON.stringify(transcript) } };
}

/**
 * Reset all mock queues (including mockResolvedValueOnce queues) and set up
 * default happy-path DB responses.
 *
 * Uses vi.resetAllMocks() (not clearAllMocks) to flush leftover once-queues
 * from previous tests.
 *
 * DB call order inside scriptStage:
 *   1. updateStageStatus('running')   → UPDATE  → []
 *   2. fetchPodAndUser(podId)         → SELECT  → [row]
 *   3. upsertPodcastTranscript(...)   → INSERT  → []
 *   4. updateStageStatus('complete')  → UPDATE  → []
 */
function setupDefaultMocks(dbRow = SARAH_DB_ROW) {
  mockDbExecute.mockReset();
    mockGeminiGenerate.mockReset();
  mockDbExecute
    .mockResolvedValueOnce([])       // 1. updateStageStatus('running')
    .mockResolvedValueOnce([dbRow])  // 2. fetchPodAndUser
    .mockResolvedValueOnce([])       // 3. upsertPodcastTranscript
    .mockResolvedValueOnce([]);      // 4. updateStageStatus('complete')
  mockGeminiGenerate.mockResolvedValue(buildGeminiResponse(VALID_TRANSCRIPT));
}

// ─── Golden tests ─────────────────────────────────────────────────────────────

describe('scriptStage — golden test with Sarah Chen fixture', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  it('returns a valid TranscriptJson with correct shape', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    expect(result).toBeDefined();
    expect(typeof result.title).toBe('string');
    expect(typeof result.totalDurationSec).toBe('number');
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.segments).toHaveLength(6);
  });

  it('totalDurationSec is within [300, 600] seconds', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    expect(result.totalDurationSec).toBeGreaterThanOrEqual(300);
    expect(result.totalDurationSec).toBeLessThanOrEqual(600);
  });

  it('transcript mentions "fiber"', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ').toLowerCase();
    expect(fullText).toContain('fiber');
  });

  it('transcript mentions fiber numbers 19 or 32 (the actual and target gap)', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ');
    const has19 = fullText.includes('19');
    const has32 = fullText.includes('32');
    expect(has19 || has32).toBe(true);
  });

  it('transcript mentions "added sugar"', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ').toLowerCase();
    expect(fullText).toContain('added sugar');
  });

  it('transcript mentions >= 3 real foods from grounded_facts.top_foods', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ').toLowerCase();
    const realFoods = SARAH_GROUNDED_FACTS.top_foods ?? [];
    const mentioned = realFoods.filter((food) => fullText.includes(food.toLowerCase()));
    expect(mentioned.length).toBeGreaterThanOrEqual(3);
  });

  it('transcript does NOT contain the word "shellfish"', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ').toLowerCase();
    expect(fullText).not.toContain('shellfish');
  });

  it('transcript does NOT contain shellfish-family words', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    const fullText = result.segments.map((s) => s.text).join(' ').toLowerCase();
    const shellfishTerms = ['shrimp', 'lobster', 'crab', 'scallop', 'clam', 'oyster', 'prawn', 'mussel'];
    for (const term of shellfishTerms) {
      expect(fullText, `must not mention "${term}" (shellfish family)`).not.toContain(term);
    }
  });

  it('segments have a valid startSec/endSec chain (segment N startSec = segment N-1 endSec)', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    expect(result.segments[0]!.startSec).toBe(0);
    for (let i = 1; i < result.segments.length; i++) {
      expect(result.segments[i]!.startSec).toBe(result.segments[i - 1]!.endSec);
    }
    expect(result.totalDurationSec).toBe(result.segments[result.segments.length - 1]!.endSec);
  });

  it('writes transcript_json to the DB', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    await scriptStage(SARAH_POD.id);

    // 4 DB calls: updateStageStatus(running), fetchPodAndUser, upsert, updateStageStatus(complete)
    expect(mockDbExecute).toHaveBeenCalledTimes(4);
  });

  it('each segment has an emphasis_words array', async () => {
    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    for (const seg of result.segments) {
      expect(Array.isArray(seg.emphasis_words)).toBe(true);
    }
  });
});

// ─── Guardrail edge cases ─────────────────────────────────────────────────────

describe('scriptStage — validation guardrails', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    mockGeminiGenerate.mockReset();
  });

  it('throws ScriptValidationError when both attempts return a transcript mentioning shellfish', async () => {
    const shellfishTranscript: TranscriptJson = {
      ...VALID_TRANSCRIPT,
      segments: VALID_TRANSCRIPT.segments.map((s, i) =>
        i === 3 ? { ...s, text: s.text + ' Consider adding shrimp stir-fry as a protein swap.' } : s,
      ),
    };

    mockDbExecute
      .mockResolvedValueOnce([])             // updateStageStatus('running')
      .mockResolvedValueOnce([SARAH_DB_ROW]) // fetchPodAndUser
      .mockResolvedValue([]);                // any remaining calls

    mockGeminiGenerate
      .mockResolvedValueOnce(buildGeminiResponse(shellfishTranscript))  // attempt 1 fails
      .mockResolvedValueOnce(buildGeminiResponse(shellfishTranscript)); // attempt 2 also fails

    const { scriptStage, ScriptValidationError } = await import('../pipeline/scriptStage.js');

    await expect(scriptStage(SARAH_POD.id)).rejects.toBeInstanceOf(ScriptValidationError);
  });

  it('throws ScriptValidationError when both attempts return a transcript that is too short (< 300s)', async () => {
    // Build an internally consistent transcript that is only 250 seconds
    const shortSegments = VALID_TRANSCRIPT.segments.map((s) => ({
      ...s,
      startSec: Math.floor((s.startSec / 420) * 250),
      endSec: Math.floor((s.endSec / 420) * 250),
    }));
    // Re-chain startSec strictly
    let cur = 0;
    for (const seg of shortSegments) {
      seg.startSec = cur;
      cur = seg.endSec;
    }
    const shortTranscript: TranscriptJson = {
      ...VALID_TRANSCRIPT,
      totalDurationSec: shortSegments[shortSegments.length - 1]!.endSec,
      segments: shortSegments,
    };

    mockDbExecute
      .mockResolvedValueOnce([])             // updateStageStatus('running')
      .mockResolvedValueOnce([SARAH_DB_ROW]) // fetchPodAndUser
      .mockResolvedValue([]);

    mockGeminiGenerate
      .mockResolvedValueOnce(buildGeminiResponse(shortTranscript))
      .mockResolvedValueOnce(buildGeminiResponse(shortTranscript));

    const { scriptStage, ScriptValidationError } = await import('../pipeline/scriptStage.js');

    await expect(scriptStage(SARAH_POD.id)).rejects.toBeInstanceOf(ScriptValidationError);
  });

  it('retries once on first validation failure and succeeds on second attempt', async () => {
    const invalidFirst: TranscriptJson = {
      ...VALID_TRANSCRIPT,
      segments: [], // will fail: expected 6 segments, got 0
    };

    mockDbExecute
      .mockResolvedValueOnce([])             // updateStageStatus('running')
      .mockResolvedValueOnce([SARAH_DB_ROW]) // fetchPodAndUser
      .mockResolvedValueOnce([])             // upsertPodcastTranscript
      .mockResolvedValueOnce([]);            // updateStageStatus('complete')

    mockGeminiGenerate
      .mockResolvedValueOnce(buildGeminiResponse(invalidFirst))     // attempt 1: fails
      .mockResolvedValueOnce(buildGeminiResponse(VALID_TRANSCRIPT)); // attempt 2: passes

    const { scriptStage } = await import('../pipeline/scriptStage.js');
    const result = await scriptStage(SARAH_POD.id);

    expect(result.title).toBe(VALID_TRANSCRIPT.title);
    expect(mockGeminiGenerate).toHaveBeenCalledTimes(2);
  });
});
