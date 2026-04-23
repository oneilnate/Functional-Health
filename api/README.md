# foodpod-api

Fastify + TypeScript API server for the Food Pod prototype.
Deployed on Railway — Supabase for Postgres + Storage.

---

## Tech Stack

- **Runtime**: Node 22
- **Framework**: Fastify 5 + Pino logger
- **Language**: TypeScript 5.7 (ESM, strict)
- **ORM**: Drizzle ORM + postgres.js
- **Env validation**: Zod
- **Deploy**: Railway (Dockerfile)

---

## Local Development

### Prerequisites

- Node 22 LTS
- pnpm 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup

```bash
# From repo root
cd api
pnpm install

# Copy environment file and fill in values
cp .env.example .env
# Edit .env and set all required vars (see .env.example)
```

### Run

```bash
# Development with hot-reload
pnpm dev

# Production build + start
pnpm build
pnpm start
```

### Verify

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","uptime":...}
```

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start with tsx watch (hot-reload) |
| `pnpm build` | Compile TypeScript → dist/ |
| `pnpm start` | Run compiled output |
| `pnpm test` | Run Vitest test suite |
| `pnpm typecheck` | Type-check without emitting |

---

## Environment Variables

See `.env.example` for the full list. All are required unless marked optional.

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key |
| `SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) — used by Supabase JS client for Storage |
| `SUPABASE_DB_URL` | Supabase session pooler Postgres URL (`postgresql://postgres.<project>:<pw>@aws-1-us-west-2.pooler.supabase.com:5432/postgres`). Get from: Supabase Dashboard → Project Settings → Database → Connection pooling (Session mode, port 5432) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `DEMO_USER_BEARER_TOKEN` | Shared bearer token for demo auth |
| `PORT` | Server port (optional, default 3000) |
| `NODE_ENV` | Environment (optional, default development) |

---

## Docker

```bash
# Build image
docker build -t foodpod-api .

# Run locally with env file
docker run --env-file .env -p 3000:3000 foodpod-api
```

---

## Deployment

This service deploys automatically to Railway on merge to the release branch.
Railway reads `railway.json` and builds using the Dockerfile.

Set all environment variables from `.env.example` in your Railway service settings.


## Database Migrations

Schema is managed with Drizzle ORM. Migrations live in `drizzle/migrations/`.

```bash
# Generate migrations from schema changes
pnpm db:generate

# Apply migrations (requires SUPABASE_DB_URL env var)
pnpm db:migrate
```

### Schema Tables (spec §3)

| Table | Description |
|---|---|
| `users` | App user profile (id is text to support `usr_demo_01` IDs) |
| `pods` | A 10-day food-tracking pod per user |
| `meals` | Individual meal captures within a pod |
| `podcasts` | Generated podcast episode for a completed pod |

### Storage Buckets

| Bucket | Purpose | Max size |
|---|---|---|
| `meals` | Meal photo uploads | 10 MB |
| `pods` | Generated podcast MP3s | 50 MB |


## Seed Demo User

Seeds the Sarah Chen demo user (`usr_demo_01`) into Supabase. This is required before testing the end-to-end flow.

### Prerequisites

Set the following env vars (in `.env` or shell environment):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`) **or** a direct `postgresql://` connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (bypasses RLS; from Supabase Dashboard → Project Settings → API) |

### Run

```bash
cd api
pnpm install
pnpm seed
```

The script is idempotent — running it twice is safe (uses `INSERT ... ON CONFLICT (id) DO NOTHING`).

### Verify

```bash
# Using psql with a direct postgres URI (SUPABASE_DB_URL):
psql "$SUPABASE_DB_URL" -c "SELECT id, name, age, (daily_targets->>'fiber_g')::numeric AS fiber_g FROM users WHERE id='usr_demo_01';"
# Expected: usr_demo_01 | Sarah Chen | 34 | 32
```

### What is seeded

| Field | Value |
|---|---|
| `id` | `usr_demo_01` |
| `email` | `demo@pear.everbetter.com` |
| `name` | Sarah Chen |
| `age` | 34 |
| `height_cm` | 168 |
| `weight_kg` | 64 |
| `biological_sex` | female |
| `activity_level` | moderate |
| `dietary_prefs.avoid` | `["shellfish"]` |
| `dietary_prefs.aims` | `["more_fiber","steady_energy","adequate_protein"]` |
| `daily_targets` | 12 keys — see `drizzle/seed.sql` §2 (2000 kcal, 90g protein, 32g fiber …) |

No pods or meals are seeded — users capture those live via the mobile app.

Source: `art_xJJJTKHN` §1 (user row) + §2 (daily_targets).
