import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Shape of a user row returned by GET /api/me.
 * Mirrors the users table in drizzle/schema.ts.
 */
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: string | null;
  biological_sex: string | null;
  activity_level: string | null;
  dietary_prefs: unknown | null;
  daily_targets: unknown | null;
  created_at: string;
}

/**
 * GET /api/me
 *
 * Returns the full user row from the users table for the authenticated user.
 * If the demo user hasn't been seeded yet (F6-E1 not merged), returns a
 * sane 404 instead of crashing.
 */
export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/me', async (request, reply) => {
    const userId = request.user.id;

    const rows = await db.execute(
      sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`,
    );

    const user = rows[0] as unknown as UserRow | undefined;

    if (!user) {
      return reply.status(404).send({
        error: 'user_not_found',
        code: 'USER_NOT_SEEDED',
      });
    }

    return reply.status(200).send(user);
  });
}

