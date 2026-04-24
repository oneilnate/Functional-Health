#!/usr/bin/env bash
# ============================================================
# migrate.sh — Run Drizzle migrations against Supabase
# 
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" ./migrate.sh
#
# OR (direct connection, requires IPv6 or network access to Supabase DB):
#   SUPABASE_DB_URL="postgresql://postgres.PROJECT_REF:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" ./migrate.sh
#
# To get your SUPABASE_DB_URL:
#   Supabase Dashboard → Project Settings → Database → Connection String → URI
#   (use the "Transaction pooler" URI for this script)
# ============================================================

set -e

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL must be set."
  echo "Get it from: Supabase Dashboard → Project Settings → Database → Connection String"
  exit 1
fi

echo "Running migration 0000 (schema creation)..."
psql "$SUPABASE_DB_URL" -f drizzle/migrations/0000_keen_gabe_jones.sql

echo "Running migration 0001 (RLS + CHECK constraints)..."
psql "$SUPABASE_DB_URL" -f drizzle/migrations/0001_rls_and_checks.sql

echo "Verifying tables..."
psql "$SUPABASE_DB_URL" -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;"

echo ""
echo "✅ Migrations complete!"
echo ""
echo "Tables created: users, pods, meals, podcasts"
echo "RLS enabled on all 4 tables"
echo "CHECK constraints applied on status columns"
