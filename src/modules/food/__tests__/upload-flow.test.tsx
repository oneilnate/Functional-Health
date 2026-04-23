/**
 * upload-flow.test.tsx — 3-step upload flow integration test.
 *
 * Mounts the CaptureScreen logic via hooks (not the full component) so we can
 * test the MSW-mocked API interactions without triggering expo-image-picker's
 * native module. The test verifies:
 *
 *   1. useCreateMeal  → POST /api/pods/:podId/meals → returns mealId + uploadUrl
 *   2. useUploadMealImage → PUT <presigned URL> → no Authorization header
 *   3. usePatchMeal   → PATCH /api/meals/:mealId → status = 'uploaded'
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { useCreateMeal, usePatchMeal, useUploadMealImage } from '../hooks';

// ─── Environment ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://test-api.example.railway.app';
const TEST_TOKEN = 'test-bearer-token-xyz';
const PRESIGNED_URL = 'https://storage.supabase.example.com/upload/meal-99.jpg';
const POD_ID = 'pod-upload-test-001';
const MEAL_ID = 'meal-upload-test-001';
const STORAGE_PATH = `meals/${MEAL_ID}/photo.jpg`;

process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN = TEST_TOKEN;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockCreateMealResponse = {
  mealId: MEAL_ID,
  uploadUrl: PRESIGNED_URL,
  storagePath: STORAGE_PATH,
};

const mockMealPatched = {
  id: MEAL_ID,
  podId: POD_ID,
  status: 'uploaded',
  imageUrl: STORAGE_PATH,
  capturedAt: '2026-04-23T17:00:00Z',
};

// ─── Captured request state ───────────────────────────────────────────────────

const capturedRequests = {
  createMealAuth: null as string | null,
  uploadAuth: null as string | null,
  patchMealBody: null as string | null,
};

function clearCaptured() {
  capturedRequests.createMealAuth = null;
  capturedRequests.uploadAuth = null;
  capturedRequests.patchMealBody = null;
}

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.post(`${BASE_URL}/api/pods/:podId/meals`, ({ request }) => {
    capturedRequests.createMealAuth = request.headers.get('Authorization');
    return HttpResponse.json(mockCreateMealResponse, { status: 201 });
  }),

  http.put(PRESIGNED_URL, ({ request }) => {
    capturedRequests.uploadAuth = request.headers.get('Authorization');
    return new HttpResponse(null, { status: 200 });
  }),

  http.patch(`${BASE_URL}/api/meals/:mealId`, async ({ request }) => {
    capturedRequests.patchMealBody = await request.text();
    return HttpResponse.json(mockMealPatched, { status: 200 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  clearCaptured();
});
afterAll(() => server.close());

// ─── Helper ───────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('3-step upload flow', () => {
  it('step 1: POST /api/pods/:podId/meals with bearer auth → returns mealId + uploadUrl', async () => {
    const { result } = renderHook(() => useCreateMeal(POD_ID), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      mealId: MEAL_ID,
      uploadUrl: PRESIGNED_URL,
      storagePath: STORAGE_PATH,
    });
    expect(capturedRequests.createMealAuth).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('step 2: PUT presigned URL without Authorization header (direct to Storage)', async () => {
    const fakeBlob = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
    const { result } = renderHook(() => useUploadMealImage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ uploadUrl: PRESIGNED_URL, fileBlob: fakeBlob });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No Authorization header must appear on the presigned URL upload
    expect(capturedRequests.uploadAuth).toBeNull();
  });

  it('step 3: PATCH /api/meals/:mealId sets status = uploaded', async () => {
    const { result } = renderHook(() => usePatchMeal(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(MEAL_ID);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ id: MEAL_ID, status: 'uploaded' });
    // Body sent to PATCH should contain status: uploaded
    const body = JSON.parse(capturedRequests.patchMealBody ?? '{}') as Record<string, unknown>;
    expect(body).toMatchObject({ status: 'uploaded' });
  });

  it('full sequential flow: createMeal → uploadImage → patchMeal', async () => {
    const wrapper = createWrapper();

    const createMealHook = renderHook(() => useCreateMeal(POD_ID), { wrapper });
    const uploadHook = renderHook(() => useUploadMealImage(), { wrapper });
    const patchHook = renderHook(() => usePatchMeal(), { wrapper });

    // Step 1
    act(() => {
      createMealHook.result.current.mutate(undefined);
    });
    await waitFor(() => expect(createMealHook.result.current.isSuccess).toBe(true));
    const uploadData = createMealHook.result.current.data;
    expect(uploadData).toBeDefined();
    const { mealId, uploadUrl } = uploadData as { mealId: string; uploadUrl: string };

    // Step 2
    const fakeBlob = new Blob(['bytes'], { type: 'image/jpeg' });
    act(() => {
      uploadHook.result.current.mutate({ uploadUrl, fileBlob: fakeBlob });
    });
    await waitFor(() => expect(uploadHook.result.current.isSuccess).toBe(true));

    // Step 3
    act(() => {
      patchHook.result.current.mutate(mealId);
    });
    await waitFor(() => expect(patchHook.result.current.isSuccess).toBe(true));

    expect(patchHook.result.current.data?.status).toBe('uploaded');
    // Verify bearer on steps 1 and 3 but not step 2
    expect(capturedRequests.createMealAuth).toBe(`Bearer ${TEST_TOKEN}`);
    expect(capturedRequests.uploadAuth).toBeNull();
  });

  it('upload error → hook enters error state', async () => {
    server.use(http.put(PRESIGNED_URL, () => new HttpResponse('Forbidden', { status: 403 })));

    const fakeBlob = new Blob(['bytes'], { type: 'image/jpeg' });
    const { result } = renderHook(() => useUploadMealImage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ uploadUrl: PRESIGNED_URL, fileBlob: fakeBlob });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('403');
  });

  it('patchMeal error → hook enters error state', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/meals/:mealId`, () =>
        HttpResponse.json({ error: 'Not found' }, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => usePatchMeal(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(MEAL_ID);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('404');
  });
});
