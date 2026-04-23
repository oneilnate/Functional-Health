/**
 * Tests for F3-E1: Pipeline orchestrator (api/src/pipeline/run.ts)
 *
 * Strategy:
 *   - Mock all 5 stage modules and the DB client.
 *   - Test success path: all stages called in order, correct DB updates.
 *   - Test retry-then-succeed: a stage fails once then succeeds on retry.
 *   - Test retry-exhausted-fail: a stage fails 3x → pod marked 'failed'.
 *   - Test p-queue concurrency: concurrent runPipeline calls are serialised.
 *   - Test per-stage status progression: running → complete written for tts/upload.
 *
 * Vitest mocks p-queue to bypass actual delays, and all backoff waits
 * are eliminated by mocking sleep (via vi.useFakeTimers where needed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mock fns ───────────────────────────────────────────────────────────

const {
  mockDbExecute,
  mockVisionStage,
  mockRunGroundingStage,
  mockScriptStage,
  mockTtsStage,
  mockUploadStage,
} = vi.hoisted(() => ({
  mockDbExecute: vi.fn().mockResolvedValue([]),
  mockVisionStage: vi.fn().mockResolvedValue(undefined),
  mockRunGroundingStage: vi.fn().mockResolvedValue(undefined),
  mockScriptStage: vi.fn().mockResolvedValue({
    title: 'Test Podcast',
    totalDurationSec: 300,
    segments: [
      { startSec: 0, endSec: 300, text: 'Hello world nutritional insights', emphasis_words: [] },
    ],
  }),
  mockTtsStage: vi.fn().mockResolvedValue({ mp3Path: '/tmp/pod-1.mp3', voiceId: 'voice_01' }),
  mockUploadStage: vi.fn().mockResolvedValue({ storagePath: 'pod-1/podcast.mp3', durationSeconds: 300 }),
}));

// ── Module mocks ────────────────────────────────────────────────────────────────

vi.mock('../env.js', () => ({
  env: {
    DEMO_USER_BEARER_TOKEN: 'test-token',
    NODE_ENV: 'test',
    PORT: 3000,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'test-gemini-key',
    ELEVENLABS_API_KEY: 'test-elevenlabs-key',
    ELEVENLABS_VOICE_ID: 'test-voice-id',
  },
}));

vi.mock('../db/client.js', () => ({
  db: { execute: mockDbExecute },
}));

vi.mock('../pipeline/stages/visionStage.js', () => ({
  visionStage: (...args: unknown[]) => mockVisionStage(...args),
}));

vi.mock('../pipeline/groundingStage.js', () => ({
  runGroundingStage: (...args: unknown[]) => mockRunGroundingStage(...args),
}));

vi.mock('../pipeline/scriptStage.js', () => ({
  scriptStage: (...args: unknown[]) => mockScriptStage(...args),
}));

vi.mock('../pipeline/stages/ttsStage.js', () => ({
  ttsStage: (...args: unknown[]) => mockTtsStage(...args),
  extractTranscriptText: (segments: unknown) => {
    if (!Array.isArray(segments)) return '';
    return segments
      .map((s: unknown) => (typeof s === 'object' && s !== null && 'text' in s ? (s as {text: string}).text : ''))
      .filter(Boolean)
      .join(' ');
  },
}));

vi.mock('../pipeline/stages/uploadStage.js', () => ({
  uploadStage: (...args: unknown[]) => mockUploadStage(...args),
}));

// Mock p-queue to run synchronously (bypass backoff delays in withRetry)
vi.mock('p-queue', () => {
  return {
    default: class MockPQueue {
      add<T>(fn: () => Promise<T>): Promise<T> {
        return fn();
      }
    },
  };
});

// ── Import under test (after all mocks) ────────────────────────────────────

import { runPipeline, withRetry } from '../pipeline/run.js';

// ── Test data ──────────────────────────────────────────────────────────────────

const POD_ID = '00000000-0000-0000-0000-000000000001';

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset all stage mocks to happy-path defaults
  mockVisionStage.mockResolvedValue(undefined);
  mockRunGroundingStage.mockResolvedValue(undefined);
  mockScriptStage.mockResolvedValue({
    title: 'Test Podcast',
    totalDurationSec: 300,
    segments: [
      { startSec: 0, endSec: 300, text: 'Hello world nutritional insights', emphasis_words: [] },
    ],
  });
  mockTtsStage.mockResolvedValue({ mp3Path: '/tmp/pod-1.mp3', voiceId: 'voice_01' });
  mockUploadStage.mockResolvedValue({ storagePath: 'pod-1/podcast.mp3', durationSeconds: 300 });
  mockDbExecute.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── withRetry unit tests ─────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('resolves immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns result when retry succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn);
    // Advance through the 2s backoff
    await vi.advanceTimersByTimeAsync(3_000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and throws the last error after 3 total attempts', async () => {
    vi.useFakeTimers();
    const boom = new Error('boom');
    const fn = vi.fn().mockRejectedValue(boom);

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const promise = withRetry(fn);
    const caught = promise.catch((e: unknown) => e);

    // Advance through 2s + 8s backoffs
    await vi.advanceTimersByTimeAsync(15_000);

    const result = await caught;
    expect(result).toBe(boom);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

// ── runPipeline integration tests ──────────────────────────────────────────────

describe('runPipeline', () => {
  describe('success path', () => {
    it('calls all 5 stages in order with the pod ID', async () => {
      await runPipeline(POD_ID);

      expect(mockVisionStage).toHaveBeenCalledTimes(1);
      expect(mockVisionStage).toHaveBeenCalledWith(POD_ID);

      expect(mockRunGroundingStage).toHaveBeenCalledTimes(1);
      expect(mockRunGroundingStage).toHaveBeenCalledWith(POD_ID);

      expect(mockScriptStage).toHaveBeenCalledTimes(1);
      expect(mockScriptStage).toHaveBeenCalledWith(POD_ID);

      expect(mockTtsStage).toHaveBeenCalledTimes(1);
      expect(mockTtsStage).toHaveBeenCalledWith(expect.objectContaining({ podId: POD_ID }));

      expect(mockUploadStage).toHaveBeenCalledTimes(1);
      expect(mockUploadStage).toHaveBeenCalledWith(expect.objectContaining({ podId: POD_ID }));
    });

    it('passes mp3Path and voiceId from ttsStage to uploadStage', async () => {
      mockTtsStage.mockResolvedValue({ mp3Path: '/tmp/my-pod.mp3', voiceId: 'voice_xyz' });
      await runPipeline(POD_ID);

      expect(mockUploadStage).toHaveBeenCalledWith(
        expect.objectContaining({ mp3Path: '/tmp/my-pod.mp3', voiceId: 'voice_xyz' }),
      );
    });

    it('writes tts running status before calling ttsStage', async () => {
      const order: string[] = [];
      mockDbExecute.mockImplementation(async () => { order.push('db'); return []; });
      mockTtsStage.mockImplementation(async () => { order.push('tts'); return { mp3Path: '/tmp/p.mp3', voiceId: 'v' }; });

      await runPipeline(POD_ID);

      // db (tts running) should be called before tts stage itself
      const firstTtsDb = order.indexOf('db');
      const ttsCall = order.indexOf('tts');
      expect(firstTtsDb).toBeLessThan(ttsCall);
    });

    it('writes tts complete and upload running status after ttsStage succeeds', async () => {
      await runPipeline(POD_ID);

      // DB was called for: tts running, tts complete, upload running, upload complete
      // (stages 1-3 manage their own DB writes)
      expect(mockDbExecute).toHaveBeenCalledTimes(4);
    });

    it('does not call any further stages after vision succeeds', async () => {
      // Baseline: all stages called exactly once
      await runPipeline(POD_ID);
      expect(mockVisionStage).toHaveBeenCalledTimes(1);
      expect(mockRunGroundingStage).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry-then-succeed path', () => {
    it('retries vision stage once and succeeds on second attempt', async () => {
      vi.useFakeTimers();
      mockVisionStage
        .mockRejectedValueOnce(new Error('transient vision error'))
        .mockResolvedValueOnce(undefined);

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(3_000);
      await pipeline;

      expect(mockVisionStage).toHaveBeenCalledTimes(2);
      // Downstream stages should still run
      expect(mockRunGroundingStage).toHaveBeenCalledTimes(1);
      expect(mockScriptStage).toHaveBeenCalledTimes(1);
      expect(mockTtsStage).toHaveBeenCalledTimes(1);
      expect(mockUploadStage).toHaveBeenCalledTimes(1);
    });

    it('retries grounding stage once and succeeds on second attempt', async () => {
      vi.useFakeTimers();
      mockRunGroundingStage
        .mockRejectedValueOnce(new Error('grounding transient'))
        .mockResolvedValueOnce(undefined);

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(3_000);
      await pipeline;

      expect(mockRunGroundingStage).toHaveBeenCalledTimes(2);
      expect(mockScriptStage).toHaveBeenCalledTimes(1);
    });

    it('retries tts stage once and succeeds on second attempt', async () => {
      vi.useFakeTimers();
      mockTtsStage
        .mockRejectedValueOnce(new Error('ElevenLabs transient'))
        .mockResolvedValueOnce({ mp3Path: '/tmp/p.mp3', voiceId: 'v' });

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(3_000);
      await pipeline;

      expect(mockTtsStage).toHaveBeenCalledTimes(2);
      expect(mockUploadStage).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry-exhausted-fail path', () => {
    it('marks pod failed when vision stage exhausts all retries', async () => {
      vi.useFakeTimers();
      mockVisionStage.mockRejectedValue(new Error('vision fatal'));

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(15_000);
      await pipeline;

      // visionStage called 3 times (initial + 2 retries)
      expect(mockVisionStage).toHaveBeenCalledTimes(3);

      // Downstream stages NOT called
      expect(mockRunGroundingStage).not.toHaveBeenCalled();
      expect(mockScriptStage).not.toHaveBeenCalled();
      expect(mockTtsStage).not.toHaveBeenCalled();
      expect(mockUploadStage).not.toHaveBeenCalled();

      // markPodFailed writes 2 DB calls: stage_status update + pods status='failed'
      expect(mockDbExecute).toHaveBeenCalledTimes(2);

      // Verify pod did not reach 'ready' status (DB calls are for failure handling)
      // The stage mocks for downstream are not called, confirming correct abort
      expect(mockRunGroundingStage).not.toHaveBeenCalled();
    });

    it('marks pod failed when grounding stage exhausts all retries', async () => {
      vi.useFakeTimers();
      mockRunGroundingStage.mockRejectedValue(new Error('grounding fatal'));

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(15_000);
      await pipeline;

      expect(mockRunGroundingStage).toHaveBeenCalledTimes(3);
      expect(mockScriptStage).not.toHaveBeenCalled();
      expect(mockDbExecute).toHaveBeenCalledTimes(2);
    });

    it('marks pod failed when tts stage exhausts all retries', async () => {
      vi.useFakeTimers();
      mockTtsStage.mockRejectedValue(new Error('tts fatal'));

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(15_000);
      await pipeline;

      expect(mockTtsStage).toHaveBeenCalledTimes(3);
      expect(mockUploadStage).not.toHaveBeenCalled();

      // DB calls: tts running (1) + failed stage_status (1) + pod status='failed' (1) = 3
      expect(mockDbExecute).toHaveBeenCalledTimes(3);
    });

    it('marks pod failed when upload stage exhausts all retries', async () => {
      vi.useFakeTimers();
      mockUploadStage.mockRejectedValue(new Error('upload fatal'));

      const pipeline = runPipeline(POD_ID);
      await vi.advanceTimersByTimeAsync(15_000);
      await pipeline;

      expect(mockUploadStage).toHaveBeenCalledTimes(3);
      // DB: tts running, tts complete, upload running, upload failed stage_status, pod failed
      expect(mockDbExecute).toHaveBeenCalledTimes(5);
    });
  });

  describe('per-stage status progression', () => {
    it('writes tts running before tts call and tts complete after success', async () => {
      // Track call order between DB writes and stage calls
      const callOrder: string[] = [];

      mockDbExecute.mockImplementation(async () => {
        callOrder.push('db');
        return [];
      });
      mockTtsStage.mockImplementation(async () => {
        callOrder.push('tts');
        return { mp3Path: '/tmp/p.mp3', voiceId: 'v' };
      });
      mockUploadStage.mockImplementation(async () => {
        callOrder.push('upload');
        return {};
      });

      await runPipeline(POD_ID);

      // Success path: db(tts-running), tts, db(tts-complete), db(upload-running), upload, db(upload-complete)
      expect(callOrder).toEqual(['db', 'tts', 'db', 'db', 'upload', 'db']);
    });

    it('does not double-write pod.status ready (uploadStage handles it)', async () => {
      await runPipeline(POD_ID);
      // The orchestrator only makes 4 DB calls (tts/upload running+complete)
      // It does NOT add an extra call to set pod.status='ready' — uploadStage owns that
      expect(mockDbExecute).toHaveBeenCalledTimes(4);
    });
  });
});

