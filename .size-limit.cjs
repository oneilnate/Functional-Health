/**
 * ⚠️ GATE VERIFICATION — INTENTIONALLY LOW LIMIT ⚠️
 * Budget temporarily set to 100 KB to demonstrate size-limit gate fires.
 * Current bundle is ~521 KB gzipped, which exceeds this limit.
 * Reverted in next commit: budget restored to 5 MB per performance.config.ts.
 *
 * @type {import('size-limit').SizeLimitConfig}
 */
module.exports = [
  {
    name: 'Web bundle (gzipped) — TEMP LOW LIMIT FOR GATE DEMO',
    path: 'dist/_expo/static/js/web/*.js',
    gzip: true,
    limit: '100 kB',
  },
];
