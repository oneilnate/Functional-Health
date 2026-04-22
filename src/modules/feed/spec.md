# feed

## Purpose

<!-- TODO: fill in before implementing this module -->
Renders the user's activity feed: posts, updates, and social interactions from
their network. Exists as a separate module because feed data has its own fetching
cadence, pagination, and optimistic-update logic distinct from other features.

## Responsibilities

Owns:
- Feed item data fetching and pagination
- Feed item types and state shape
- Optimistic updates for reactions/comments

Does NOT own:
- Individual post detail views (belongs in a future `posts` module or screen)
- User profile data (belongs in a future `profile` module)
- Navigation to detail screens (belongs in `src/app/(tabs)/feed.tsx`)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useFeed } from './hooks/useFeed'
// export { FeedList } from './components/FeedList'
// export type { FeedItem, FeedState } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 6 (container screen budget — feed is a scroll container)
- First item visible: < 500 ms after mount (perceived performance target)
- List items: use FlatList with `getItemLayout` to avoid layout thrash
- No re-renders on scroll position change (memoize list items)

## Closed-loop check

```bash
# Run before every commit that touches src/modules/feed/
pnpm test --run src/modules/feed
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: pagination strategy (cursor vs offset)
- Decision: React Query stale time for feed data
- Decision: optimistic update rollback strategy

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/feed.service.ts`.
- Forbidden: putting feed logic in the screen file `src/app/(tabs)/feed.tsx`.
- Use FlatList, not ScrollView + map, for feed rendering.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
