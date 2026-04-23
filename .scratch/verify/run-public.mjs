import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/home/user/work/Functional-Health/.scratch/verify/public';
const BASE = process.env.BASE_URL || 'http://localhost:8080';
fs.mkdirSync(OUT, { recursive: true });

const consoleByRoute = {};

async function capture(page, label, url) {
  console.log(`\n=== ${label}: ${url} ===`);
  const msgs = [];
  consoleByRoute[label] = msgs;
  const onMsg = (m) => msgs.push({ type: m.type(), text: m.text() });
  const onErr = (e) => msgs.push({ type: 'pageerror', text: e.message });
  page.on('console', onMsg);
  page.on('pageerror', onErr);

  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  console.log('status:', resp?.status());

  // Wait for hydration signals
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const title = await page.title();
  const bodyText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 800));
  const rootHtmlLen = await page.evaluate(() => (document.getElementById('root')?.innerHTML || '').length);
  const hasHeading = await page.evaluate(() => !!document.querySelector('[role="heading"], h1, h2'));
  console.log('title:', title);
  console.log('rootHtmlLen:', rootHtmlLen);
  console.log('hasHeading:', hasHeading);
  console.log('body text (first 800 chars):');
  console.log(bodyText);

  const shot = path.join(OUT, `${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log('screenshot:', shot, fs.statSync(shot).size, 'bytes');

  page.off('console', onMsg);
  page.off('pageerror', onErr);

  return { title, bodyText, rootHtmlLen, hasHeading, screenshot: shot, status: resp?.status() };
}

async function main() {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const results = {};
  results.home = await capture(page, 'home', `${BASE}/`);
  results.explore_direct = await capture(page, 'explore_direct', `${BASE}/explore`);

  // Desktop viewport for tab-bar interaction check (web tab bar may hide on narrow)
  await page.setViewportSize({ width: 1200, height: 900 });
  results.home_desktop = await capture(page, 'home_desktop', `${BASE}/`);

  // Try to click the Explore tab in-app
  let tabClickResult = 'not-attempted';
  try {
    console.log('\n=== clicking Explore tab from home ===');
    const exploreLink = page.locator('a[href="/explore"], a[href$="/explore"]').first();
    if (await exploreLink.count()) {
      await exploreLink.click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(1000);
      const shot = path.join(OUT, 'explore_via_tab.png');
      await page.screenshot({ path: shot, fullPage: true });
      const url = page.url();
      console.log('after click url:', url);
      console.log('screenshot:', shot);
      tabClickResult = `clicked, now at ${url}`;
      results.explore_via_tab = { url, screenshot: shot };
    } else {
      console.log('no anchor with /explore href found; dumping first 20 <a> tags');
      const anchors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).slice(0, 20).map((a) => ({
          href: a.getAttribute('href'),
          text: a.innerText.slice(0, 40),
        })),
      );
      console.log(JSON.stringify(anchors, null, 2));
      tabClickResult = 'explore link not found';
    }
  } catch (e) {
    console.log('tab click failed:', e.message);
    tabClickResult = `error: ${e.message}`;
  }
  results.tabClickResult = tabClickResult;

  fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleByRoute, null, 2));
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

  await browser.close();
  console.log('\n=== DONE ===');
  console.log(JSON.stringify({ baseUrl: BASE, tabClickResult, routes: Object.keys(results) }, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
