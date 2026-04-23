# E2E Testing Runbook — Functional-Health

## Purpose

This runbook verifies that the Home and Explore routes of the Aaptiv Functional Feed app render correctly end-to-end before a merge or after a deploy. It applies to three environments: the local `dist/` export served by the bundled static server, the production EAS Hosting URL, and per-PR preview URLs (once `deploy-web.yml` lands). The runbook is self-contained: the two helper scripts needed to serve and drive the app are inlined below.

---

## Preflight

Before running any loop, confirm the following are present in your environment:

| Requirement | Check |
|---|---|
| Node ≥ 22 | `node --version` → must print `v22.x.x` |
| pnpm 9.15.9 | `pnpm --version` → must print `9.15.9` |
| Playwright chromium pre-cached | `ls ~/.cache/ms-playwright/chromium-1217/` → directory must exist |

The reference sandbox snapshot (`2026-04-23T04:34:24.071Z` on `cmp_7gMRHWcn`) has all three prerequisites satisfied. Agents starting from that snapshot can skip tool installation.

If chromium is missing:

```bash
npx playwright install --with-deps chromium
```

---

## Local Loop

Builds the static web export, serves it with the Expo-static-export-aware server, then drives Playwright against it.

```bash
cd /home/user/work/Functional-Health
pnpm install --frozen-lockfile
pnpm build:web

# Serve dist/ with a server that maps /explore → dist/explore.html
# Do NOT use 'npx serve --single' — it SPA-falls-back and breaks /explore
node .scratch/verify/serve-dist.mjs &   # listens on :8080

BASE_URL=http://localhost:8080 node .scratch/verify/run.mjs
```

Output: screenshots saved to `.scratch/verify/local/`, `results.json`, `console.json`.

---

## Production Loop

Runs the same Playwright checks against the live EAS Hosting URL (no build required).

```bash
BASE_URL=https://aaptiv-functional-feed.expo.app node .scratch/verify/run.mjs
```

Output: screenshots saved to `.scratch/verify/local/` (or set `OUT_DIR` to a different path).

---

## PR Preview Loop

Available after `deploy-web.yml` merges. Replace `<n>` with the PR number.

```bash
BASE_URL=https://aaptiv-functional-feed--pr-<n>.expo.app node .scratch/verify/run.mjs
```

---

## Pass Criteria

| Check | Expected |
|---|---|
| `GET /` status | 200 |
| `/` body contains | `Aaptiv Functional Feed` |
| `GET /explore` status | 200 |
| `/explore` body contains | `File-based routing` |
| Tab bar: click Explore from Home | Client-side navigate to `/explore` (URL change confirmed) |
| Console errors (any route) | 0 error-severity entries |
| Screenshots saved | `home.png`, `explore_direct.png`, `home_desktop.png`, `explore_via_tab.png` |

`run.mjs` exits 0 if error count is zero; exits 1 if any `error` or `pageerror` entries appear.

---

## Validation Summary

Fill in after each run:

```
<!-- validation-summary -->
result: pass | partial | blocked
routes_verified: home, explore
console_errors: 0
screenshots: .scratch/verify/<local|public|pr-N>/
date: <ISO-8601>
<!-- /validation-summary -->
```

**Reference run (2026-04-23):** `result: pass` — all four screenshots captured against https://aaptiv-functional-feed.expo.app. Evidence in Obvious project at `/home/user/project/files/aaptiv-verify/` (home.png, home\_desktop.png, explore\_direct.png, explore\_via\_tab.png).

---

## Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm build:web` fails | `pnpm install --frozen-lockfile` incomplete or `.npmrc` registry mismatch | Verify install succeeded; check `.npmrc` |
| `/explore` returns same HTML as `/` | Static server is SPA-falling-back | Use `serve-dist.mjs` (below) — do NOT use `npx serve --single` |
| Playwright launch error / chromium not found | Binary not cached | Run `npx playwright install --with-deps chromium` |
| No public URL available | `deploy-web.yml` not yet merged | Run `EXPO_TOKEN=$SECRET_EXPO_TOKEN npx eas-cli deploy --prod --alias aaptiv-feed` manually |
| React hydration error #418 | Known issue on every page | Non-fatal; does not block pass if no `error`-severity console entries |

---

## Re-running

The manual verification run on **2026-04-23** produced https://aaptiv-functional-feed.expo.app via:

```bash
EXPO_TOKEN=$SECRET_EXPO_TOKEN npx eas-cli deploy --prod --alias aaptiv-feed
```

Screenshots archived at `/home/user/project/files/aaptiv-verify/` in the Obvious project. To re-run from scratch against the live URL:

```bash
BASE_URL=https://aaptiv-functional-feed.expo.app node .scratch/verify/run.mjs
```

---

## Reference Scripts

Both scripts must exist at `.scratch/verify/` in the repo. Canonical paths in the snapshot:
- `.scratch/verify/serve-dist.mjs` (copy of `/tmp/serve-dist.mjs`)
- `.scratch/verify/run.mjs`

### serve-dist.mjs

Serves `dist/` with correct MIME types and maps `/explore` → `dist/explore.html`. Required because `npx serve --single` returns `index.html` for all routes, breaking Playwright’s `/explore` check.

```mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function tryFile(p) {
  try {
    const s = fs.statSync(p);
    if (s.isFile()) return p;
    if (s.isDirectory()) {
      const ip = path.join(p, 'index.html');
      if (fs.existsSync(ip)) return ip;
    }
  } catch {}
  return null;
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let rel = url.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  const candidates = [
    path.join(DIST, rel),
    path.join(DIST, rel + '.html'),
    path.join(DIST, rel, 'index.html'),
  ];
  let found = null;
  for (const c of candidates) {
    const r = tryFile(c);
    if (r) { found = r; break; }
  }
  if (!found) {
    const nf = path.join(DIST, '+not-found.html');
    if (fs.existsSync(nf)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(nf).pipe(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found: ' + url);
    return;
  }
  const ext = path.extname(found).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(found).pipe(res);
});

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, '0.0.0.0', () => {
  console.log('Serving', DIST, 'on http://0.0.0.0:' + PORT);
});
```

### run.mjs

Drives Playwright chromium against `BASE_URL`. Captures four screenshots: `home.png`, `explore_direct.png`, `home_desktop.png`, `explore_via_tab.png`. Exits 0 if zero error-severity console entries; exits 1 otherwise.

```mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const OUT = process.env.OUT_DIR || '.scratch/verify/local';
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  { name: 'home',           url: `${BASE}/`,        viewport: { width: 390, height: 844 } },
  { name: 'explore_direct', url: `${BASE}/explore`, viewport: { width: 390, height: 844 } },
  { name: 'home_desktop',   url: `${BASE}/`,        viewport: { width: 1200, height: 900 } },
];

const consoleBucket = {};
const results = { baseUrl: BASE, routes: [], tabClick: null };

const browser = await chromium.launch();
try {
  for (const r of routes) {
    const ctx = await browser.newContext({ viewport: r.viewport, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();
    consoleBucket[r.name] = [];
    page.on('console', (m) => { if (['error','warning'].includes(m.type())) consoleBucket[r.name].push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', (e) => consoleBucket[r.name].push({ type: 'pageerror', text: String(e) }));
    const resp = await page.goto(r.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const shot = path.join(OUT, `${r.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    results.routes.push({ name: r.name, url: r.url, status: resp?.status(), screenshot: shot });
    await ctx.close();
  }
  // Tab click: start at home, click Explore link
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  consoleBucket.explore_via_tab = [];
  page.on('console', (m) => { if (['error','warning'].includes(m.type())) consoleBucket.explore_via_tab.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', (e) => consoleBucket.explore_via_tab.push({ type: 'pageerror', text: String(e) }));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByRole('link', { name: /explore/i }).first().click();
  await page.waitForURL('**/explore');
  await page.waitForTimeout(400);
  const shot = path.join(OUT, 'explore_via_tab.png');
  await page.screenshot({ path: shot, fullPage: true });
  results.tabClick = { landedAt: page.url(), screenshot: shot };
  await ctx.close();
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleBucket, null, 2));
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

const errorCount = Object.values(consoleBucket).flat().filter(e => e.type === 'error' || e.type === 'pageerror').length;
console.log(JSON.stringify({ ...results, errorCount }, null, 2));
process.exit(errorCount === 0 ? 0 : 1);
```

