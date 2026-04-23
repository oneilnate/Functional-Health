/**
 * Tests for POST /api/pods/:podId/meals and PATCH /api/meals/:id endpoints.
 *
 * Strategy: build a real Fastify instance with auth + meal routes registered,
 * mock env, db/client, and lib/supabase so no real network calls happen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// ── Mock env ────────────────────────────────────────────────────────────────────────
const TEST_TOKEN = 'test-bearer-token-secret';

vi.mock('../env.js', () => ({
  env: {
    DEMO_USER_BEARER_TOKEN: TEST_TOKEN,
    NODE_ENV: 'test',
    PORT: 3000,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  },
}));

// ── Mock DB client ────────────────────────────────────────────────────────────────────
const mockDbExecute = vi.fn();

vi.mock('../db/client.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

// ── Mock Supabase storage ────────────────────────────────────────────────────────────
const mockCreateSignedUploadUrl = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      }),
    },
  },
}));

// ── Fixtures ────────────────────────────────────────────────────────────────────────
const DEMO_USER_ID = 'usr_demo_01';
const POD_ID = '11111111-1111-1111-1111-111111111111';
const MEAL_ID = '22222222-2222-2222-2222-222222222222';
const SIGNED_UPLOAD_URL = 'https://test.supabase.co/storage/v1/object/upload/sign/meals/path?token=xyz';

const DEMO_POD_ROW = {
  id: POD_ID,
  user_id: DEMO_USER_ID,
};

const DEMO_MEAL_WITH_POD = {
  id: MEAL_ID,
  pod_id: POD_ID,
  captured_at: null,
  image_url: null,
  gemini_analysis: null,
  usda_matched_foods: null,
  confidence_score: null,
  status: 'pending_upload',
  created_at: '2026-04-23T00:00:00.000Z',
  user_id: DEMO_USER_ID, // joined from pods
};

const UPDATED_MEAL_ROW = {
  id: MEAL_ID,
  pod_id: POD_ID,
  captured_at: '2026-04-23T01:00:00.000Z',
  image_url: `meals/${POD_ID}/${MEAL_ID}.jpg`,
  gemini_analysis: null,
  usda_matched_foods: null,
  confidence_score: null,
  status: 'uploaded',
  created_at: '2026-04-23T00:00:00.000Z',
};

// ── App factory ──────────────────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({ logger: false });
  const { bearerAuthPlugin } = await import('../middleware/auth.js');
  const { mealRoutes } = await import('../routes/meals.js');
  await app.register(bearerAuthPlugin);
  await app.register(mealRoutes);
  await app.ready();
  return app;
}

// ── Helper ───────────────────────────────────────────────────────────────────────────
const authHeader = { authorization: `Bearer ${TEST_TOKEN}` };

// ────────────────────────────────────────────────────────────────────────────────
// POST /api/pods/:podId/meals
// ────────────────────────────────────────────────────────────────────────────────
describe('POST /api/pods/:podId/meals', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('creates meal row and returns presigned upload URL on success', async () => {
    // DB: pod lookup succeeds
    mockDbExecute.mockResolvedValueOnce([DEMO_POD_ROW]);
    // DB: meal insert succeeds
    mockDbExecute.mockResolvedValueOnce([]);
    // Supabase: signed URL
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: { signedUrl: SIGNED_UPLOAD_URL, path: `${POD_ID}/${MEAL_ID}.jpg`, token: 'xyz' },
      error: null,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/meals`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    // mealId must be a UUID
    expect(body.mealId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.uploadUrl).toBe(SIGNED_UPLOAD_URL);
    expect(body.storagePath).toMatch(new RegExp(`^meals/${POD_ID}/`));
    expect(body.storagePath).toMatch(/\.jpg$/);
    expect(body.expiresIn).toBe(120);
  });

  it('returns 404 POD_NOT_FOUND when pod does not exist', async () => {
    // DB: pod lookup returns empty
    mockDbExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/meals`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('POD_NOT_FOUND');
    // Should NOT call Supabase at all
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('returns 404 POD_NOT_FOUND when pod belongs to a different user (tenant isolation)', async () => {
    // DB: pod lookup returns pod owned by another user
    mockDbExecute.mockResolvedValueOnce([{ id: POD_ID, user_id: 'usr_other_99' }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/meals`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('POD_NOT_FOUND');
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('returns 401 when no bearer token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/meals`,
    });

    expect(res.statusCode).toBe(401);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PATCH /api/meals/:id
// ────────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/meals/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('marks meal as uploaded and returns full meal row', async () => {
    // DB: meal+pod lookup succeeds (owned by demo user)
    mockDbExecute.mockResolvedValueOnce([DEMO_MEAL_WITH_POD]);
    // DB: UPDATE RETURNING
    mockDbExecute.mockResolvedValueOnce([UPDATED_MEAL_ROW]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meals/${MEAL_ID}`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(MEAL_ID);
    expect(body.status).toBe('uploaded');
    expect(body.image_url).toBe(`meals/${POD_ID}/${MEAL_ID}.jpg`);
    expect(body.captured_at).not.toBeNull();
  });

  it('respects client-supplied imageUrl', async () => {
    mockDbExecute.mockResolvedValueOnce([DEMO_MEAL_WITH_POD]);
    const customImageUrl = 'meals/custom/path.jpg';
    mockDbExecute.mockResolvedValueOnce([{ ...UPDATED_MEAL_ROW, image_url: customImageUrl }]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meals/${MEAL_ID}`,
      headers: { ...authHeader, 'content-type': 'application/json' },
      payload: JSON.stringify({ imageUrl: customImageUrl }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.image_url).toBe(customImageUrl);
  });

  it('returns 404 MEAL_NOT_FOUND when meal does not exist', async () => {
    mockDbExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meals/${MEAL_ID}`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('MEAL_NOT_FOUND');
  });

  it('returns 404 MEAL_NOT_FOUND when meal belongs to a different user (tenant isolation)', async () => {
    // Meal found but owned by another user
    mockDbExecute.mockResolvedValueOnce([{ ...DEMO_MEAL_WITH_POD, user_id: 'usr_other_99' }]);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meals/${MEAL_ID}`,
      headers: authHeader,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('MEAL_NOT_FOUND');
    // UPDATE should NOT be called since ownership check fails
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when no bearer token is provided', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/meals/${MEAL_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });
});

