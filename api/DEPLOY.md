# Deployment — Foodpod API

## Staging
- URL: `https://foodpod-api-staging.up.railway.app` _(will be updated with actual subdomain after first successful deploy)_
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
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `SUPABASE_ANON_KEY` ✅
- `DEMO_USER_BEARER_TOKEN` ✅
- `NODE_ENV=staging` ✅
- `PORT` — set automatically by Railway

## Railway Project IDs
- Project ID: `8a26192c-ade2-4098-9934-02634502c4ee`
- Service ID: `2939c394-1f4f-40f3-a654-f46f459674db`
- Environment ID: `5da22bc7-e8d5-481a-a5b9-c7dcac45de8b`

## Redeploy
Railway auto-deploys on every push to the connected branch. For manual redeploy:
```bash
# Via Railway CLI (requires RAILWAY_TOKEN)
export RAILWAY_TOKEN=<your-token>
cd api
railway up --detach

# Or trigger via Railway dashboard → Deployments → Redeploy
```

## Verify Health
```bash
curl https://<railway-subdomain>.up.railway.app/health
# Expected: {"status":"ok","uptime":<number>}
```
