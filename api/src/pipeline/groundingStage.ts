/**
 * Stage 2 — USDA RAG Grounding
 *
 * For each meal with gemini_analysis populated:
 *   1. Fuzzy-match each identified food item against the USDA corpus (case-insensitive substring)
 *   2. Scale nutrients by portion_g / 100 to get per-meal totals
 *   3. Write meals.usda_matched_foods JSONB[]
 *
 * Then aggregate across all meals into pods.grounded_facts JSONB:
 *   { aggregate, targets, gaps, patterns }
 *
 * Shape matches art_xJJJTKHN §5 exactly.
 *
 * NOTE: No Gemini calls are made here — pure JS fuzzy matching only,
 * per F3-E3 locked decisions.
 */

import { sql } from 'drizzle-orm';
import usdaCorpus from './usda-corpus.json' with { type: 'json' };

// ── Types ────────────────────────────────────────────────────────────────────

/** One entry from usda-corpus.json (all values per 100 g) */
interface UsdaEntry {
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  added_sugar_g: number;
  sodium_mg: number;
  iron_mg: number;
  calcium_mg: number;
  saturated_fat_g: number;
}

/** Nutrition values already scaled to the actual portion. */
interface ScaledNutrition {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
  added_sugar_g: number;
  sodium_mg: number;
  iron_mg: number;
  calcium_mg: number;
  saturated_fat_g: number;
}

/** One matched food written to meals.usda_matched_foods */
export interface MatchedFood {
  food_name: string;
  usda_match: string;
  portion_g: number;
  nutrition: ScaledNutrition;
  confidence: 'exact' | 'partial' | 'fallback';
}

/** Shape of a food item inside gemini_analysis.foods[] */
interface GeminiFoodItem {
  name: string;
  portion_g?: number;
  estimated_portion_g?: number;
  quantity_g?: number;
  weight_g?: number;
}

/** Minimal DB row shape for meals */
interface MealRow {
  id: string;
  gemini_analysis: {
    foods?: GeminiFoodItem[];
    items?: GeminiFoodItem[];
  } | null;
}

/** A gap between actual and target for a single nutrient */
interface NutritionGap {
  nutrient: string;
  direction: 'under' | 'over';
  delta: number;
  severity: 'primary' | 'secondary' | 'tertiary';
}

/** The grounded_facts shape that matches art_xJJJTKHN §5 */
export interface GroundedFacts {
  pod_id: string;
  user_id: string;
  meals_count: number;
  timespan_days: number;
  aggregate: {
    avg_daily_kcal: number;
    avg_daily_protein_g: number;
    avg_daily_carb_g: number;
    avg_daily_fat_g: number;
    avg_daily_fiber_g: number;
    avg_daily_added_sugar_g: number;
    avg_daily_sodium_mg: number;
    avg_daily_saturated_fat_g: number;
  };
  targets: {
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    fiber_g: number;
    added_sugar_g_max: number;
    sodium_mg_max: number;
    saturated_fat_g_max: number;
  };
  gaps: NutritionGap[];
  patterns: string[];
}

// ── USDA corpus lookup ────────────────────────────────────────────────────────

const corpus = usdaCorpus as UsdaEntry[];

/**
 * Find the best USDA corpus match for a food name.
 *
 * Priority:
 *  1. Full case-insensitive equality
 *  2. Corpus name contains the query as a substring (prefer longer/more-specific)
 *  3. Query contains the corpus name as a substring (prefer longer/more-specific)
 *  Returns null if no match.
 */
export function findUsdaMatch(foodName: string): UsdaEntry | null {
  const query = foodName.toLowerCase().trim();

  // 1. Exact match
  const exact = corpus.find((e) => e.name.toLowerCase() === query);
  if (exact) return exact;

  // 2. Query contains corpus entry as substring (e.g. "pan-seared chicken thigh" ⊇ "chicken thigh")
  // Sort by name length descending to prefer longest (most specific) match
  const candidatesBySuffix = corpus
    .filter((e) => query.includes(e.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (candidatesBySuffix.length > 0) return candidatesBySuffix[0];

  // 3. Corpus entry contains query as substring
  const candidatesByPrefix = corpus
    .filter((e) => e.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.length - b.name.length);
  if (candidatesByPrefix.length > 0) return candidatesByPrefix[0];

  return null;
}

/**
 * Scale per-100g USDA values to the given portion size.
 */
function scale(entry: UsdaEntry, portionG: number): ScaledNutrition {
  const factor = portionG / 100;
  return {
    kcal:            round2(entry.kcal            * factor),
    protein_g:       round2(entry.protein_g       * factor),
    carb_g:          round2(entry.carb_g          * factor),
    fat_g:           round2(entry.fat_g           * factor),
    fiber_g:         round2(entry.fiber_g         * factor),
    added_sugar_g:   round2(entry.added_sugar_g   * factor),
    sodium_mg:       round2(entry.sodium_mg       * factor),
    iron_mg:         round2(entry.iron_mg         * factor),
    calcium_mg:      round2(entry.calcium_mg      * factor),
    saturated_fat_g: round2(entry.saturated_fat_g * factor),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Extract food items from gemini_analysis JSONB.
 * Handles multiple possible key shapes from vision stage.
 */
function extractFoodsFromAnalysis(analysis: MealRow['gemini_analysis']): GeminiFoodItem[] {
  if (!analysis) return [];
  if (Array.isArray(analysis.foods)) return analysis.foods;
  if (Array.isArray(analysis.items)) return analysis.items;
  return [];
}

/**
 * Get portion size from a food item object, defaulting to 150g if not provided.
 */
function getPortionG(item: GeminiFoodItem): number {
  const raw =
    item.portion_g ??
    item.estimated_portion_g ??
    item.quantity_g ??
    item.weight_g ??
    150;
  return typeof raw === 'number' && raw > 0 ? raw : 150;
}

// ── Per-meal grounding ────────────────────────────────────────────────────────

/**
 * Match all foods in a single meal's gemini_analysis against the USDA corpus.
 * Returns the MatchedFood array to be written to meals.usda_matched_foods.
 * Pure function — no I/O.
 */
export function groundMeal(meal: { id: string; gemini_analysis: MealRow['gemini_analysis'] }): MatchedFood[] {
  const foods = extractFoodsFromAnalysis(meal.gemini_analysis);
  const matched: MatchedFood[] = [];

  for (const item of foods) {
    const portionG = getPortionG(item);
    const entry = findUsdaMatch(item.name);

    if (entry) {
      const isExact = entry.name.toLowerCase() === item.name.toLowerCase().trim();
      matched.push({
        food_name: item.name,
        usda_match: entry.name,
        portion_g: portionG,
        nutrition: scale(entry, portionG),
        confidence: isExact ? 'exact' : 'partial',
      });
    } else {
      matched.push({
        food_name: item.name,
        usda_match: 'unmatched',
        portion_g: portionG,
        nutrition: {
          kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0,
          fiber_g: 0, added_sugar_g: 0, sodium_mg: 0,
          iron_mg: 0, calcium_mg: 0, saturated_fat_g: 0,
        },
        confidence: 'fallback',
      });
    }
  }

  return matched;
}

// ── Aggregation + gap computation ────────────────────────────────────────────

interface DailyTargets {
  calories_kcal?: number;
  protein_g?: number;
  carbohydrate_g?: number;
  fat_g?: number;
  fiber_g?: number;
  added_sugar_g_max?: number;
  sodium_mg_max?: number;
  saturated_fat_g_max?: number;
  [key: string]: number | undefined;
}

interface UserRecord {
  id: string;
  daily_targets: DailyTargets | null;
}

interface PodRecord {
  id: string;
  user_id: string;
  meals_count: number;
  timespan_days: number;
}

/**
 * Compute grounded_facts from the usda_matched_foods arrays for all meals.
 *
 * Gap ranking uses |delta| descending; top 3 labeled primary/secondary/tertiary.
 * "Max" targets (added_sugar, sodium, saturated_fat): over target = gap.
 * "Min" targets (protein, fiber): under target = gap.
 * Calories: only flagged if >10% deficit.
 *
 * Pure function — no I/O.
 */
export function computeGroundedFacts(
  pod: PodRecord,
  user: UserRecord,
  matchedFoodsPerMeal: MatchedFood[][],
): GroundedFacts {
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarb = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalAddedSugar = 0;
  let totalSodium = 0;
  let totalSaturatedFat = 0;

  for (const mealFoods of matchedFoodsPerMeal) {
    for (const mf of mealFoods) {
      const n = mf.nutrition;
      totalKcal         += n.kcal;
      totalProtein      += n.protein_g;
      totalCarb         += n.carb_g;
      totalFat          += n.fat_g;
      totalFiber        += n.fiber_g;
      totalAddedSugar   += n.added_sugar_g;
      totalSodium       += n.sodium_mg;
      totalSaturatedFat += n.saturated_fat_g;
    }
  }

  const days = pod.timespan_days > 0 ? pod.timespan_days : 1;

  const aggregate = {
    avg_daily_kcal:            round2(totalKcal         / days),
    avg_daily_protein_g:       round2(totalProtein      / days),
    avg_daily_carb_g:          round2(totalCarb         / days),
    avg_daily_fat_g:           round2(totalFat          / days),
    avg_daily_fiber_g:         round2(totalFiber        / days),
    avg_daily_added_sugar_g:   round2(totalAddedSugar   / days),
    avg_daily_sodium_mg:       round2(totalSodium       / days),
    avg_daily_saturated_fat_g: round2(totalSaturatedFat / days),
  };

  const dt = user.daily_targets ?? {};
  const targets: GroundedFacts['targets'] = {
    kcal:                dt.calories_kcal        ?? 2000,
    protein_g:           dt.protein_g            ?? 90,
    carb_g:              dt.carbohydrate_g       ?? 230,
    fat_g:               dt.fat_g                ?? 70,
    fiber_g:             dt.fiber_g              ?? 32,
    added_sugar_g_max:   dt.added_sugar_g_max    ?? 25,
    sodium_mg_max:       dt.sodium_mg_max        ?? 2300,
    saturated_fat_g_max: dt.saturated_fat_g_max  ?? 22,
  };

  // Build candidate gaps with absolute delta for ranking
  const candidateGaps: Array<{ nutrient: string; direction: 'under' | 'over'; delta: number; absDelta: number }> = [];

  const fiberDelta = aggregate.avg_daily_fiber_g - targets.fiber_g;
  if (fiberDelta < 0) {
    candidateGaps.push({ nutrient: 'fiber_g', direction: 'under', delta: Math.round(fiberDelta), absDelta: Math.abs(fiberDelta) });
  }

  const sugarDelta = aggregate.avg_daily_added_sugar_g - targets.added_sugar_g_max;
  if (sugarDelta > 0) {
    candidateGaps.push({ nutrient: 'added_sugar_g', direction: 'over', delta: Math.round(sugarDelta), absDelta: Math.abs(sugarDelta) });
  }

  const proteinDelta = aggregate.avg_daily_protein_g - targets.protein_g;
  if (proteinDelta < 0) {
    candidateGaps.push({ nutrient: 'protein_g', direction: 'under', delta: Math.round(proteinDelta), absDelta: Math.abs(proteinDelta) });
  }

  const sodiumDelta = aggregate.avg_daily_sodium_mg - targets.sodium_mg_max;
  if (sodiumDelta > 0) {
    candidateGaps.push({ nutrient: 'sodium_mg', direction: 'over', delta: Math.round(sodiumDelta), absDelta: Math.abs(sodiumDelta) });
  }

  const satFatDelta = aggregate.avg_daily_saturated_fat_g - targets.saturated_fat_g_max;
  if (satFatDelta > 0) {
    candidateGaps.push({ nutrient: 'saturated_fat_g', direction: 'over', delta: Math.round(satFatDelta), absDelta: Math.abs(satFatDelta) });
  }

  const kcalDelta = aggregate.avg_daily_kcal - targets.kcal;
  if (kcalDelta < -targets.kcal * 0.1) {
    candidateGaps.push({ nutrient: 'kcal', direction: 'under', delta: Math.round(kcalDelta), absDelta: Math.abs(kcalDelta) });
  }

  const severities: Array<'primary' | 'secondary' | 'tertiary'> = ['primary', 'secondary', 'tertiary'];
  const gaps: NutritionGap[] = candidateGaps
    .sort((a, b) => b.absDelta - a.absDelta)
    .slice(0, 3)
    .map((g, i) => ({
      nutrient:  g.nutrient,
      direction: g.direction,
      delta:     g.delta,
      severity:  severities[i],
    }));

  return {
    pod_id:        pod.id,
    user_id:       user.id,
    meals_count:   pod.meals_count,
    timespan_days: pod.timespan_days,
    aggregate,
    targets,
    gaps,
    patterns: [],
  };
}

// ── Stage runner ─────────────────────────────────────────────────────────────

interface GroundingMealRow extends Record<string, unknown> {
  id: string;
  gemini_analysis: MealRow['gemini_analysis'];
}

interface PodStageRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  meals_count: number;
  timespan_days: number;
}

interface UserDailyTargetsRow extends Record<string, unknown> {
  id: string;
  daily_targets: DailyTargets | null;
}

/**
 * Run Stage 2 for a given pod (DB-coupled entry point).
 * Called by the pipeline orchestrator (run.ts).
 *
 * Throws on any error so the orchestrator can apply retry/exp-backoff.
 */
export async function runGroundingStage(podId: string): Promise<void> {
  // Lazy-import the DB client so pure functions (groundMeal, computeGroundedFacts)
  // remain testable without env vars.
  const { db } = await import('../db/client.js');

  // 1. Mark grounding stage as running
  await db.execute(
    sql`UPDATE pods
        SET stage_status = jsonb_set(
              COALESCE(stage_status, '{}'::jsonb),
              '{grounding}',
              ${JSON.stringify({ status: 'running', startedAt: new Date().toISOString() })}::jsonb
            )
        WHERE id = ${podId}::uuid`,
  );

  // 2. Load pod metadata
  const podRows = await db.execute<PodStageRow>(
    sql`SELECT id, user_id, meals_count, timespan_days
        FROM pods
        WHERE id = ${podId}::uuid
        LIMIT 1`,
  );
  const pod = podRows[0];
  if (!pod) throw new Error(`Pod ${podId} not found during grounding stage`);

  // 3. Load user daily targets
  const userRows = await db.execute<UserDailyTargetsRow>(
    sql`SELECT id, daily_targets
        FROM users
        WHERE id = ${pod.user_id}
        LIMIT 1`,
  );
  const user = userRows[0];
  if (!user) throw new Error(`User ${pod.user_id} not found during grounding stage`);

  // 4. Load meals with gemini_analysis
  const mealRows = await db.execute<GroundingMealRow>(
    sql`SELECT id, gemini_analysis
        FROM meals
        WHERE pod_id = ${podId}::uuid
          AND gemini_analysis IS NOT NULL
        ORDER BY COALESCE(captured_at, created_at) ASC`,
  );

  // 5. Ground each meal + write usda_matched_foods
  const matchedFoodsPerMeal: MatchedFood[][] = [];

  for (const meal of mealRows) {
    const matched = groundMeal(meal as GroundingMealRow);
    matchedFoodsPerMeal.push(matched);

    await db.execute(
      sql`UPDATE meals
          SET usda_matched_foods = ${JSON.stringify(matched)}::jsonb
          WHERE id = ${meal.id}::uuid`,
    );
  }

  // 6. Compute grounded_facts and write to pod
  const groundedFacts = computeGroundedFacts(
    { id: pod.id, user_id: pod.user_id, meals_count: pod.meals_count, timespan_days: pod.timespan_days },
    { id: user.id, daily_targets: user.daily_targets },
    matchedFoodsPerMeal,
  );

  await db.execute(
    sql`UPDATE pods
        SET grounded_facts = ${JSON.stringify(groundedFacts)}::jsonb,
            stage_status   = jsonb_set(
              COALESCE(stage_status, '{}'::jsonb),
              '{grounding}',
              ${JSON.stringify({ status: 'complete', completedAt: new Date().toISOString() })}::jsonb
            )
        WHERE id = ${podId}::uuid`,
  );
}
