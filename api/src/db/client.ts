import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

/**
 * Creates a typed Drizzle ORM client backed by postgres.js.
 *
 * Uses SUPABASE_DB_URL — the Supabase session pooler Postgres connection string
 * (postgresql://postgres.<project>:<pw>@aws-1-us-west-2.pooler.supabase.com:5432/postgres).
 *
 * prepare:false is mandatory for Supabase pooler compatibility (transaction mode
 * rejects prepared statements; session mode has edge cases too). Always false.
 *
 * Usage:
 *   import { db } from './client.js';
 *   const rows = await db.select().from(schema.users).where(...);
 */
function createDbClient() {
  const sql = postgres(env.SUPABASE_DB_URL, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false, // Supabase pooler compatibility — do not remove
  });

  return drizzle(sql, { schema });
}

export const db = createDbClient();
export type Db = typeof db;
