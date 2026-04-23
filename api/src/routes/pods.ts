import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * Pod row shape returned by DB queries (Drizzle snake_case → camelCase mapping
 * happens at the route boundary before sending the response).
 */
interface PodRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  status: string;
  timespan_days: number;
  meals_count: number;
  grounded_facts: unknown | null;
  stage_status: unknown;
  created_at: string;
  completed_at: string | null;
}

interface MealRow extends Record<string, unknown> {
  id: string;
  pod_id: string;
  status: string;
  image_url: string | null;
  captured_at: string | null;
  created_at: string;
}

/**
 * Map a DB PodRow (snake_case) → camelCase Pod response object.
 * Matches the mobile `Pod` type from src/modules/food/types.ts.
 */
function mapPod(
  row: PodRow,
  mealsList: MealRow[],
): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    timespanDays: row.timespan_days,
    mealsCount: row.meals_count,
    stageStatus: row.stage_status ?? {},
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    groundedFacts: row.grounded_facts ?? undefined,
    mealsList: mealsList.map((m) => ({
      id: m.id,
      podId: m.pod_id,
      status: m.status,
      imageUrl: m.image_url ?? undefined,
      capturedAt: m.captured_at ?? undefined,
    })),
  };
}

/**
 * POST /api/pods
 *
 * Creates a new pod for the authenticated demo user.
 * - user_id = request.user.id
 * - status  = 'draft'
 * - timespan_days = 10
 * - meals_count = 0
 * - stage_status = {}
 * Returns 201 with the new pod row (camelCase).
 *
 * GET /api/pods/:id
 *
 * Returns the full pod with a joined meals array (ordered by captured_at ASC,
 * falling back to created_at ASC). Enforces user_id scoping — returns 404 when
 * the pod does not exist OR belongs to a different user (no cross-tenant leak
 * via 403).
 */
export async function podRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /api/pods ──────────────────────────────────────────────────────────
  fastify.post('/api/pods', async (request, reply) => {
    const userId = request.user.id;

    const rows = await db.execute<PodRow>(
      sql`
        INSERT INTO pods (user_id, status, timespan_days, meals_count, stage_status)
        VALUES (${userId}, 'draft', 10, 0, '{}'::jsonb)
        RETURNING id, user_id, status, timespan_days, meals_count,
                  grounded_facts, stage_status, created_at, completed_at
      `,
    );

    const pod = rows[0] as PodRow | undefined;

    if (!pod) {
      return reply.status(500).send({
        error: 'internal_error',
        code: 'POD_INSERT_FAILED',
      });
    }

    return reply.status(201).send(mapPod(pod, []));
  });

  // ── GET /api/pods/:id ───────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/pods/:id', async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    // Fetch pod with user_id scope check in one query
    const podRows = await db.execute<PodRow>(
      sql`
        SELECT id, user_id, status, timespan_days, meals_count,
               grounded_facts, stage_status, created_at, completed_at
        FROM pods
        WHERE id = ${id}::uuid
          AND user_id = ${userId}
        LIMIT 1
      `,
    );

    const pod = podRows[0] as PodRow | undefined;

    if (!pod) {
      return reply.status(404).send({
        error: 'not_found',
        code: 'POD_NOT_FOUND',
      });
    }

    // Fetch meals ordered by captured_at ASC, falling back to created_at ASC
    const mealRows = await db.execute<MealRow>(
      sql`
        SELECT id, pod_id, status, image_url, captured_at, created_at
        FROM meals
        WHERE pod_id = ${id}::uuid
        ORDER BY COALESCE(captured_at, created_at) ASC
      `,
    );

    return reply.status(200).send(mapPod(pod, mealRows as MealRow[]));
  });
}

