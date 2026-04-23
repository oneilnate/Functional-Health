/**
 * food.service.ts unit tests.
 *
 * Verifies:
 *   - URL construction (base URL + correct paths)
 *   - Authorization bearer header on all API calls
 *   - uploadMealImage does NOT include Authorization header
 *   - Error propagation on non-2xx responses
 */

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  completePod,
  createMeal,
  createPod,
  getPod,
  getPodcast,
  patchMeal,
  uploadMealImage,
} from '../food.service';

// ─── Environment ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://test-api.example.railway.app';
const TEST_TOKEN = 'test-token-abc123';

process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN = TEST_TOKEN;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockPod = {
  id: 'pod-001',
  userId: 'usr_demo_01',
  status: 'draft',
  timespanDays: 10,
  mealsCount: 0,
  mealsList: [],
  stageStatus: {},
  createdAt: '2026-04-23T10:00:00Z',
};

const mockMealResponse = {
  mealId: 'meal-001',
  uploadUrl: 'https://storage.supabase.example.com/upload/meal-001.jpg',
  storagePath: 'meals/pod-001/meal-001.jpg',
};

const mockMeal = {
  id: 'meal-001',
  podId: 'pod-001',
  status: 'uploaded',
};

const mockPodcast = {
  transcript: {
    segments: [{ startSec: 0, endSec: 5, text: 'Hello.', emphasisWords: [] }],
    totalDurationSec: 300,
    title: 'Your Podcast',
  },
  audioUrl: 'https://storage.example.com/podcast.mp3',
};

// ─── Captured request data ────────────────────────────────────────────────────

const capturedRequests: {
  method?: string;
  url?: string;
  auth?: string | null;
  body?: unknown;
}[] = [];

function clearCaptures() {
  capturedRequests.length = 0;
}

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.post(`${BASE_URL}/api/pods`, async ({ request }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return HttpResponse.json(mockPod, { status: 201 });
  }),

  http.get(`${BASE_URL}/api/pods/:podId`, ({ request, params }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return HttpResponse.json({ ...mockPod, id: params.podId as string });
  }),

  http.post(`${BASE_URL}/api/pods/:podId/complete`, ({ request, params }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return HttpResponse.json({ ...mockPod, id: params.podId as string, status: 'generating' });
  }),

  http.post(`${BASE_URL}/api/pods/:podId/meals`, ({ request }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return HttpResponse.json(mockMealResponse, { status: 201 });
  }),

  http.patch(`${BASE_URL}/api/meals/:mealId`, async ({ request, params }) => {
    const body = await request.json();
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
      body,
    });
    return HttpResponse.json({ ...mockMeal, id: params.mealId as string });
  }),

  http.get(`${BASE_URL}/api/pods/:podId/podcast`, ({ request }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return HttpResponse.json(mockPodcast);
  }),

  http.put('https://storage.supabase.example.com/upload/:path', ({ request }) => {
    capturedRequests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get('Authorization'),
    });
    return new HttpResponse(null, { status: 200 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearCaptures();
});
afterAll(() => server.close());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createPod', () => {
  it('POSTs to /api/pods with bearer token and returns pod', async () => {
    const pod = await createPod();
    expect(pod).toMatchObject({ id: 'pod-001', status: 'draft' });
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/pods`);
    expect(req?.method).toBe('POST');
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('getPod', () => {
  it('GETs /api/pods/:podId with bearer token', async () => {
    const pod = await getPod('pod-001');
    expect(pod.id).toBe('pod-001');
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/pods/pod-001`);
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('completePod', () => {
  it('POSTs to /api/pods/:podId/complete with bearer token', async () => {
    const pod = await completePod('pod-001');
    expect(pod.status).toBe('generating');
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/pods/pod-001/complete`);
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('createMeal', () => {
  it('POSTs to /api/pods/:podId/meals with bearer token and returns upload URL', async () => {
    const res = await createMeal('pod-001');
    expect(res).toMatchObject({
      mealId: 'meal-001',
      uploadUrl: expect.stringContaining('supabase'),
    });
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/pods/pod-001/meals`);
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('patchMeal', () => {
  it('PATCHes /api/meals/:mealId with status=uploaded and bearer token', async () => {
    const meal = await patchMeal('meal-001');
    expect(meal.status).toBe('uploaded');
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/meals/meal-001`);
    expect(req?.body).toEqual({ status: 'uploaded' });
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('getPodcast', () => {
  it('GETs /api/pods/:podId/podcast with bearer token', async () => {
    const podcast = await getPodcast('pod-001');
    expect(podcast.audioUrl).toBe('https://storage.example.com/podcast.mp3');
    const req = capturedRequests[0];
    expect(req?.url).toBe(`${BASE_URL}/api/pods/pod-001/podcast`);
    expect(req?.auth).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

describe('uploadMealImage', () => {
  it('PUTs to the presigned URL WITHOUT Authorization header', async () => {
    const presignedUrl = 'https://storage.supabase.example.com/upload/meal-001.jpg';
    const blob = new Blob(['bytes'], { type: 'image/jpeg' });
    await uploadMealImage(presignedUrl, blob);

    const req = capturedRequests[0];
    expect(req?.method).toBe('PUT');
    expect(req?.url).toBe(presignedUrl);
    // Presigned URL auth comes from the URL itself — NO Authorization header
    expect(req?.auth).toBeNull();
  });

  it('throws on non-2xx response from storage', async () => {
    server.use(
      http.put(
        'https://storage.supabase.example.com/upload/:path',
        () => new HttpResponse('Access Denied', { status: 403 }),
      ),
    );
    const blob = new Blob(['bytes'], { type: 'image/jpeg' });
    await expect(
      uploadMealImage('https://storage.supabase.example.com/upload/bad.jpg', blob),
    ).rejects.toThrow('403');
  });
});

describe('error propagation', () => {
  it('createPod throws on 500', async () => {
    server.use(
      http.post(`${BASE_URL}/api/pods`, () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    await expect(createPod()).rejects.toThrow('500');
  });

  it('getPod throws on 404', async () => {
    server.use(
      http.get(`${BASE_URL}/api/pods/:podId`, () =>
        HttpResponse.json({ error: 'Not Found' }, { status: 404 }),
      ),
    );
    await expect(getPod('missing')).rejects.toThrow('404');
  });
});
