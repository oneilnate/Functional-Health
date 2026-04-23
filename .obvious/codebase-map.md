| Path | Purpose | Read before editing |
|---|---|---|
| `src/` | All application source code | `AGENTS.md` |
| `src/app/` | expo-router screens (JSX + local state only; no business logic) | `AGENTS.md` §4 |
| `src/modules/` | Feature modules — each has `spec.md`, `index.ts`, tests | `AGENTS.md` §5 |
| `src/modules/auth/` | Session, tokens, login/logout | `spec.md` |
| `src/modules/energy/` | Energy level tracking | `spec.md` |
| `src/modules/feed/` | Activity feed module (logic, hooks, types, tests) | `spec.md` |
| `src/modules/food/` | Food logging and nutrition | `spec.md` |
| `src/modules/marketplace/` | In-app marketplace | `spec.md` |
| `src/modules/mepod/` | MePod health data aggregation | `spec.md` |
| `src/modules/mood/` | Mood logging | `spec.md` |
| `src/modules/workouts/` | Workout plans and tracking | `spec.md` |
| `src/services/` | API client + endpoint functions (only place `fetch` is called) | `AGENTS.md` §4 |
| `src/components/` | Shared UI primitives (no business logic) | — |
| `src/hooks/` | Shared React hooks | — |
| `src/store/` | Zustand slices (client state) | — |
| `src/types/` | Shared TypeScript interfaces | — |
| `src/constants/` | App-wide constants | — |
| `.github/` | GitHub config and workflow definitions | — |
| `.github/workflows/` | CI: `ci.yml`, `scoreboard.yml`, `device-preview.yml`, `deploy-web.yml` (pending), `label-sync.yml` | `AGENTS.md` |
| `assets/` | Images, fonts, audio (read-only for agents) | `AGENTS.md` §6 |
| `e2e/` | Playwright E2E tests and screenshot specs | `AGENTS.md` §1 |
| `maestro/` | Maestro flow YAML for device E2E (not in PR CI) | — |
| `scripts/` | Utility scripts incl. `drive-appetize.mjs` | — |
| `perf/` | Performance benchmark tooling | `performance.config.ts` |
| `playwright.config.ts` | Playwright runner config | — |
| `performance.config.ts` | Authoritative budget numbers (source of truth for all limits) | Always |
| `eas.json` | EAS Build / Hosting profiles | — |
| `app.json` | Expo app config | — |
| `package.json` | Scripts, deps, size-limit config | — |
| `AGENTS.md` | Agent contract (commands, budgets, architecture, hard rules) | Always |

