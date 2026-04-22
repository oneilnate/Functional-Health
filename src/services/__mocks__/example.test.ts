/**
 * Integration test for MSW v2 + vitest-native.
 * Proves the mock server integration works before PR 4 builds on top.
 *
 * Exercises:
 *   - Happy path: 200 response from GET /api/example
 *   - Error path:  500 response from GET /api/example?error=1
 */

import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { exampleHandlers } from './example.handlers';

const server = setupServer(...exampleHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const BASE_URL = 'https://api.example.com';

describe('example service — MSW integration', () => {
  it('happy path: returns example data on 200', async () => {
    const response = await fetch(`${BASE_URL}/api/example`);
    const data = (await response.json()) as { id: string; name: string };

    expect(response.status).toBe(200);
    expect(data.id).toBe('1');
    expect(data.name).toBe('Example');
  });

  it('error path: returns 500 when error param is set', async () => {
    const response = await fetch(`${BASE_URL}/api/example?error=1`);
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('error path: can override handler at runtime', async () => {
    const { http, HttpResponse } = await import('msw');

    server.use(
      http.get(`${BASE_URL}/api/example`, () =>
        HttpResponse.json({ error: 'Overridden error' }, { status: 503 }),
      ),
    );

    const response = await fetch(`${BASE_URL}/api/example`);
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(data.error).toBe('Overridden error');
  });
});
