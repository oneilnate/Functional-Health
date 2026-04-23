import { db } from "./db.js";

const PROFILE_JSON = JSON.stringify({
  age: 34,
  height_cm: 168,
  weight_kg: 64,
  biological_sex: "female",
  activity_level: "moderate",
  goal: "general wellness with emphasis on digestive health and sustained energy",
  dietary_prefs: {
    avoid: ["shellfish"],
    aims: ["more_fiber", "steady_energy", "adequate_protein"],
    restrictions: [],
  },
});

const DAILY_TARGETS_JSON = JSON.stringify({
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
});

export function runSeed(): void {
  const seedAll = db.transaction(() => {
    db.run(
      `INSERT OR IGNORE INTO users (id, email, name, profile_json, daily_targets_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "usr_demo_01",
        "demo@pear.everbetter.com",
        "Sarah Chen",
        PROFILE_JSON,
        DAILY_TARGETS_JSON,
        Date.now(),
      ]
    );

    db.run(
      `INSERT OR IGNORE INTO pods (id, user_id, status, target_count, captured_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["pod_demo_01", "usr_demo_01", "collecting", 7, 0, Date.now()]
    );
  });

  seedAll();
  console.log("[seed] Demo user usr_demo_01 and pod_demo_01 seeded (idempotent)");
}
