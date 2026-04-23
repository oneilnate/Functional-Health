/**
 * Tests for all pod routes:
 *   POST /api/pods              (F2-E2)
 *   GET  /api/pods/:id          (F2-E2)
 *   POST /api/pods/:id/complete (F2-E4)
 *   GET  /api/pods/:id/podcast  (F2-E4)
 *
 * All DB and Supabase Storage calls are mocked; no real DB is needed.
 * runPipeline stub is spied on to verify fire-and-forget behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// ── Constants ──────────────────────────────────────────────────────────────────
const TEST_TOKEN = 'test-bearer-token-secret';
const DEMO_USER_ID = 'usr_demo_01';
const OTHER_USER_ID = 'usr_other_01';
const POD_ID = '00000000-0000-0000-0000-000000000001';
const SIGNED_URL = 'https://storage.example.com/pods/podcast.mp3?token=signed';

// ── Hoisted mock fns (must be declared before vi.mock calls) ───────────────────
const { mockExecute, mockCreateSignedUrl, mockRunPipeline } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockRunPipeline: vi.fn().mockResolvedValue(undefined),
}));

// ── Module mocks ───────────────────────────────────────────────────────────────
vi.mock('../env.js', () => ({
  env: {
    DEMO_USER_BEARER_TOKEN: TEST_TOKEN,
    NODE_ENV: 'test',
    PORT: 3000,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-pro',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  },
}));

vi.mock('../db/client.js', () => ({
  db: { execute: mockExecute },
}));

vi.mock('../db/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: (_bucket: string) => ({ createSignedUrl: mockCreateSignedUrl }),
    },
  },
}));

vi.mock('../pipeline/run.js', () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

// ── App builder ────────────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({ logger: false });
  const { bearerAuthPlugin } = await import('../middleware/auth.js');
  const { podRoutes } = await import('../routes/pods.js');
  await app.register(bearerAuthPlugin);
  await app.register(podRoutes);
  await app.ready();
  return app;
}

const AUTH = { authorization: `Bearer ${TEST_TOKEN}` };

// ── Fixtures ───────────────────────────────────────────────────────────────────
const FRESH_POD_ROW = {
  id: POD_ID,
  user_id: DEMO_USER_ID,
  status: 'draft',
  timespan_days: 10,
  meals_count: 0,
  grounded_facts: null,
  stage_status: {},
  created_at: '2026-04-23T17:00:00.000Z',
  completed_at: null,
};

const OTHER_USER_POD_ROW = {
  ...FRESH_POD_ROW,
  id: '00000000-0000-0000-0000-000000000002',
  user_id: OTHER_USER_ID,
};

const draftPod = { id: POD_ID, user_id: DEMO_USER_ID, status: 'draft', stage_status: {} };
const generatingPod = { id: POD_ID, user_id: DEMO_USER_ID, status: 'generating', stage_status: {} };
const readyPod = { id: POD_ID, user_id: DEMO_USER_ID, status: 'ready', stage_status: {} };
const failedPod = { id: POD_ID, user_id: DEMO_USER_ID, status: 'failed', stage_status: {} };
const otherUserPod = { id: POD_ID, user_id: OTHER_USER_ID, status: 'draft', stage_status: {} };

const podcastRow = {
  id: 'pc_01',
  pod_id: POD_ID,
  transcript_json: [{ text: 'Hello world' }],
  mp3_storage_path: `${POD_ID}/podcast.mp3`,
  duration_seconds: '300.00',
};

// ── POST /api/pods (F2-E2) ─────────────────────────────────────────────────────
describe('POST /api/pods', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it('creates a pod and returns 201 with expected shape', async () => {
    mockExecute.mockResolvedValueOnce([FRESH_POD_ROW]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/pods',
      headers: AUTH,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    expect(typeof body.id).toBe('string');
    expect(body.id).toBe(FRESH_POD_ROW.id);
    expect(body.userId).toBe(DEMO_USER_ID);
    expect(body.status).toBe('draft');
    expect(body.timespanDays).toBe(10);
    expect(body.mealsCount).toBe(0);
    expect(body.stageStatus).toBeDefined();
    expect(typeof body.createdAt).toBe('string');
    expect(Array.isArray(body.mealsList)).toBe(true);
    expect(body.mealsList).toHaveLength(0);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns 401 AUTH_MISSING_TOKEN when no token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/pods' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('AUTH_MISSING_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_INVALID_TOKEN when wrong token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pods',
      headers: { authorization: 'Bearer totally-wrong-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('AUTH_INVALID_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── GET /api/pods/:id (F2-E2) ──────────────────────────────────────────────────
describe('GET /api/pods/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it('returns 200 with pod and empty mealsList for a fresh pod', async () => {
    mockExecute
      .mockResolvedValueOnce([FRESH_POD_ROW])
      .mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${FRESH_POD_ROW.id}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(FRESH_POD_ROW.id);
    expect(body.userId).toBe(DEMO_USER_ID);
    expect(body.status).toBe('draft');
    expect(body.timespanDays).toBe(10);
    expect(body.mealsCount).toBe(0);
    expect(Array.isArray(body.mealsList)).toBe(true);
    expect(body.mealsList).toHaveLength(0);
    expect(body.stageStatus).toBeDefined();
    expect(typeof body.createdAt).toBe('string');
  });

  it('returns 404 POD_NOT_FOUND for nonexistent id', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pods/nonexistent-id',
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'not_found', code: 'POD_NOT_FOUND' });
  });

  it('returns 404 POD_NOT_FOUND for a pod owned by a different user (no 403 cross-tenant leak)', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${OTHER_USER_POD_ROW.id}`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'not_found', code: 'POD_NOT_FOUND' });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns 401 AUTH_MISSING_TOKEN when no token', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/pods/${FRESH_POD_ROW.id}` });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('AUTH_MISSING_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_INVALID_TOKEN when wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${FRESH_POD_ROW.id}`,
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('AUTH_INVALID_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── POST /api/pods/:id/complete (F2-E4) ────────────────────────────────────────
describe('POST /api/pods/:id/complete', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it('returns 202 and generating status when pod has >= 1 uploaded meal', async () => {
    mockExecute
      .mockResolvedValueOnce([draftPod])
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body) as { id: string; status: string };
    expect(body.id).toBe(POD_ID);
    expect(body.status).toBe('generating');
    expect(mockExecute).toHaveBeenCalledTimes(3);
    await Promise.resolve();
    expect(mockRunPipeline).toHaveBeenCalledWith(POD_ID);
  });

  it('returns 400 POD_EMPTY when pod has 0 uploaded meals', async () => {
    mockExecute
      .mockResolvedValueOnce([draftPod])
      .mockResolvedValueOnce([{ count: '0' }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string; code: string };
    expect(body.error).toBe('no_meals');
    expect(body.code).toBe('POD_EMPTY');
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  it('returns 404 POD_NOT_FOUND when pod does not exist', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('POD_NOT_FOUND');
  });

  it('returns 404 when pod belongs to a different user (tenant isolation)', async () => {
    mockExecute.mockResolvedValueOnce([otherUserPod]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('POD_NOT_FOUND');
  });

  it('returns 401 when no bearer token is supplied', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/pods/${POD_ID}/complete` });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /api/pods/:id/podcast (F2-E4) ─────────────────────────────────────────
describe('GET /api/pods/:id/podcast', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it("returns 404 PODCAST_NOT_READY when pod.status = 'draft'", async () => {
    mockExecute.mockResolvedValueOnce([draftPod]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('PODCAST_NOT_READY');
  });

  it("returns 404 PODCAST_NOT_READY when pod.status = 'generating'", async () => {
    mockExecute.mockResolvedValueOnce([generatingPod]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('PODCAST_NOT_READY');
  });

  it("returns 200 with transcript and audioUrl when pod.status = 'ready'", async () => {
    mockExecute
      .mockResolvedValueOnce([readyPod])
      .mockResolvedValueOnce([podcastRow]);
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      transcript: unknown;
      audioUrl: string;
      durationSeconds: number;
    };
    expect(body.audioUrl).toBe(SIGNED_URL);
    expect(body.transcript).toEqual(podcastRow.transcript_json);
    expect(body.durationSeconds).toBe(300);
  });

  it("returns 404 PODCAST_NOT_READY when pod.status = 'failed'", async () => {
    mockExecute.mockResolvedValueOnce([failedPod]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('PODCAST_NOT_READY');
  });

  it('returns 404 POD_NOT_FOUND for non-existent pod', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('POD_NOT_FOUND');
  });

  it("returns 404 POD_NOT_FOUND for another user's pod (tenant isolation)", async () => {
    mockExecute.mockResolvedValueOnce([otherUserPod]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${POD_ID}/podcast`,
      headers: AUTH,
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('POD_NOT_FOUND');
  });
});

// ── runPipeline stub spy ────────────────────────────────────────────────────────
describe('runPipeline stub spy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    app = await buildApp();
  });

  it('calls runPipeline with the pod ID on a successful complete', async () => {
    mockExecute
      .mockResolvedValueOnce([draftPod])
      .mockResolvedValueOnce([{ count: '3' }])
      .mockResolvedValueOnce([]);

    await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    await Promise.resolve();
    expect(mockRunPipeline).toHaveBeenCalledOnce();
    expect(mockRunPipeline).toHaveBeenCalledWith(POD_ID);
  });

  it('does NOT call runPipeline when validation fails (empty pod)', async () => {
    mockExecute
      .mockResolvedValueOnce([draftPod])
      .mockResolvedValueOnce([{ count: '0' }]);

    await app.inject({
      method: 'POST',
      url: `/api/pods/${POD_ID}/complete`,
      headers: AUTH,
    });

    await Promise.resolve();
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });
});
