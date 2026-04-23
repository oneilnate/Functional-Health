<!-- obvious-install: skill=autobuild-setup, skill-version=1.0.1, template-version=1 -->

# Functional-Health — Repo Contract

Expo SDK 54 · expo-router v4 · RN 0.81 · React 19 · TS 5.7 · pnpm 9 · Node 22.

---

## Quickstart

```bash
pnpm install                    # install deps (pnpm 9, Node 22 LTS required)
pnpm typecheck                  # tsc --noEmit
pnpm lint                       # biome check .
pnpm test --run                 # vitest-native, CI mode
pnpm test:coverage              # vitest + v8 coverage
pnpm build:web                  # expo export --platform web → dist/
pnpm verify:fast                # typecheck + lint + test:coverage + build:web + size-limit
pnpm verify                     # verify:fast + Playwright e2e/screenshots (full gate)
```

---

## Performance Budgets (Hard Gates)

Violation = failed CI. Loosening requires `perf-budget-change` label + human approval.

| Budget | Limit | Checked by |
|---|---|---|
| Web bundle (gzipped) | **5 MB** | size-limit in CI |
| Time-to-interactive (4× CPU) | **2500 ms** | Playwright + CDP in scoreboard.yml |
| Renders on mount — leaf screen | **3** | React.Profiler in screenshot tests |
| Renders on mount — container | **6** | React.Profiler in screenshot tests |
| Android Flashlight score | **≥ 80** | Maestro + Flashlight on merge to main |

Numeric source of truth: `performance.config.ts`.

---

## Architecture Contract

Screens (`src/app/`) hold JSX and local state only — no business logic, no fetch calls. Modules (`src/modules/<name>/`) own feature logic, hooks, and types; each has a `spec.md`. Services (`src/services/`) are the only place `fetch` is called. Client state via Zustand slices in `src/store/`; server state via React Query. Screens and modules never call `fetch` directly.

---

## Hard Rules

- No `any` types outside test files.
- Named exports only — no default exports.
- `pnpm` only — never `npm` or `yarn`.
- No `eas build` / `expo run:ios` in agent sessions.
- No direct `fetch` in screens or modules — use `src/services/`.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Budget loosening requires `perf-budget-change` label + human approval.
- Do not touch `assets/` unless the task explicitly involves asset changes.
- Update `spec.md` when a module’s responsibilities or public API change.

---

## Dogfooding URLs

| Environment | URL | Status |
|---|---|---|
| Web prod | https://aaptiv-functional-feed.expo.app | Live |
| PR previews | https://aaptiv-functional-feed--pr-\<n\>.expo.app | After deploy-web.yml lands |
| iOS simulator | Posted to each PR by `device-preview.yml` (Appetize) | Per-PR |

---

## CI Workflows

| Workflow | What it does |
|---|---|
| `ci.yml` | typecheck + lint + test:coverage + build:web + size-limit (ubuntu-latest, <10 min) |
| `device-preview.yml` | EAS iOS simulator build + Appetize upload + PR comment (macos-15) |
| `scoreboard.yml` | Playwright screenshot/a11y/perf + PR scoreboard comment |
| `deploy-web.yml` | EAS Hosting deploy on main + PR preview alias **(PENDING — PR in flight)** |
| `label-sync.yml` | Repo labels sync |

---

## Sandbox Snapshot

| Field | Value |
|---|---|
| `snapshotId` | `2026-04-23T04:34:24.071Z` |
| `e2bTemplateId` | `tpx71egoz13ry1g6cs24:default` |
| `computerId` | `cmp_7gMRHWcn` |
| Note | Captured after EAS Hosting manual deploy + Playwright chromium cache warm. |

Agents starting work should use this snapshot to skip dependency install and Playwright binary download.

---

## Bibliography

`bibliography_tool_unavailable` — Bibliography tool is not wired for this repo in the current orchestrator environment; re-run the scan when it becomes available.

---

## Repo Guidance for Autobuild

**Test commands:**
- `pnpm test --run` — run all tests once (vitest-native).
- `pnpm test:coverage` — tests + v8 coverage; coverage gate ≥ 70%.
- `pnpm test --run src/modules/<name>` — module-scoped fast loop.

**Lint / format:**
- `biome check .` or `pnpm lint` — must pass before commit.

**Commit format:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).

**File conventions:**
- Named exports only (no default exports).
- No `any` outside test files.
- No direct `fetch` in screens or modules.
- Screens: JSX + local state only. Modules: business logic + hooks + types.

**CI requirements:**
- `ci.yml` must be green before merge.
- Scoreboard budgets enforced; red scoreboard = fix before review.
- `pnpm verify` = full local gate that mirrors CI.

---

## Named Subagents

Five named roles defined in AGENTS.md §8: `screen-builder`, `module-builder`, `api-integrator`, `test-writer`, `perf-investigator`. Read AGENTS.md before spawning role-specific workers.

---

See `.obvious/codebase-map.md` for the directory guide.

