/**
 * Tests for POST /api/pods and GET /api/pods/:id.
 *
 * Strategy: build a real Fastify instance with the auth plugin and pod routes
 * registered, mock `src/db/client.ts` and `src/env.ts` so no real DB or
 * environment is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

// ── Mock env ──────────────────────────────────────────────────────────────────
const TEST_TOKEN = 'test-bearer-token-secret';

vi.mock('../env.js', () => ({
  env: {
    DEMO_USER_BEARER_TOKEN: TEST_TOKEN,
    NODE_ENV: 'test',
    PORT: 3000,
    SUPABASE_URL: 'postgresql://localhost:5432/test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
  },
}));

// ── Mock DB client ────────────────────────────────────────────────────────────
const mockExecute = vi.fn();

vi.mock('../db/client.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const DEMO_USER_ID = 'usr_demo_01';
const OTHER_USER_ID = 'usr_other_01';

const FRESH_POD_ROW = {
  id: '00000000-0000-0000-0000-000000000001',
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

// ── App builder ───────────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({ logger: false });

  // Dynamic imports so mocks are applied before modules load
  const { bearerAuthPlugin } = await import('../middleware/auth.js');
  const { podRoutes } = await import('../routes/pods.js');

  await app.register(bearerAuthPlugin);
  await app.register(podRoutes);

  return app;
}

// ── POST /api/pods ────────────────────────────────────────────────────────────
describe('POST /api/pods', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  it('creates a pod and returns 201 with expected shape', async () => {
    // INSERT RETURNING resolves with the new pod row
    mockExecute.mockResolvedValueOnce([FRESH_POD_ROW]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/pods',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    // Shape matches mobile Pod type (camelCase)
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

    // DB was called once (INSERT)
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns 401 AUTH_MISSING_TOKEN when no token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pods',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_MISSING_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_INVALID_TOKEN when wrong token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pods',
      headers: { authorization: 'Bearer totally-wrong-token' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ── GET /api/pods/:id ─────────────────────────────────────────────────────────
describe('GET /api/pods/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  it('returns 200 with pod and empty mealsList for a fresh pod', async () => {
    // First execute call: SELECT pod; second: SELECT meals
    mockExecute
      .mockResolvedValueOnce([FRESH_POD_ROW]) // pod query
      .mockResolvedValueOnce([]);              // meals query (empty)

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${FRESH_POD_ROW.id}`,
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
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
    // Pod query returns empty — not found
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pods/nonexistent-id',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      error: 'not_found',
      code: 'POD_NOT_FOUND',
    });
  });

  it('returns 404 POD_NOT_FOUND for a pod owned by a different user (no 403 cross-tenant leak)', async () => {
    // The DB query includes AND user_id = ${userId}, so a pod owned by
    // OTHER_USER_ID returns no rows for the demo user. The handler sees
    // an empty result and returns 404 — matching the scoping contract.
    mockExecute.mockResolvedValueOnce([]); // scoped query finds nothing

    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${OTHER_USER_POD_ROW.id}`,
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      error: 'not_found',
      code: 'POD_NOT_FOUND',
    });
    // Meals query must NOT be called when pod lookup fails
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns 401 AUTH_MISSING_TOKEN when no token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${FRESH_POD_ROW.id}`,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_MISSING_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_INVALID_TOKEN when wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/pods/${FRESH_POD_ROW.id}`,
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

