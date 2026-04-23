-- ============================================================
-- Seed: Sarah Chen demo user (usr_demo_01)
-- Source: art_xJJJTKHN §1 (user row) + §2 (daily_targets)
--
-- Idempotent: ON CONFLICT (id) DO NOTHING
-- Run via: pnpm seed (from api/ directory)
-- ============================================================

INSERT INTO users (
  id,
  email,
  name,
  age,
  height_cm,
  weight_kg,
  biological_sex,
  activity_level,
  dietary_prefs,
  daily_targets,
  created_at
) VALUES (
  'usr_demo_01',
  'demo@pear.everbetter.com',
  'Sarah Chen',
  34,
  168,
  64,
  'female',
  'moderate',
  '{"avoid": ["shellfish"], "aims": ["more_fiber", "steady_energy", "adequate_protein"], "restrictions": []}'::jsonb,
  '{
    "calories_kcal": 2000,
    "protein_g": 90,
    "carbohydrate_g": 230,
    "fat_g": 70,
    "fiber_g": 32,
    "added_sugar_g_max": 25,
    "sodium_mg_max": 2300,
    "saturated_fat_g_max": 22,
    "iron_mg": 18,
    "calcium_mg": 1000,
    "omega_3_g": 1.1,
    "vitamin_d_iu": 600
  }'::jsonb,
  '2026-03-15T09:00:00Z'
) ON CONFLICT (id) DO NOTHING;
