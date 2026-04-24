/**
 * pod-screen.test.tsx — Integration tests for the pod screen hook layer.
 *
 * Tests the React Query hooks used by PodScreen:
 *   - usePodStatus: polls while 'generating', stops when 'ready'
 *   - usePodcast: disabled until pod is 'ready', then fetches
 *   - useCompletePod: POST /api/pods/:id/complete (retry flow)
 *
 * Does NOT test expo-av (native module) or actual screen rendering.
 * Screen behaviour is covered by Appetize device-preview in CI.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useCompletePod, usePodcast, usePodStatus } from '../hooks';

// ─── Environment ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://test-api.example.railway.app';
const TEST_TOKEN = 'test-bearer-pod-screen';

process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN = TEST_TOKEN;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const POD_ID = 'pod-screen-test-001';

const mockPodGenerating = {
  id: POD_ID,
  userId: 'usr_demo_01',
  status: 'generating',
  timespanDays: 10,
  mealsCount: 30,
  mealsList: [],
  stageStatus: {
    vision: { status: 'complete', completedAt: '2026-04-23T18:00:00Z' },
    grounding: { status: 'running', startedAt: '2026-04-23T18:00:05Z' },
    script: { status: 'pending' },
    tts: { status: 'pending' },
    upload: { status: 'pending' },
  },
  createdAt: '2026-04-23T17:55:00Z',
};

const mockPodReady = {
  ...mockPodGenerating,
  status: 'ready',
  completedAt: '2026-04-23T18:05:00Z',
  stageStatus: {
    vision: { status: 'complete' },
    grounding: { status: 'complete' },
    script: { status: 'complete' },
    tts: { status: 'complete' },
    upload: { status: 'complete' },
  },
};

const mockPodFailed = {
  ...mockPodGenerating,
  status: 'failed',
};

const mockPodcast = {
  transcript: {
    segments: [
      {
        startSec: 0,
        endSec: 8,
        text: 'Welcome Sarah, here is your nutrition summary.',
        emphasisWords: [],
      },
      {
        startSec: 8,
        endSec: 18,
        text: 'Your protein intake was strong this week.',
        emphasisWords: ['protein'],
      },
    ],
    totalDurationSec: 320,
    title: 'Your Weekly Nutrition Podcast',
  },
  audioUrl: 'https://storage.example.com/podcasts/pod-screen-test-001.mp3',
};

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.get(`${BASE_URL}/api/pods/:podId`, () => HttpResponse.json(mockPodReady)),
  http.get(`${BASE_URL}/api/pods/:podId/podcast`, () => HttpResponse.json(mockPodcast)),
  http.post(`${BASE_URL}/api/pods/:podId/complete`, () =>
    HttpResponse.json(mockPodGenerating, { status: 200 }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const W = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return W;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePodStatus — generating → ready', () => {
  it('returns generating pod with stageStatus populated', async () => {
    server.use(http.get(`${BASE_URL}/api/pods/:podId`, () => HttpResponse.json(mockPodGenerating)));
    const { result } = renderHook(() => usePodStatus(POD_ID), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('generating');
    expect(result.current.data?.stageStatus?.vision?.status).toBe('complete');
    expect(result.current.data?.stageStatus?.grounding?.status).toBe('running');
  });

  it('returns ready pod when pipeline completes', async () => {
    const { result } = renderHook(() => usePodStatus(POD_ID), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('ready');
  });
});

describe('usePodcast — gate on pod status', () => {
  it('stays disabled when pod is generating', async () => {
    const { result } = renderHook(() => usePodcast(POD_ID, 'generating'), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches podcast transcript and audioUrl when pod is ready', async () => {
    const { result } = renderHook(() => usePodcast(POD_ID, 'ready'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.audioUrl).toBe(
      'https://storage.example.com/podcasts/pod-screen-test-001.mp3',
    );
    expect(result.current.data?.transcript.segments).toHaveLength(2);
    expect(result.current.data?.transcript.segments[0]?.startSec).toBe(0);
    expect(result.current.data?.transcript.segments[1]?.startSec).toBe(8);
  });
});

describe('useCompletePod — retry flow', () => {
  it('POSTs to /api/pods/:id/complete and re-starts generation', async () => {
    const { result } = renderHook(() => useCompletePod(), { wrapper: createWrapper() });
    result.current.mutate(POD_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('generating');
  });

  it('returns error state when API returns 500', async () => {
    server.use(
      http.post(`${BASE_URL}/api/pods/:podId/complete`, () =>
        HttpResponse.json({ error: 'Internal error' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCompletePod(), { wrapper: createWrapper() });
    result.current.mutate(POD_ID);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('500');
  });

  it('handles failed pod status with a retry', async () => {
    server.use(http.get(`${BASE_URL}/api/pods/:podId`, () => HttpResponse.json(mockPodFailed)));
    const { result: podResult } = renderHook(() => usePodStatus(POD_ID), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(podResult.current.isSuccess).toBe(true));
    expect(podResult.current.data?.status).toBe('failed');
  });
});
