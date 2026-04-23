import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';

/**
 * Creates a Drizzle ORM client backed by postgres.js.
 *
 * The schema will be imported from the shared schema file once F1-E1
 * (Supabase schema migration) is merged. For now this returns an
 * untyped db instance that still works for raw queries.
 *
 * Usage:
 *   import { db } from './client.js';
 *   const rows = await db.execute(sql`SELECT 1`);
 */
function createDbClient() {
  const sql = postgres(env.SUPABASE_URL, {
    // Supabase connection string includes credentials;
    // service-role key is injected via SUPABASE_SERVICE_ROLE_KEY env var at runtime.
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  // Schema types will be added in F1-E1; using untyped client for scaffold.
  return drizzle(sql) as ReturnType<typeof drizzle<Record<string, unknown>>>;
}

export const db = createDbClient();
export type Db = typeof db;
