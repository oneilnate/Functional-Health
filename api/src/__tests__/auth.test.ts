/**
 * Tests for bearer auth middleware + GET /api/me endpoint.
 *
 * Strategy: build a real Fastify instance with the auth plugin and me route
 * registered, but mock `src/db/client.ts` and `src/env.ts` so no real DB or
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
    SUPABASE_URL: 'https://localhost.supabase.co',
    SUPABASE_DB_URL: 'postgresql://localhost:5432/test',
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const SARAH_CHEN_ROW = {
  id: 'usr_demo_01',
  email: 'demo@pear.everbetter.com',
  name: 'Sarah Chen',
  age: 32,
  height_cm: 165,
  weight_kg: '58.50',
  biological_sex: 'female',
  activity_level: 'moderately_active',
  dietary_prefs: { gluten_free: false, vegan: false },
  daily_targets: { calories: 1800, protein_g: 120 },
  created_at: '2026-04-23T00:00:00.000Z',
};

async function buildApp() {
  const app = Fastify({ logger: false });

  // Dynamic import so mocks are applied before the modules load
  const { bearerAuthPlugin } = await import('../middleware/auth.js');
  const { meRoutes } = await import('../routes/me.js');

  await app.register(bearerAuthPlugin);
  await app.register(meRoutes);

  return app;
}

// ── Auth middleware tests ─────────────────────────────────────────────────────
describe('bearerAuthPlugin', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();

    // Add a dummy /api/ping to confirm auth runs on /api/* routes
    app.get('/api/ping', async (_req, _reply) => ({ pong: true }));
    app.get('/health', async (_req, _reply) => ({ status: 'ok' }));

    await app.ready();
  });

  it('returns 401 AUTH_MISSING_TOKEN when no Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      error: 'unauthorized',
      code: 'AUTH_MISSING_TOKEN',
    });
  });

  it('returns 401 AUTH_INVALID_TOKEN when token is wrong', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      error: 'unauthorized',
      code: 'AUTH_INVALID_TOKEN',
    });
  });

  it('passes through when bearer token is correct', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ping',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ pong: true });
  });

  it('does NOT guard non-/api/* routes (e.g. /health)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
  });
});

// ── GET /api/me tests ─────────────────────────────────────────────────────────
describe('GET /api/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    await app.ready();
  });

  it('returns 200 with user row when token is valid and user exists', async () => {
    mockExecute.mockResolvedValueOnce([SARAH_CHEN_ROW]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    // Must match the UserRow shape from drizzle schema
    expect(body.id).toBe('usr_demo_01');
    expect(body.email).toBe('demo@pear.everbetter.com');
    expect(body.name).toBe('Sarah Chen');
    expect(typeof body.age).toBe('number');
    expect(body.height_cm).toBeDefined();
    expect(body.weight_kg).toBeDefined();
  });

  it('returns 401 AUTH_MISSING_TOKEN when no token is sent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_MISSING_TOKEN');
    // DB should never be called for unauthenticated requests
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 401 AUTH_INVALID_TOKEN when wrong token is sent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer totally-wrong-token' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 404 USER_NOT_SEEDED when user row does not exist', async () => {
    // Simulate F6-E1 not yet merged — empty result set
    mockExecute.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      error: 'user_not_found',
      code: 'USER_NOT_SEEDED',
    });
  });
});

