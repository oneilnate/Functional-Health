# infra/

_Reserved for Phase 2._

In Phase 1 (demo), all infrastructure is provisioned manually via managed-service dashboards.
There is no infrastructure-as-code — changes are click-through.

## Current setup (Phase 1)

| Service | Purpose | Managed via |
|---|---|---|
| **Supabase** | Postgres + Storage + RLS | Supabase dashboard |
| **Railway** | API deployment (Node.js) | Railway dashboard |
| **EAS Hosting** | Mobile web preview | Expo dashboard |
| **Appetize** | iOS simulator previews | `.github/workflows/device-preview.yml` |

Env vars are stored in Railway's dashboard and `.env.local` (gitignored).

## Phase 2 plan

When we need reproducible, reviewable infrastructure, this directory will house:

- **Terraform or Pulumi** for Supabase project + Railway service + DNS
- Env var definitions as code (synced to Railway / Expo secrets)
- CI pipeline to `plan` on PR, `apply` on merge to main
- Runbooks for disaster recovery and environment cloning (staging → prod)

## Rules

- **Do not add source files here until Phase 2 is scoped.**
- This directory is intentionally empty except for this README.

See `/.obvious/obvious.md` for the full repo contract.

