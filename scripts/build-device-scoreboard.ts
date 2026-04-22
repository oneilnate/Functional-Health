#!/usr/bin/env tsx
/**
 * scripts/build-device-scoreboard.ts
 *
 * Reads Flashlight output (flashlight.json) + Maestro screenshot artifacts,
 * then APPENDS a Device section to the existing scoreboard-comment.md
 * produced by scripts/build-scoreboard.ts.
 *
 * Also updates scoreboard-data.json with the device section for machine parsing.
 *
 * Runs inside device-main.yml AFTER:
 *   - `flashlight test` produces flashlight.json
 *   - `maestro test` screenshots are uploaded (URLs in .github/device-screenshot-urls.json)
 *
 * Exits non-zero if Flashlight score regresses >10% vs perf/flashlight-baselines/onboarding.json
 */

import * as fs from 'node:fs';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FlashlightResult {
  score?: number;
  cpu?: { averageUsage?: number; maxUsage?: number; unit?: string };
  memory?: { averageUsedMb?: number; maxUsedMb?: number; unit?: string };
  fps?: { average?: number; min?: number; unit?: string };
  threadContention?: { blockedThreadCount?: number; maxBlockedMs?: number };
  flaggedFrames?: Array<{ timestamp?: number; duration?: number; reason?: string }>;
}

interface FlashlightBaseline {
  score: number;
  _note?: string;
  _warning?: string;
  _capturedAt?: string;
  _environment?: string;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function pctDelta(current: number, baseline: number): string {
  if (baseline === 0) return '+0%';
  const delta = ((current - baseline) / baseline) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function scoreEmoji(score: number, baseline: number): string {
  const regression = ((baseline - score) / baseline) * 100;
  if (regression > 10) return '🔴'; // >10% regression vs baseline
  if (score >= 80) return '✅'; // meets budget
  return '🟡'; // below budget but not regressed
}

// ─── Read inputs ───────────────────────────────────────────────────────────────

const commitSha = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const eventName = process.env.GITHUB_EVENT_NAME ?? 'push';
const prNumber = process.env.GITHUB_PR_NUMBER ?? '';

// Flashlight output from `flashlight test --resultsFilePath flashlight.json`
const flashlightResult = readJSON<FlashlightResult>('flashlight.json', {});

// Committed baseline
const flashlightBaseline = readJSON<FlashlightBaseline>(
  'perf/flashlight-baselines/onboarding.json',
  { score: 80 },
);

// Device screenshot URLs (injected by CI step)
// Format: { "onboarding-home": "https://..." }
const deviceScreenshotUrls = readJSON<Record<string, string>>(
  '.github/device-screenshot-urls.json',
  {},
);

// ─── Analyse Flashlight result ─────────────────────────────────────────────────

const currentScore = flashlightResult.score ?? 0;
const baselineScore = flashlightBaseline.score;
const baselineEnvironment = flashlightBaseline._environment ?? 'unknown';
const regressionPct =
  baselineScore > 0 ? ((baselineScore - currentScore) / baselineScore) * 100 : 0;
const isRegression = regressionPct > 10;

// Top-3 flagged frames (sorted by duration desc)
const flaggedFrames = (flashlightResult.flaggedFrames ?? [])
  .sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))
  .slice(0, 3);

// Device screenshot URL for home screen
const deviceScreenshotUrl = deviceScreenshotUrls['onboarding-home'] ?? null;

// ─── Build Device section markdown ─────────────────────────────────────────────

const hasFlashlight = flashlightResult.score !== undefined;
const hasScreenshot = deviceScreenshotUrl !== null;

const screenshotMd = hasScreenshot
  ? `![Android home screen](${deviceScreenshotUrl})`
  : '*(screenshot not available)*';

const scoreDeltaStr = hasFlashlight
  ? `${currentScore} (baseline ${baselineScore}, ${pctDelta(currentScore, baselineScore)})`
  : 'n/a';

const scoreIcon = hasFlashlight ? scoreEmoji(currentScore, baselineScore) : '⏭️';

const cpuStr = flashlightResult.cpu
  ? `avg ${flashlightResult.cpu.averageUsage?.toFixed(1)}% · max ${flashlightResult.cpu.maxUsage?.toFixed(1)}%`
  : 'n/a';

const memStr = flashlightResult.memory
  ? `avg ${flashlightResult.memory.averageUsedMb?.toFixed(0)} MB · max ${flashlightResult.memory.maxUsedMb?.toFixed(0)} MB`
  : 'n/a';

const fpsStr = flashlightResult.fps
  ? `avg ${flashlightResult.fps.average?.toFixed(1)} · min ${flashlightResult.fps.min?.toFixed(1)}`
  : 'n/a';

const threadStr = flashlightResult.threadContention
  ? `${flashlightResult.threadContention.blockedThreadCount ?? 0} blocked threads · max ${flashlightResult.threadContention.maxBlockedMs ?? 0}ms`
  : 'n/a';

const flaggedFramesMd =
  flaggedFrames.length > 0
    ? flaggedFrames
        .map(
          (f, i) =>
            `  ${i + 1}. t=${f.timestamp ?? '?'}ms · ${f.duration ?? '?'}ms · ${f.reason ?? 'unknown'}`,
        )
        .join('\n')
    : '  *(none)*';

const regressionWarning = isRegression
  ? `\n> 🔴 **Flashlight regression:** score dropped ${regressionPct.toFixed(1)}% vs baseline ${baselineScore} (threshold 10%). Apply \`perf-regression-acknowledged\` label to override.\n`
  : '';

const baselineNote = flashlightBaseline._note?.includes('Placeholder')
  ? `\n> ⚠️ **Placeholder baseline in use.** Update \`perf/flashlight-baselines/onboarding.json\` with this run's output and commit with \`visual-baseline-update\` label.\n`
  : '';

const deviceSection = `
### 📱 Device · Android emulator API 34

| | |
|---|---|
| Screenshot | ${screenshotMd} |
| Flashlight score | **${hasFlashlight ? currentScore : 'n/a'}** · ${scoreDeltaStr} ${scoreIcon} · budget 80 |
| CPU | ${cpuStr} |
| Memory | ${memStr} |
| FPS | ${fpsStr} |
| Thread contention | ${threadStr} |

**Top-3 flagged frames:**
${flaggedFramesMd}
${regressionWarning}${baselineNote}`;

// ─── Append Device section to scoreboard-comment.md ────────────────────────────

const sentinel = '<!-- obvious-mobile-scoreboard:v1 -->';
const deviceSentinel = '<!-- device-section-start -->';
const deviceSentinelEnd = '<!-- device-section-end -->';

let commentBody: string;
try {
  commentBody = fs.readFileSync('scoreboard-comment.md', 'utf8');
} catch {
  // scoreboard-comment.md doesn't exist (standalone device run — e.g., push to main)
  commentBody = `${sentinel}\n## 📸 PR Scoreboard · commit ${commitSha}\n`;
  console.warn('⚠️  scoreboard-comment.md not found — creating from scratch for commit comment');
}

// Remove existing device section if present (idempotent update)
const deviceSectionRegex = new RegExp(`${deviceSentinel}[\\s\\S]*?${deviceSentinelEnd}`, 'g');
commentBody = commentBody.replace(deviceSectionRegex, '');

// Append before the closing machine-readable block, or at end
const appendedSection = `${deviceSentinel}${deviceSection}\n${deviceSentinelEnd}`;

const machineBlockStart = '<details>';
if (commentBody.includes(machineBlockStart)) {
  commentBody = commentBody.replace(machineBlockStart, `${appendedSection}\n${machineBlockStart}`);
} else {
  commentBody = `${commentBody}\n${appendedSection}`;
}

fs.writeFileSync('scoreboard-comment.md', commentBody);
console.log('\u2713 scoreboard-comment.md updated with Device section');

// ─── Update scoreboard-data.json ───────────────────────────────────────────────

interface ScoreboardData {
  device?: unknown;
  [key: string]: unknown;
}

const scoreboardData = readJSON<ScoreboardData>('scoreboard-data.json', {});
scoreboardData.device = {
  flow: 'onboarding',
  bundleId: 'com.everbetter.aaptivfeed',
  emulatorApiLevel: 34,
  commit: commitSha,
  eventName,
  prNumber: prNumber || null,
  screenshot: {
    url: deviceScreenshotUrl,
    name: 'onboarding-home',
  },
  flashlight: hasFlashlight
    ? {
        score: currentScore,
        baselineScore,
        regressionPct: parseFloat(regressionPct.toFixed(2)),
        isRegression,
        cpu: flashlightResult.cpu ?? null,
        memory: flashlightResult.memory ?? null,
        fps: flashlightResult.fps ?? null,
        threadContention: flashlightResult.threadContention ?? null,
        flaggedFrames,
        baselineEnvironment,
      }
    : null,
};

fs.writeFileSync('scoreboard-data.json', JSON.stringify(scoreboardData, null, 2));
console.log('\u2713 scoreboard-data.json updated with device section');

// ─── EAS credit log ────────────────────────────────────────────────────────────

// Print EAS credit summary to workflow summary (written by device-main.yml)
// The actual credit check is done in the workflow via `eas build:list`.
console.log('\n=== EAS Credit Note ===');
console.log('EAS Free tier: 15 Android builds/month.');
console.log(
  'At current main-branch cadence (~5 merges/week = ~20/month), EAS Starter ($19/mo) is recommended.',
);
console.log(
  'Expected monthly burn: ~20 Android preview builds = 0 EAS free + ~5 paid at $0.06/credit = <$1 overage.',
);
console.log('Monitor at: https://expo.dev/accounts/everbetter/billing');

// ─── Exit with regression status ───────────────────────────────────────────────

if (isRegression) {
  console.error(
    `✗ Flashlight regression: ${currentScore} vs baseline ${baselineScore} (${regressionPct.toFixed(1)}% drop, threshold 10%)`,
  );
  console.error('  Apply perf-regression-acknowledged label on the PR to override.');
  process.exit(1);
}

console.log(
  `✓ Device scoreboard complete — Flashlight score ${currentScore} vs baseline ${baselineScore} ${scoreIcon}`,
);
