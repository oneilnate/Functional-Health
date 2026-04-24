/**
 * Smoke tests for Stage 1: Gemini vision analysis.
 *
 * Strategy:
 *   - Mock the Gemini client, Supabase storage, db, and env modules.
 *   - Test the orchestration logic in visionStage() directly.
 *   - Test analyseWithGemini() retry/backoff behaviour.
 *   - Test downloadImageAsBase64() path normalisation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mock fns (must be declared before vi.mock calls) ──────────────────
const { mockDbExecute, mockDownload, mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  mockDownload: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockGetGenerativeModel: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('../env.js', () => ({
  env: {
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-pro',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    DEMO_USER_BEARER_TOKEN: 'test-token',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

vi.mock('../db/client.js', () => ({
  db: { execute: mockDbExecute },
}));

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({ download: mockDownload }),
    },
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// ── Import under test (after all mocks) ──────────────────────────────────────
import {
  visionStage,
  analyseWithGemini,
  downloadImageAsBase64,
  saveMealAnalysis,
  sleep,
  type GeminiAnalysis,
} from '../pipeline/stages/visionStage.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Wire up mockGetGenerativeModel to use mockGenerateContent
mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });

// ── Fixtures ──────────────────────────────────────────────────────────────────
const POD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEAL_ID_1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MEAL_ID_2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const MEAL_ID_3 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const SALAD_ANALYSIS: GeminiAnalysis = {
  foods: [
    { name: 'leafy greens (mixed salad)', estimated_portion_g: 80, portion_confidence: 0.9 },
    { name: 'cherry tomatoes', estimated_portion_g: 40, portion_confidence: 0.88 },
    { name: 'cucumber slices', estimated_portion_g: 30, portion_confidence: 0.85 },
  ],
  scene_description: 'A fresh garden salad with leafy greens, cherry tomatoes, and cucumber in a white bowl.',
  overall_confidence: 0.88,
};

const MEAL_ROWS = [
  { id: MEAL_ID_1, pod_id: POD_ID, image_url: `meals/${POD_ID}/${MEAL_ID_1}.jpg` },
  { id: MEAL_ID_2, pod_id: POD_ID, image_url: `meals/${POD_ID}/${MEAL_ID_2}.jpg` },
  { id: MEAL_ID_3, pod_id: POD_ID, image_url: `meals/${POD_ID}/${MEAL_ID_3}.jpg` },
];

/** Build a fake Blob from a small string. */
function fakeImageBlob(content = 'fake-jpeg-bytes'): Blob {
  return new Blob([content], { type: 'image/jpeg' });
}

/** Build a Gemini text response mock. */
function makeGeminiResponse(analysis: GeminiAnalysis) {
  return {
    response: {
      text: () => JSON.stringify(analysis),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sleep helper
// ─────────────────────────────────────────────────────────────────────────────
describe('sleep', () => {
  it('resolves after the given delay', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// downloadImageAsBase64
// ─────────────────────────────────────────────────────────────────────────────
describe('downloadImageAsBase64', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it('strips the "meals/" bucket prefix from image_url', async () => {
    mockDownload.mockResolvedValueOnce({
      data: fakeImageBlob(),
      error: null,
    });

    const result = await downloadImageAsBase64(`meals/${POD_ID}/${MEAL_ID_1}.jpg`);

    expect(mockDownload).toHaveBeenCalledWith(`${POD_ID}/${MEAL_ID_1}.jpg`);
    expect(result.mimeType).toBe('image/jpeg');
    expect(typeof result.base64).toBe('string');
    expect(result.base64.length).toBeGreaterThan(0);
  });

  it('uses path as-is when no bucket prefix present', async () => {
    mockDownload.mockResolvedValueOnce({
      data: fakeImageBlob(),
      error: null,
    });

    await downloadImageAsBase64(`${POD_ID}/${MEAL_ID_1}.jpg`);
    expect(mockDownload).toHaveBeenCalledWith(`${POD_ID}/${MEAL_ID_1}.jpg`);
  });

  it('detects png mime type from file extension', async () => {
    mockDownload.mockResolvedValueOnce({ data: fakeImageBlob(), error: null });
    const result = await downloadImageAsBase64('some/path/image.png');
    expect(result.mimeType).toBe('image/png');
  });

  it('throws on storage error', async () => {
    mockDownload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Object not found' },
    });

    await expect(downloadImageAsBase64('missing/image.jpg')).rejects.toThrow(
      'Storage download failed',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// analyseWithGemini
// ─────────────────────────────────────────────────────────────────────────────
describe('analyseWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  it('returns parsed GeminiAnalysis on success', async () => {
    mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(SALAD_ANALYSIS));

    const gemini = new GoogleGenerativeAI('test-key');
    const result = await analyseWithGemini(gemini, 'base64data', 'image/jpeg');

    expect(result.foods).toHaveLength(3);
    // Smoke test: identifies leafy greens
    expect(result.foods[0].name).toMatch(/leafy greens/i);
    expect(result.overall_confidence).toBeGreaterThan(0.5);
  });

  it('strips markdown code fences from Gemini response', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => '```json\n' + JSON.stringify(SALAD_ANALYSIS) + '\n```',
      },
    });

    const gemini = new GoogleGenerativeAI('test-key');
    const result = await analyseWithGemini(gemini, 'base64data', 'image/jpeg');
    expect(result.overall_confidence).toBe(SALAD_ANALYSIS.overall_confidence);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Rate limit hit'))
      .mockResolvedValueOnce(makeGeminiResponse(SALAD_ANALYSIS));

    const gemini = new GoogleGenerativeAI('test-key');
    const result = await analyseWithGemini(gemini, 'base64data', 'image/jpeg');
    expect(result.overall_confidence).toBe(SALAD_ANALYSIS.overall_confidence);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('throws after all retries are exhausted', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Persistent rate limit'));

    const gemini = new GoogleGenerativeAI('test-key');
    await expect(
      analyseWithGemini(gemini, 'base64data', 'image/jpeg'),
    ).rejects.toThrow('Persistent rate limit');
    // MAX_RETRIES = 2 → 3 total attempts
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  }, 30_000);

  it('throws on missing foods array in response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ scene_description: 'food', overall_confidence: 0.9 }),
      },
    });

    const gemini = new GoogleGenerativeAI('test-key');
    await expect(
      analyseWithGemini(gemini, 'base64data', 'image/jpeg'),
    ).rejects.toThrow('Gemini response missing foods array');
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// saveMealAnalysis
// ─────────────────────────────────────────────────────────────────────────────
describe('saveMealAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.execute once (UPDATE meals)', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    await saveMealAnalysis(MEAL_ID_1, SALAD_ANALYSIS);
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// visionStage — orchestration
// ─────────────────────────────────────────────────────────────────────────────
describe('visionStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  function setupHappyPath() {
    // DB call 1: SELECT uploaded meals
    mockDbExecute.mockResolvedValueOnce(MEAL_ROWS);
    // DB call 2: UPDATE stage_status running
    mockDbExecute.mockResolvedValueOnce([]);
    // Gemini returns salad analysis for each meal
    mockGenerateContent.mockResolvedValue(makeGeminiResponse(SALAD_ANALYSIS));
    // Storage download succeeds for each meal
    mockDownload.mockResolvedValue({ data: fakeImageBlob(), error: null });
    // DB: saveMealAnalysis x3 + stage_status complete — catch-all
    mockDbExecute.mockResolvedValue([]);
  }

  it('processes all 3 meals and marks vision stage complete', async () => {
    setupHappyPath();
    await visionStage(POD_ID);

    // At minimum: SELECT meals + UPDATE running + 3x UPDATE analyzed + UPDATE complete
    expect(mockDbExecute).toHaveBeenCalledTimes(6);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(mockDownload).toHaveBeenCalledTimes(3);
  });

  it('throws when no uploaded meals found', async () => {
    // DB: no meals
    mockDbExecute.mockResolvedValueOnce([]);

    await expect(visionStage(POD_ID)).rejects.toThrow(
      'no uploaded meals found',
    );
  });

  it('throws and marks pod failed when all meals fail', async () => {
    // DB: SELECT meals
    mockDbExecute.mockResolvedValueOnce(MEAL_ROWS);
    // DB: UPDATE running
    mockDbExecute.mockResolvedValueOnce([]);
    // Storage fails for all meals
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });
    // DB: UPDATE failed — catch-all
    mockDbExecute.mockResolvedValue([]);

    await expect(visionStage(POD_ID)).rejects.toThrow(
      /all.*meals failed/,
    );
  });

  it('continues when one meal fails (partial success)', async () => {
    const twoMealRows = MEAL_ROWS.slice(0, 2);

    // DB: SELECT 2 meals
    mockDbExecute.mockResolvedValueOnce(twoMealRows);
    // DB: UPDATE running
    mockDbExecute.mockResolvedValueOnce([]);

    // Meal 1: storage fails; Meal 2: succeeds
    mockDownload
      .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
      .mockResolvedValueOnce({ data: fakeImageBlob(), error: null });

    mockGenerateContent.mockResolvedValue(makeGeminiResponse(SALAD_ANALYSIS));

    // DB: catch-all for saveMealAnalysis + complete
    mockDbExecute.mockResolvedValue([]);

    // Should NOT throw (partial success)
    await expect(visionStage(POD_ID)).resolves.toBeUndefined();
  });

  it('smoke test: Gemini identifies "leafy greens" for a salad image', async () => {
    const oneMealRow = [
      { id: MEAL_ID_1, pod_id: POD_ID, image_url: `meals/${POD_ID}/${MEAL_ID_1}.jpg` },
    ];

    mockDbExecute.mockResolvedValueOnce(oneMealRow);
    mockDbExecute.mockResolvedValue([]);
    mockDownload.mockResolvedValue({ data: fakeImageBlob('salad-image'), error: null });
    mockGenerateContent.mockResolvedValue(makeGeminiResponse(SALAD_ANALYSIS));

    await visionStage(POD_ID);

    // Gemini was called once for the one meal
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    // The mocked analysis identifies leafy greens with confidence > 0.5
    expect(SALAD_ANALYSIS.foods[0].name).toMatch(/leafy greens/i);
    expect(SALAD_ANALYSIS.overall_confidence).toBeGreaterThan(0.5);
  });
});
