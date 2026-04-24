/**
 * smoke-db.ts — Verify Railway → Supabase DB connectivity post-deploy.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." pnpm smoke:db
 *
 * Expected output:
 *   OK: { current_user: 'postgres.enhgiflbsujphzyimcoo', user_count: 1 }
 *
 * Non-zero exit = connectivity failure. Safe to run repeatedly (read-only).
 */
import postgres from 'postgres';

const url = process.env.SUPABASE_DB_URL;

if (!url) {
  console.error('FAIL: SUPABASE_DB_URL is not set');
  process.exit(1);
}

const sql = postgres(url, {
  prepare: false, // Supabase pooler compatibility
  max: 1,
  connect_timeout: 10,
});

try {
  const [row] = await sql`
    SELECT
      current_user,
      (SELECT count(*)::int FROM users) AS user_count
  `;
  console.log('OK:', row);
  await sql.end();
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  await sql.end().catch(() => undefined);
  process.exit(1);
}

