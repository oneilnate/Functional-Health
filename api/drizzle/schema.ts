/**
 * Food Pod Prototype — Drizzle ORM Schema
 *
 * Matches spec §3 exactly (art_1byWlV0c + art_xJJJTKHN).
 * 4 tables: users, pods, meals, podcasts
 *
 * Key decisions:
 * - users.id is TEXT (not uuid) to support `usr_demo_01`-style IDs from seed data
 * - pods.user_id is TEXT FK → users.id (matching the text PK on users)
 * - RLS is enforced at DB level; service_role bypasses for demo single-user setup
 */

import {
  pgTable,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  uuid,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── users ────────────────────────────────────────────────────────────────────
// Supports `usr_demo_01`-style text IDs for demo seeding compatibility.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  age: integer("age"),
  height_cm: integer("height_cm"),
  weight_kg: numeric("weight_kg", { precision: 5, scale: 2 }),
  biological_sex: text("biological_sex"),
  activity_level: text("activity_level"),
  dietary_prefs: jsonb("dietary_prefs"),
  daily_targets: jsonb("daily_targets"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── pods ─────────────────────────────────────────────────────────────────────
// One 30-image collection cycle per user.
// status check: draft | generating | ready | failed
export const pods = pgTable(
  "pods",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    timespan_days: integer("timespan_days").notNull().default(10),
    meals_count: integer("meals_count").notNull().default(0),
    grounded_facts: jsonb("grounded_facts"),
    stage_status: jsonb("stage_status").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "pods_status_check",
      sql`${table.status} IN ('draft', 'generating', 'ready', 'failed')`
    ),
  ]
);

// ─── meals ────────────────────────────────────────────────────────────────────
// One row per captured meal image.
// status check: pending_upload | uploaded | analyzed
export const meals = pgTable(
  "meals",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pod_id: uuid("pod_id")
      .notNull()
      .references(() => pods.id, { onDelete: "cascade" }),
    captured_at: timestamp("captured_at", { withTimezone: true }),
    image_url: text("image_url"),
    gemini_analysis: jsonb("gemini_analysis"),
    usda_matched_foods: jsonb("usda_matched_foods"),
    confidence_score: numeric("confidence_score", { precision: 4, scale: 3 }),
    status: text("status").notNull().default("pending_upload"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      "meals_status_check",
      sql`${table.status} IN ('pending_upload', 'uploaded', 'analyzed')`
    ),
  ]
);

// ─── podcasts ─────────────────────────────────────────────────────────────────
// One podcast per pod (UNIQUE on pod_id). Generated after 30 meals collected.
export const podcasts = pgTable("podcasts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pod_id: uuid("pod_id")
    .notNull()
    .unique()
    .references(() => pods.id, { onDelete: "cascade" }),
  transcript_json: jsonb("transcript_json"),
  mp3_storage_path: text("mp3_storage_path"),
  duration_seconds: numeric("duration_seconds", { precision: 8, scale: 2 }),
  voice_id: text("voice_id"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Pod = typeof pods.$inferSelect;
export type NewPod = typeof pods.$inferInsert;

export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;

export type Podcast = typeof podcasts.$inferSelect;
export type NewPodcast = typeof podcasts.$inferInsert;
