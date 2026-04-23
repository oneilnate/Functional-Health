# Obvious Mobile — Agent Contract

Expo Managed Workflow SDK 54 · expo-router v4 · React 19 · RN 0.81 · TypeScript 5.7 · pnpm 9
Agent-first repo. Read this file before touching any code. Under 6 KB by policy.

---

## 1. Commands

```bash
pnpm install                    # install deps (pnpm 9, Node 22 LTS required)
pnpm typecheck                  # tsc --noEmit — must be zero errors
pnpm lint                       # biome check . — under 500 ms
pnpm test --run                 # vitest-native, CI mode (no watch)
pnpm test:coverage              # same + v8 coverage report
pnpm build:web                  # expo export --platform web → dist/
pnpm size-limit                 # check gzipped bundle vs 5 MB budget
pnpm verify:fast                # typecheck + lint + test:coverage + build:web + size-limit
pnpm verify                     # verify:fast + Playwright e2e/screenshots (full gate)
```

Run `pnpm verify` before every push. Green locally = green in CI.
Do NOT run `eas build` or `expo run:ios` in agent sessions — cloud credits / macOS only.

---

## 2. Performance budgets (HARD)

Violation = failed CI. Loosening requires `perf-budget-change` label + human reviewer approval.

| Budget                          | Limit      | Checked by                                  |
|---------------------------------|------------|---------------------------------------------|
| Web bundle (gzipped)            | **5 MB**   | size-limit in CI                            |
| Time-to-interactive (4× CPU)    | **2500 ms**| Playwright + CDP in scoreboard.yml          |
| Renders on mount — leaf screen  | **3**      | React.Profiler in screenshot tests          |
| Renders on mount — container    | **6**      | React.Profiler in screenshot tests          |
| Android Flashlight score        | **≥ 80**   | Maestro + Flashlight on merge to main       |

Numeric source of truth: `performance.config.ts` at repo root. Rationale lives in its comments.

---

## Simulator dogfooding

Every PR gets an iOS simulator URL posted to the scoreboard bot comment (via `device-preview.yml`). Click the `📱 Device preview` link to open the simulator in your browser — no Xcode, no physical device needed. The orchestrator agent also drives this simulator via `scripts/drive-appetize.mjs` pre-review, capturing screenshots and detecting crashes. Appetize free tier = 100 simulator-minutes/month; stays well under cap at ~3 min/PR. If the Appetize upload fails, device-preview.yml posts a warning comment but never blocks CI (soft fail).

---

## 3. Closed-loop workflow

One command verifies your work end-to-end. Copy-paste and execute:

```bash
pnpm verify
```

Steps: typecheck → lint → test:coverage (≥70%) → build:web → size-limit → Playwright e2e/screenshots.
On headless machines use `pnpm verify:fast` (skips Playwright); CI runs the full gate.

After pushing: read the PR scoreboard bot comment (`<!-- obvious-mobile-scoreboard:v1 -->`).
If scoreboard shows red, fix before requesting review.

Module-scoped fast loop:

```bash
pnpm test --run src/modules/<name>   # one module, no watch
```

---

## 4. Architecture contract

- **Screens** (`src/app/`) — JSX + local state only. No business logic, no fetch calls.
- **Modules** (`src/modules/<name>/`) — feature logic, hooks, types. Read `spec.md` before editing.
- **Services** (`src/services/`) — API client + endpoint functions. Only place `fetch` is called.
- **State** — Zustand slices in `src/store/` (client state). React Query for server state.
- Screens and modules never call `fetch` directly — delegate to a service function.
- Every module has a `spec.md`. Read it before modifying the module.

---

## 5. Directory ownership

```
src/app/           — expo-router screens only; no business logic
src/modules/       — feature modules; each has spec.md + index.ts + tests
  auth/            — session, tokens, login/logout
  feed/            — activity feed, posts
  workouts/        — workout plans, tracking
  mood/            — mood logging
  food/            — food logging, nutrition
  mepod/           — MePod health data aggregation
  energy/          — energy level tracking
  marketplace/     — in-app marketplace
src/services/      — API client; MSW mocks in __mocks__/
src/components/    — shared UI primitives (no business logic)
src/hooks/         — shared React hooks
src/store/         — Zustand slices
src/types/         — shared TypeScript interfaces
assets/            — images, fonts, audio (read-only for agents)
maestro/flows/     — E2E YAML (Maestro; not in PR CI)
performance.config.ts — authoritative budget numbers
```

---

## 6. Hard rules

- No `any` types outside test files — treat `noExplicitAny` as error in module code.
- Named exports only — no default exports.
- `pnpm` only — never `npm` or `yarn`.
- No `eas build` / `expo run:ios` in agent sessions.
- No direct `fetch` in screens or modules — use `src/services/`.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Budget loosening requires `perf-budget-change` label + human approval. Never silently increase.
- Do not touch `assets/` unless the task explicitly involves asset changes.
- Update `spec.md` when changes alter a module's responsibilities, public API, or perf budget.

---

## 7. Workflow

1. Before modifying a module → read `src/modules/<name>/spec.md`.
2. Implement changes scoped to that module directory.
3. Run `pnpm test --run src/modules/<name>` to verify in isolation.
4. Run `pnpm verify` (full gate) before committing.
5. Check PR scoreboard after push; fix any red before requesting review.
6. If changes alter module responsibilities or public API → update `spec.md`.

---

## 8. Named subagents

### screen-builder
Builds new screens in `src/app/`. Creates file, wires expo-router navigation, writes one RNTL
component test. Does NOT touch module logic or services.

### module-builder
Implements or extends feature modules in `src/modules/`. Reads `spec.md` first. Writes unit
tests. Does NOT create screens or add API calls.

### api-integrator
Adds or updates API calls in `src/services/`. Does NOT put fetch calls in screens or modules.
Reads the relevant service file before adding to it. Adds MSW handler for each new endpoint.

### test-writer
Writes or updates tests for existing code using vitest-native + RNTL. Reads `spec.md` for the
module under test first. Never modifies production code.

### perf-investigator
Investigates render-budget breaches, TTI regressions, and bundle-size hotspots. Reads scoreboard
data and React.Profiler output; produces a findings doc. Never modifies production code.
