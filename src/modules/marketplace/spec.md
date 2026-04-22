# marketplace

## Purpose

<!-- TODO: fill in before implementing this module -->
Manages the in-app marketplace: product catalog, browsing, and purchase initiation.
Exists as a separate module because commerce concerns (pricing, availability, cart state)
are distinct from health tracking and have their own data lifecycle.

## Responsibilities

Owns:
- Product catalog data fetching and caching
- Product detail data model
- Cart state (items, quantities, totals)
- Purchase initiation (not fulfillment — that's a backend concern)

Does NOT own:
- Payment processing or fulfillment (backend; never in the client)
- Food nutritional data for marketplace products (belongs in `food` module on import)
- Order history (future `orders` module)

## Public API

```typescript
// TODO: fill in before implementing this module
export {};
// Expected exports (stub — not implemented yet):
// export { useProductCatalog } from './hooks/useProductCatalog'
// export { useCart } from './hooks/useCart'
// export type { Product, CartItem, CartState } from './types'
```

## Performance budget

<!-- TODO: confirm values against performance.config.ts before implementing -->
- Renders on mount: ≤ 6 (container screen — product grid is a container)
- Product grid: virtualized list; no more than 12 items rendered off-screen
- Product image: lazy-loaded with placeholder; first visible image < 300 ms

## Closed-loop check

```bash
# Run before every commit that touches src/modules/marketplace/
pnpm test --run src/modules/marketplace
pnpm typecheck
pnpm lint
```

All three must exit 0 before committing changes to this module.

## Key decisions

<!-- TODO: fill in before implementing this module -->
- Decision: cart persistence strategy (in-memory vs AsyncStorage vs server-side)
- Decision: product catalog pagination (infinite scroll vs load-more vs pages)
- Decision: payment provider integration point

## Agent instructions

- Read this file before making any changes to this module.
- Run the Closed-loop check above; all must pass before commit.
- Forbidden: calling fetch directly — use `src/services/marketplace.service.ts`.
- Forbidden: implementing payment processing client-side (security boundary).
- Product images must be lazy-loaded; never block list rendering.
- Update this spec.md if changes alter responsibilities, public API, or performance budget.
