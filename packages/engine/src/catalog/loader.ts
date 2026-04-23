/**
 * Card catalog loader — reads the seeded JSON fixture.
 * Card catalog is seeded from a JSON file at build time; not edited in the app.
 */
import type { CatalogCard } from '../types.ts';
import rawCatalog from './card_catalog.json' with { type: 'json' };

/** All cards in the catalog */
export const ALL_CARDS: CatalogCard[] = rawCatalog as CatalogCard[];

/** Get a card by ID (throws if not found) */
export function getCard(cardId: string): CatalogCard {
  const card = ALL_CARDS.find((c) => c.card_id === cardId);
  if (!card) throw new Error(`Card not found: ${cardId}`);
  return card;
}

/** Get all cards */
export function allCards(): CatalogCard[] {
  return ALL_CARDS;
}
