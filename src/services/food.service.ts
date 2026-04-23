/**
 * Food Service — API client for FoodPod endpoints.
 * All fetch calls for the food module live here per repo architecture contract.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://pear-sandbox.everbetter.com';

const BEARER = process.env.EXPO_PUBLIC_DEMO_BEARER_TOKEN ?? '';

function authHeaders(): Record<string, string> {
  if (BEARER) return { Authorization: `Bearer ${BEARER}` };
  return {};
}

export interface PodImage {
  id: string;
  uri: string;
  capturedAt: string;
  thumbsUp: boolean;
}

export interface PodData {
  id: string;
  capturedCount: number;
  targetCount: number;
  status: 'capturing' | 'generating' | 'ready';
  images: PodImage[];
}

export interface EpisodeData {
  id: string;
  podId: string;
  status: 'pending' | 'generating' | 'ready';
  audioUrl: string | null;
  summary: string | null;
  durationSeconds: number | null;
}

export async function getPod(podId: string): Promise<PodData> {
  const res = await fetch(`${API_BASE}/api/pods/${podId}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw new Error(`getPod failed: ${res.status}`);
  return res.json() as Promise<PodData>;
}

export async function uploadImage(podId: string, uri: string): Promise<void> {
  const formData = new FormData();
  // React Native FormData accepts { uri, name, type } object
  formData.append('image', { uri, name: 'meal.jpg', type: 'image/jpeg' } as unknown as Blob);
  const res = await fetch(`${API_BASE}/api/pods/${podId}/images`, {
    method: 'POST',
    body: formData,
    headers: authHeaders(),
  });
  // 404 is acceptable while backend deploys — caller handles
  if (!res.ok && res.status !== 404) throw new Error(`uploadImage failed: ${res.status}`);
}

export async function completePod(podId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/pods/${podId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok && res.status !== 404) throw new Error(`completePod failed: ${res.status}`);
}

export async function getEpisode(podId: string): Promise<EpisodeData> {
  const res = await fetch(`${API_BASE}/api/pods/${podId}/episode`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw new Error(`getEpisode failed: ${res.status}`);
  return res.json() as Promise<EpisodeData>;
}
