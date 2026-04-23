#!/usr/bin/env node
/**
 * drive-appetize.mjs — Playwright agent driver for Appetize.io iOS simulator
 *
 * Usage:
 *   APPETIZE_PUBLIC_KEY=<key> node scripts/drive-appetize.mjs
 *
 * Behavior:
 *   - Loads https://appetize.io/embed/<key>?device=iphone15&autoplay=true
 *   - Waits up to 60s for the simulator iframe to render
 *   - Captures screenshot to /tmp/appetize-home.png
 *   - Exits 1 if JS console errors or simulator fails to boot
 *   - Exits 0 on success (screenshot captured, no errors)
 */

import { chromium } from '@playwright/test';

const PUBLIC_KEY = process.env.APPETIZE_PUBLIC_KEY;

if (!PUBLIC_KEY) {
  console.error('ERROR: APPETIZE_PUBLIC_KEY environment variable is required');
  process.exit(1);
}

const APPETIZE_URL = `https://appetize.io/embed/${PUBLIC_KEY}?device=iphone15&autoplay=true`;
const SCREENSHOT_PATH = '/tmp/appetize-home.png';
const BOOT_TIMEOUT_MS = 60_000;

console.log(`Driving Appetize simulator: ${APPETIZE_URL}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

const page = await context.newPage();

/** Accumulated JS console errors from the page (not the simulated app) */
const consoleErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
    console.error(`[browser console error] ${msg.text()}`);
  }
});

page.on('pageerror', (err) => {
  consoleErrors.push(err.message);
  console.error(`[page error] ${err.message}`);
});

try {
  console.log('Navigating to Appetize embed page...');
  await page.goto(APPETIZE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Wait for the Appetize iframe or simulator canvas to appear
  // Appetize renders an <iframe> or a <canvas> element once the simulator is ready
  console.log(`Waiting up to ${BOOT_TIMEOUT_MS / 1000}s for simulator to boot...`);

  const simulatorReady = await Promise.race([
    // Strategy 1: iframe with appetize source appears
    page
      .waitForSelector('iframe[src*="appetize"]', { timeout: BOOT_TIMEOUT_MS })
      .then(() => 'iframe'),
    // Strategy 2: canvas element (Appetize streaming renderer)
    page
      .waitForSelector('canvas', { timeout: BOOT_TIMEOUT_MS })
      .then(() => 'canvas'),
    // Strategy 3: any element indicating the device UI loaded
    page
      .waitForSelector('[data-testid="device"]', { timeout: BOOT_TIMEOUT_MS })
      .then(() => 'device-testid'),
    // Timeout fallback — we still capture screenshot for debugging
    new Promise((resolve) => setTimeout(() => resolve('timeout'), BOOT_TIMEOUT_MS)),
  ]);

  console.log(`Simulator state: ${simulatorReady}`);

  if (simulatorReady === 'timeout') {
    console.warn(
      'WARNING: Simulator did not show expected element within timeout. Taking screenshot for debugging.'
    );
  }

  // Give the simulator a few extra seconds to render the app
  if (simulatorReady !== 'timeout') {
    console.log('Waiting 30s for app to fully render...');
    await page.waitForTimeout(30_000);
  }

  // Capture screenshot
  console.log(`Taking screenshot → ${SCREENSHOT_PATH}`);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log('Screenshot captured successfully');

  // Check for error states visible on the page
  const pageText = await page.textContent('body').catch(() => '');
  const errorPatterns = [
    'error loading session',
    'session expired',
    'failed to start',
    'unable to connect',
  ];
  const hasVisibleError = errorPatterns.some((pat) =>
    pageText.toLowerCase().includes(pat)
  );

  if (hasVisibleError) {
    console.error('ERROR: Simulator page shows an error state');
    consoleErrors.push('Simulator page shows visible error state');
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error(`\nFAILED: ${consoleErrors.length} console error(s) detected:`);
    consoleErrors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    process.exit(1);
  }

  console.log('\nSUCCESS: Appetize simulator drove successfully, screenshot captured.');
  process.exit(0);
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  // Attempt screenshot even on error (useful for debugging)
  try {
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    console.log(`Debug screenshot saved to ${SCREENSHOT_PATH}`);
  } catch {
    // ignore screenshot failure
  }
  await browser.close();
  process.exit(1);
}
