# auth

## Purpose

<!-- TODO: fill in before implementing this module -->
Manages user authentication: session lifecycle, token storage, login/logout flows, and
session refresh. Exists as a separate module because auth state is a cross-cutting concern
consumed by every other module and every screen.

## Responsibilities

Owns:
- Auth session state (access token, refresh token, expiry)
- Login, logout, and token-refresh logic
- Persisting session to secure storage

Does NOT own:
- User profile data (belongs in a future `profile` module)
- Navigation after login (belongs in `src/app/(auth)/`)
- API request auth headers (belongs in `src/services/api.ts`)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useAuthSession } from './hooks/useAuthSession'
// export { authStore } from './store'
// export type { AuthSession, AuthState } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 3 (leaf screen budget from performance.config.ts)
- Token-refresh round-trip: < 500 ms (network budget; fails silently if exceeded)
- No new allocations in the auth-check hot path (called on every navigation event)

## Closed-loop check

```bash
# Run before every commit that touches src/modules/auth/
pnpm test --run src/modules/auth
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: which secure storage library to use (SecureStore vs Keychain)
- Decision: token refresh strategy (proactive vs reactive)
- Decision: session persistence format

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: storing tokens in AsyncStorage (insecure). Use SecureStore or equivalent.
- Forbidden: calling fetch directly — use `src/services/api.ts` for all HTTP.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
