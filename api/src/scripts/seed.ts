/**
 * Seed script — Sarah Chen demo user (usr_demo_01)
 *
 * Inserts the demo user row via the Supabase REST API (PostgREST).
 * Idempotent: uses the `Prefer: resolution=ignore-duplicates` header,
 * which is the PostgREST equivalent of ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   cd api && pnpm seed
 *
 * Required env vars (set in .env or shell environment):
 *   SUPABASE_URL              — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role JWT (bypasses RLS)
 *
 * The raw SQL file api/drizzle/seed.sql documents the exact values;
 * this script executes the equivalent INSERT via the REST API.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('ERROR: SUPABASE_URL is required');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

// Normalise: strip trailing slash
const baseUrl = supabaseUrl.replace(/\/$/, '');

const userRow = {
  id: 'usr_demo_01',
  email: 'demo@pear.everbetter.com',
  name: 'Sarah Chen',
  age: 34,
  height_cm: 168,
  weight_kg: '64', // numeric column — postgres.js serialises as string
  biological_sex: 'female',
  activity_level: 'moderate',
  dietary_prefs: {
    avoid: ['shellfish'],
    aims: ['more_fiber', 'steady_energy', 'adequate_protein'],
    restrictions: [],
  },
  daily_targets: {
    calories_kcal: 2000,
    protein_g: 90,
    carbohydrate_g: 230,
    fat_g: 70,
    fiber_g: 32,
    added_sugar_g_max: 25,
    sodium_mg_max: 2300,
    saturated_fat_g_max: 22,
    iron_mg: 18,
    calcium_mg: 1000,
    omega_3_g: 1.1,
    vitamin_d_iu: 600,
  },
  created_at: '2026-03-15T09:00:00Z',
};

async function run(): Promise<void> {
  console.log('🌱 Seeding Sarah Chen demo user (usr_demo_01)...');

  const response = await fetch(`${baseUrl}/rest/v1/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      // Ignore duplicates (equivalent to ON CONFLICT DO NOTHING)
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(userRow),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Seed failed: HTTP ${response.status} ${response.statusText}`);
    console.error('Response:', errorBody);
    process.exit(1);
  }

  const responseText = await response.text();
  if (responseText && responseText !== '[]') {
    console.log('✅ Seed complete — usr_demo_01 inserted.');
  } else {
    console.log('✅ Seed complete — usr_demo_01 already existed (no-op).');
  }
}

run().catch((err: unknown) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
