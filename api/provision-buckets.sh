#!/usr/bin/env bash
# ============================================================
# provision-buckets.sh — Create Supabase Storage buckets
#
# Usage:
#   SUPABASE_URL=https://xxx.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
#   ./provision-buckets.sh
# ============================================================

set -e

SUPABASE_URL="${SUPABASE_URL:-$SECRET_SUPABASE_URL}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SECRET_SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  exit 1
fi

echo "Creating 'meals' bucket (private, 10MB, image/*)..."
curl -s -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"id":"meals","name":"meals","public":false,"file_size_limit":10485760,"allowed_mime_types":["image/jpeg","image/png","image/webp","image/heic"]}'
echo ""

echo "Creating 'pods' bucket (private, 50MB, audio/mpeg)..."
curl -s -X POST "${SUPABASE_URL}/storage/v1/bucket" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"id":"pods","name":"pods","public":false,"file_size_limit":52428800,"allowed_mime_types":["audio/mpeg","audio/mp3"]}'
echo ""

echo "Verifying buckets..."
curl -s "${SUPABASE_URL}/storage/v1/bucket" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" | python3 -c "
import json, sys
buckets = json.load(sys.stdin)
for b in buckets:
    print(f'  ✓ {b[\"name\"]} (public={b[\"public\"]}, size_limit={b[\"file_size_limit\"]})')
"
echo ""
echo "✅ Storage buckets provisioned!"
