/**
 * Food module — hook unit tests.
 *
 * Uses MSW v2 to intercept fetch calls so tests never hit real API.
 * Each test spins up a fresh QueryClient to avoid cross-test state.
 *
 * Covered:
 *   - useCreatePod  → POST /api/pods with bearer header
 *   - usePodStatus  → polls while 'generating', stops when 'ready'
 *   - usePodcast    → disabled until pod.status === 'ready'
 *   - useUploadMealImage → PUTs bytes WITHOUT bearer header
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useCreatePod, usePodcast, usePodStatus, useUploadMealImage } from '../hooks';

// ─── Environment ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://test-api.example.railway.app';
const TEST_TOKEN = 'test-bearer-token-xyz';

process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN = TEST_TOKEN;

// ─── Fixture data ─────────────────────────────────────────────────────────────

const mockPodDraft = {
  id: 'pod-001',
  userId: 'usr_demo_01',
  status: 'draft',
  timespanDays: 10,
  mealsCount: 0,
  mealsList: [],
  stageStatus: {},
  createdAt: '2026-04-23T10:00:00Z',
};

const mockPodGenerating = { ...mockPodDraft, status: 'generating', mealsCount: 30 };
const mockPodReady = { ...mockPodDraft, status: 'ready', mealsCount: 30 };

const mockPodcast = {
  transcript: {
    segments: [{ startSec: 0, endSec: 5, text: 'Hello Sarah.', emphasisWords: ['Hello'] }],
    totalDurationSec: 300,
    title: 'Your Nutrition Podcast',
  },
  audioUrl: 'https://storage.example.com/podcast.mp3',
};

// ─── Captured request headers ─────────────────────────────────────────────────

const capturedHeaders: Record<string, string | null> = {};

function clearHeaders() {
  Object.keys(capturedHeaders).forEach((k) => {
    delete capturedHeaders[k];
  });
}

// ─── MSW server ───────────────────────────────────────────────────────────────

const defaultHandlers = [
  http.post(`${BASE_URL}/api/pods`, ({ request }) => {
    capturedHeaders['createPod-auth'] = request.headers.get('Authorization');
    return HttpResponse.json(mockPodDraft, { status: 201 });
  }),

  http.get(`${BASE_URL}/api/pods/:podId`, ({ request }) => {
    capturedHeaders['getPod-auth'] = request.headers.get('Authorization');
    return HttpResponse.json(mockPodReady);
  }),

  http.get(`${BASE_URL}/api/pods/:podId/podcast`, () => {
    return HttpResponse.json(mockPodcast);
  }),

  // Presigned URL (no bearer expected)
  http.put('https://storage.supabase.example.com/upload/:path', ({ request }) => {
    capturedHeaders['upload-auth'] = request.headers.get('Authorization');
    return new HttpResponse(null, { status: 200 });
  }),
];

const server = setupServer(...defaultHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearHeaders();
});
afterAll(() => server.close());

// ─── Wrapper helper ───────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCreatePod', () => {
  it('calls POST /api/pods and includes Authorization bearer header', async () => {
    const { result } = renderHook(() => useCreatePod(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ id: 'pod-001', status: 'draft' });
    expect(capturedHeaders['createPod-auth']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('returns error state when API returns non-2xx', async () => {
    server.use(
      http.post(`${BASE_URL}/api/pods`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useCreatePod(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('401');
  });
});

describe('usePodStatus', () => {
  it('fetches pod and returns data with bearer auth', async () => {
    const { result } = renderHook(() => usePodStatus('pod-001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ status: 'ready' });
    expect(capturedHeaders['getPod-auth']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('polls while status is "generating" and stops when "ready"', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE_URL}/api/pods/:podId`, () => {
        callCount++;
        // First 2 calls: generating; third onwards: ready
        const pod = callCount < 3 ? mockPodGenerating : mockPodReady;
        return HttpResponse.json(pod);
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          // Override stale time so refetch runs immediately
          staleTime: 0,
        },
        mutations: { retry: false },
      },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => usePodStatus('pod-001'), {
      wrapper: Wrapper,
    });

    // Wait until status reaches 'ready' (polling drives this)
    await waitFor(
      () => {
        expect(result.current.data?.status).toBe('ready');
      },
      { timeout: 15_000, interval: 500 },
    );

    // Verify we got multiple calls (polling happened)
    expect(callCount).toBeGreaterThanOrEqual(3);

    // After reaching 'ready', record call count and wait to confirm polling stopped
    const countAtReady = callCount;
    await new Promise<void>((resolve) => setTimeout(resolve, 2500));
    expect(callCount).toBe(countAtReady);
  }, 20_000);
});

describe('usePodcast', () => {
  it('is disabled when pod status is not "ready"', async () => {
    const { result } = renderHook(() => usePodcast('pod-001', 'draft'), {
      wrapper: createWrapper(),
    });

    // Query is disabled — should never fetch
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('is disabled when pod status is "generating"', async () => {
    const { result } = renderHook(() => usePodcast('pod-001', 'generating'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches podcast when pod status is "ready"', async () => {
    const { result } = renderHook(() => usePodcast('pod-001', 'ready'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      audioUrl: 'https://storage.example.com/podcast.mp3',
      transcript: { title: 'Your Nutrition Podcast', totalDurationSec: 300 },
    });
  });
});

describe('useUploadMealImage', () => {
  it('PUTs image bytes WITHOUT Authorization header', async () => {
    const presignedUrl = 'https://storage.supabase.example.com/upload/meal-1.jpg';
    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });

    const { result } = renderHook(() => useUploadMealImage(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ uploadUrl: presignedUrl, fileBlob: fakeBlob });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Authorization header must NOT be present on presigned URL upload
    expect(capturedHeaders['upload-auth']).toBeNull();
  });
});
