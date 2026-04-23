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
| `SUPABASE_URL` | Supabase project URL |
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

