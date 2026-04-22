/**
 * size-limit configuration — @size-limit/file plugin only (no headless Chrome needed).
 * Budget mirrors performance.config.ts: bundle 5_242_880 bytes = 5 MB gzipped.
 *
 * Any change to the bundle budget MUST update both this file and performance.config.ts.
 *
 * @type {import('size-limit').SizeLimitConfig}
 */
module.exports = [
  {
    name: 'Web bundle (gzipped)',
    path: 'dist/_expo/static/js/web/*.js',
    gzip: true,
    limit: '5 MB',
  },
];
