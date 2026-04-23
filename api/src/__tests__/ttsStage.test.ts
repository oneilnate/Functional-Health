/**
 * Smoke tests for Stage 4 — ElevenLabs TTS
 *
 * All external I/O is mocked:
 *   - global fetch (ElevenLabs HTTP)
 *   - node:fs / node:fs/promises (file writes)
 *
 * Tests verify:
 *   - Happy path: fetch called with correct URL/headers/body, MP3 saved, output shape correct
 *   - Rate-limit retry: 429 → retry up to 2 times with backoff, succeeds on 3rd attempt
 *   - Rate-limit exhaustion: 3x 429 throws error
 *   - Non-429 error: throws immediately
 *   - extractTranscriptText: handles all supported shapes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// ── Mock env before importing the module under test ──────────────────────────────
vi.mock('../env.js', () => ({
  env: {
    ELEVENLABS_API_KEY: 'test-el-api-key',
    ELEVENLABS_VOICE_ID: 'EXAVITQu4vr4xnSDxMaL',
    NODE_ENV: 'test',
  },
}));

// Mock fs modules to avoid real disk I/O
const { mockFsWrite, mockFsEnd, mockFsOn, mockFsStat } = vi.hoisted(() => {
  const mockFsWrite = vi.fn((_chunk: unknown, cb?: () => void) => { if (cb) cb(); });
  const mockFsEnd = vi.fn((_cb?: () => void) => { /* noop */ });
  const mockFsOn = vi.fn();
  const mockFsStat = vi.fn().mockResolvedValue({ size: 1024 });
  return { mockFsWrite, mockFsEnd, mockFsOn, mockFsStat };
});

vi.mock('node:fs', () => ({
  default: {
    createWriteStream: vi.fn(() => ({
      write: mockFsWrite,
      end: mockFsEnd,
      on: mockFsOn,
      destroy: vi.fn(),
    })),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    stat: mockFsStat,
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────────────

const POD_ID = '00000000-0000-0000-0000-000000000042';
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const TEST_TEXT = 'Hello, this is a test podcast.';

/** Build a minimal mock Response that emits one chunk then closes */
function buildSuccessResponse(status = 200) {
  const chunk = new Uint8Array([0xff, 0xfb, 0x90, 0x00]); // fake MP3 header bytes
  let called = false;
  const mockGetReader = () => ({
    read: vi.fn().mockImplementation(async () => {
      if (!called) {
        called = true;
        return { done: false, value: chunk };
      }
      return { done: true, value: undefined };
    }),
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    body: { getReader: mockGetReader },
    text: vi.fn().mockResolvedValue(''),
  };
}

/** Simulate the fileStream.on('finish') event being triggered after end() */
function setupStreamFinish() {
  mockFsOn.mockImplementation((event: string, cb: () => void) => {
    if (event === 'finish') {
      // Delay slightly so end() can be called first
      setTimeout(cb, 0);
    }
  });
  mockFsEnd.mockImplementation(() => { /* finish handler will fire */ });
}

// ── extractTranscriptText ─────────────────────────────────────────────────────────────

describe('extractTranscriptText', () => {
  it('imports without error', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    expect(typeof extractTranscriptText).toBe('function');
  });

  it('returns empty string for null/undefined', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    expect(extractTranscriptText(null)).toBe('');
    expect(extractTranscriptText(undefined)).toBe('');
  });

  it('returns the string itself when given a plain string', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    expect(extractTranscriptText('hello world')).toBe('hello world');
  });

  it('concatenates text from segment objects', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    const segments = [
      { text: 'Hello,' },
      { text: 'how are you?' },
    ];
    expect(extractTranscriptText(segments)).toBe('Hello, how are you?');
  });

  it('handles arrays of plain strings', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    expect(extractTranscriptText(['one', 'two', 'three'])).toBe('one two three');
  });

  it('filters out empty segments', async () => {
    const { extractTranscriptText } = await import('../pipeline/stages/ttsStage.js');
    const segments = [{ text: 'Hello' }, { text: '' }, { text: 'World' }];
    expect(extractTranscriptText(segments)).toBe('Hello World');
  });
});

// ── ttsStage ─────────────────────────────────────────────────────────────────────────────

describe('ttsStage', () => {
  let globalFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    setupStreamFinish();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls ElevenLabs with correct URL, headers, and body on success', async () => {
    globalFetch.mockResolvedValueOnce(buildSuccessResponse(200));
    const { ttsStage } = await import('../pipeline/stages/ttsStage.js');

    const result = await ttsStage({ podId: POD_ID, text: TEST_TEXT });

    expect(globalFetch).toHaveBeenCalledOnce();
    const [url, opts] = globalFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`);
    expect(opts.method).toBe('POST');
    const headers = opts.headers as Record<string, string>;
    expect(headers['xi-api-key']).toBe('test-el-api-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('audio/mpeg');

    const parsedBody = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(parsedBody.text).toBe(TEST_TEXT);
    expect(parsedBody.model_id).toBe('eleven_turbo_v2_5');
    expect(parsedBody.optimize_streaming_latency).toBe(2);

    expect(result.voiceId).toBe(VOICE_ID);
    expect(result.mp3Path).toContain(POD_ID);
    expect(result.mp3Path).toMatch(/\.mp3$/);
  });

  it('retries on 429 and succeeds on the next attempt', async () => {
    // Intercept sleep to avoid actual delays in tests
    vi.useFakeTimers();

    globalFetch
      .mockResolvedValueOnce(buildSuccessResponse(429))
      .mockResolvedValueOnce(buildSuccessResponse(200));

    const { ttsStage } = await import('../pipeline/stages/ttsStage.js');

    const promise = ttsStage({ podId: POD_ID, text: TEST_TEXT });
    // Advance past the 2s backoff
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(globalFetch).toHaveBeenCalledTimes(2);
    expect(result.voiceId).toBe(VOICE_ID);

    vi.useRealTimers();
  });

  it('retries twice then throws when all attempts return 429', async () => {
    vi.useFakeTimers();

    globalFetch
      .mockResolvedValueOnce({ ok: false, status: 429, body: null, text: vi.fn().mockResolvedValue('rate limited') })
      .mockResolvedValueOnce({ ok: false, status: 429, body: null, text: vi.fn().mockResolvedValue('rate limited') })
      .mockResolvedValueOnce({ ok: false, status: 429, body: null, text: vi.fn().mockResolvedValue('rate limited') });

    const { ttsStage } = await import('../pipeline/stages/ttsStage.js');

    const promise = ttsStage({ podId: POD_ID, text: TEST_TEXT });
    // Attach rejection handler BEFORE advancing timers to prevent
    // "PromiseRejectionHandledWarning: Promise rejection was handled asynchronously"
    const assertion = expect(promise).rejects.toThrow('ElevenLabs TTS failed');
    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial + 2 retries = 3
    expect(globalFetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('throws immediately on non-429 error responses', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      body: null,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });

    const { ttsStage } = await import('../pipeline/stages/ttsStage.js');

    await expect(ttsStage({ podId: POD_ID, text: TEST_TEXT })).rejects.toThrow(
      'ElevenLabs TTS failed: HTTP 401',
    );
    expect(globalFetch).toHaveBeenCalledOnce();
  });
});

