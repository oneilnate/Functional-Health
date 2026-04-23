/**
 * Food Service — sole networking layer for the Food Pod feature.
 *
 * ARCHITECTURE RULE: This is the ONLY file in the repo where fetch() is called
 * for food-related API operations. Screens and modules MUST NOT call fetch()
 * directly — they delegate to the functions exported here.
 *
 * Authentication:
 * MVP: reads EXPO_PUBLIC_DEMO_BEARER_TOKEN from env vars (shared single-user token).
 * Replace with expo-secure-store + magic link in Phase 2.
 *
 * API base:
 * Reads EXPO_PUBLIC_API_BASE_URL from env vars (Railway URL set via eas.json).
 */

import type { CreateMealResponse, Meal, Pod, Podcast } from '@/modules/food/types';

/** Resolve base URL from Expo public env var (injected at build time). */
function getApiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. Configure it in eas.json or .env.');
  }
  return base.replace(/\/$/, '');
}

/**
 * Resolve bearer token from Expo public env var.
 * MVP: single shared demo token. Phase 2: expo-secure-store + magic link.
 */
function getBearerToken(): string {
  const token = process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN;
  if (!token) {
    throw new Error('EXPO_PUBLIC_DEMO_BEARER_TOKEN is not set. Configure it in eas.json or .env.');
  }
  return token;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getBearerToken()}`,
    'Content-Type': 'application/json',
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Pod endpoints ────────────────────────────────────────────────────────────

/** POST /api/pods — create a new pod for the current user */
export async function createPod(): Promise<Pod> {
  const res = await fetch(`${getApiBaseUrl()}/api/pods`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseResponse<Pod>(res);
}

/** GET /api/pods/:podId — fetch current pod status */
export async function getPod(podId: string): Promise<Pod> {
  const res = await fetch(`${getApiBaseUrl()}/api/pods/${podId}`, {
    headers: authHeaders(),
  });
  return parseResponse<Pod>(res);
}

/** POST /api/pods/:podId/complete — trigger podcast generation */
export async function completePod(podId: string): Promise<Pod> {
  const res = await fetch(`${getApiBaseUrl()}/api/pods/${podId}/complete`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseResponse<Pod>(res);
}

// ─── Meal endpoints ───────────────────────────────────────────────────────────

/**
 * POST /api/pods/:podId/meals — register a new meal and get an upload URL.
 * Returns { mealId, uploadUrl, storagePath } for the caller to upload the image.
 */
export async function createMeal(podId: string): Promise<CreateMealResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/pods/${podId}/meals`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseResponse<CreateMealResponse>(res);
}

/**
 * PATCH /api/meals/:mealId — mark meal as uploaded after the image is in storage.
 * Caller sets status to 'uploaded'.
 */
export async function patchMeal(mealId: string): Promise<Meal> {
  const res = await fetch(`${getApiBaseUrl()}/api/meals/${mealId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'uploaded' }),
  });
  return parseResponse<Meal>(res);
}

// ─── Podcast endpoint ─────────────────────────────────────────────────────────

/** GET /api/pods/:podId/podcast — fetch the completed podcast */
export async function getPodcast(podId: string): Promise<Podcast> {
  const res = await fetch(`${getApiBaseUrl()}/api/pods/${podId}/podcast`, {
    headers: authHeaders(),
  });
  return parseResponse<Podcast>(res);
}

// ─── Storage upload ───────────────────────────────────────────────────────────

/**
 * PUT <presignedUrl> — upload raw image bytes directly to Supabase Storage.
 * Does NOT include Authorization header — the presigned URL carries its own auth.
 * Bypasses the API server; upload goes directly to Supabase.
 */
export async function uploadMealImage(presignedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Storage upload failed HTTP ${res.status}: ${text}`);
  }
}

// Re-export Meal type so consumers can import from service if preferred
export type { Meal } from '@/modules/food/types';
