/**
 * CrossModalityLinker — sets links_to_card_id and cross_modality_note.
 * Per spec §8.5: "mobility supporting strength, hydration supporting recovery"
 */
import type { CatalogCard } from './types.ts';

interface CrossModalityResult {
  priorityLinksTo: string | null;
  supportLinksTo: Map<string, string>; // cardId → priorityCardId
  note: string | null;
}

const CROSS_MODALITY_PAIRS: Array<{
  priorityDomain: string;
  supportDomain: string;
  note: string;
}> = [
  {
    priorityDomain: 'strength',
    supportDomain: 'mobility',
    note: 'The mobility piece below is your warm-up — pair them.',
  },
  {
    priorityDomain: 'strength',
    supportDomain: 'nutrition',
    note: 'The nutrition card below closes the recovery loop.',
  },
  {
    priorityDomain: 'mobility',
    supportDomain: 'breathing',
    note: 'The breathing session below amplifies your hip work — do them together.',
  },
  {
    priorityDomain: 'mobility',
    supportDomain: 'strength',
    note: "Tomorrow's strength session will feel different after this.",
  },
  {
    priorityDomain: 'cardio',
    supportDomain: 'nutrition',
    note: 'Fuel up after the cardio session — the nutrition card below.',
  },
  {
    priorityDomain: 'recovery',
    supportDomain: 'breathing',
    note: 'The breathing session pairs naturally with recovery today.',
  },
  {
    priorityDomain: 'breathing',
    supportDomain: 'mobility',
    note: 'The mobility piece below works with the breathing to open things up.',
  },
];

export function findCrossModality(
  priority: CatalogCard,
  supports: CatalogCard[],
): CrossModalityResult {
  for (const pair of CROSS_MODALITY_PAIRS) {
    if (priority.domain !== pair.priorityDomain) continue;
    const linked = supports.find((s) => s.domain === pair.supportDomain);
    if (!linked) continue;

    const supportLinksTo = new Map<string, string>();
    supportLinksTo.set(linked.card_id, priority.card_id);

    return {
      priorityLinksTo: linked.card_id,
      supportLinksTo,
      note: pair.note,
    };
  }

  return {
    priorityLinksTo: null,
    supportLinksTo: new Map(),
    note: null,
  };
}
