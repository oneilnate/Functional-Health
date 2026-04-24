# worker/

_Reserved for Phase 2._

In Phase 1 (demo), the 5-stage generation pipeline runs in-process inside `api/` using
`p-queue` with `concurrency=1`. This works because the demo supports one user at a time;
there is no background worker process — everything happens in the same Node.js process
that Railway deploys.

## Phase 2 plan

When load justifies it, this directory will house the split-out worker service:

- **BullMQ + Redis** queue fed by `api/` — jobs enqueued on meal-upload, dequeued here
- Same 5 stages extracted from `api/src/pipeline/` into standalone worker handlers
- Horizontal scale via Railway replica count (worker service scaled independently of API)
- Dead-letter queue + retry logic for flaky Gemini / USDA / ElevenLabs calls

## Current setup (Phase 1)

| Concern | Where it lives |
|---|---|
| Pipeline execution | `api/src/pipeline/` (in-process) |
| Concurrency control | `p-queue` inside `api/` |
| Queue persistence | None (single demo user) |
| Scale | Single Railway service |

## Rules

- **Do not add source files here until Phase 2 is scoped.**
- This directory is intentionally empty except for this README.

See `/.obvious/obvious.md` for the full repo contract.

