# Deployment — Foodpod API

## Staging
- URL: `https://api-production-5df0.up.railway.app`
- Health: `curl https://api-production-5df0.up.railway.app/health` → `{"status":"ok","uptime":<seconds>}`
- Platform: Railway
- Project: `foodpod-api-staging`
- Root directory: `api/`
- Build: Dockerfile-based (see `Dockerfile`)
- Health check: `GET /health` → `{"status":"ok","uptime":<seconds>}`

## Environment Variables
Required secrets (set in Railway project via Railway dashboard or `railway variables`):
- `GEMINI_API_KEY` ✅
- `ELEVENLABS_API_KEY` ✅
- `SUPABASE_URL` ✅
- `SUPABASE_DB_URL` — Supabase session pooler Postgres URL (`postgresql://postgres.<project>:<pw>@aws-1-us-west-2.pooler.supabase.com:5432/postgres`). Get from: Supabase Dashboard → Project Settings → Database → Connection pooling (Session mode, port 5432) ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `SUPABASE_ANON_KEY` ✅
- `DEMO_USER_BEARER_TOKEN` ✅
- `NODE_ENV=staging` ✅
- `PORT` — set automatically by Railway

## Railway Project IDs
- Project ID: `8a26192c-ade2-4098-9934-02634502c4ee`
- Service ID: `76ae010e-f8ad-4601-89a2-b173107d92f3`
- Environment ID: `5da22bc7-e8d5-481a-a5b9-c7dcac45de8b`

## Redeploy
Deploy is triggered via direct source upload (not GitHub auto-deploy). To redeploy:
```bash
# Via Railway REST API — uploads api/ tarball directly
PROJECT_ID=8a26192c-ade2-4098-9934-02634502c4ee
ENV_ID=5da22bc7-e8d5-481a-a5b9-c7dcac45de8b
SERVICE_ID=76ae010e-f8ad-4601-89a2-b173107d92f3

tar czf /tmp/api-deploy.tar.gz \
  --exclude=./node_modules --exclude=./dist --exclude=./.railway \
  -C . ./api/

curl -X POST \
  "https://backboard.railway.app/project/$PROJECT_ID/environment/$ENV_ID/up?serviceId=$SERVICE_ID" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/gzip" \
  --data-binary @/tmp/api-deploy.tar.gz

# Or via Railway CLI (requires account token, not project token):
# RAILWAY_TOKEN=<account-token> railway up --detach
```

## Verify Health
```bash
curl https://api-production-5df0.up.railway.app/health
# Expected: {"status":"ok","uptime":<number>}
```
