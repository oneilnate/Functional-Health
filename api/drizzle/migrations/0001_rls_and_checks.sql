-- ============================================================
-- Migration 0001: RLS policies + CHECK constraints
-- ============================================================
-- Add CHECK constraints for status columns
ALTER TABLE "pods"
  ADD CONSTRAINT "pods_status_check"
    CHECK (status IN ('draft', 'generating', 'ready', 'failed'));

ALTER TABLE "meals"
  ADD CONSTRAINT "meals_status_check"
    CHECK (status IN ('pending_upload', 'uploaded', 'analyzed'));

-- ============================================================
-- RLS: Enable on all 4 tables
-- ============================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pods"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "podcasts" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: service_role bypasses by default in Supabase.
-- Demo is single-user; policies allow service_role full access.
-- App middleware enforces user_id filtering at query level.
-- ============================================================

-- users
CREATE POLICY "service_role_users_all" ON "users"
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- pods
CREATE POLICY "service_role_pods_all" ON "pods"
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- meals
CREATE POLICY "service_role_meals_all" ON "meals"
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- podcasts
CREATE POLICY "service_role_podcasts_all" ON "podcasts"
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
