/**
 * Feed Decision Engine — Rationale Generator
 * Observational-warm voice per spec §11.
 * Templates are in card-catalog.json; this module fills variables.
 */
import type { CatalogCard, UserModel } from './types';

interface RationaleContext {
  user: UserModel;
  card: CatalogCard;
  now: string;
}

function pluralDays(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

function pluralSessions(n: number): string {
  return n === 1 ? '1 session' : `${n} sessions`;
}

function pickTemplate(templates: string[]): string {
  // Deterministic pick based on day of week to vary across days
  const dayIndex = new Date().getDay();
  return templates[dayIndex % templates.length] ?? templates[0] ?? '';
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

function extractVariables(ctx: RationaleContext): Record<string, string> {
  const b = ctx.user.recent_behavior;
  const s = ctx.user.latest_body_state;
  const sit = ctx.user.latest_situation;

  const hoursAgo = b.last_session_hours_ago;
  const days = Math.max(1, Math.round(hoursAgo / 24));

  // Time since last scan event — check scan_flags for timing hints
  const scanTimeAgo = s.scan_flags.length > 0 ? 'an hour ago' : 'recently';

  // Primary area from scan or discomfort
  const area =
    s.scan_flags[0]?.replace('_', ' ') ?? s.discomfort_flags[0]?.replace('_', ' ') ?? 'your area';

  // Sleep pattern
  const sleepHours = sit.sleep_hours ?? 7;
  const dipDay = sleepHours < 6.5 ? 'Tuesday' : 'recently'; // reasonable placeholder

  return {
    days: String(days),
    days_label: days === 1 ? 'day' : 'days',
    sessions_count: String(b.sessions_this_week),
    sessions_label: b.sessions_this_week === 1 ? 'session' : 'sessions',
    muscle_group: b.last_session_domain ?? 'lower-body',
    area,
    time_ago: scanTimeAgo,
    reason_short: sit.readiness === 'sad' ? "you're running low" : 'you need recovery',
    reason_full:
      sit.readiness === 'sad'
        ? 'Energy is low and your body is asking for a break'
        : 'Your signals are pointing toward recovery today',
    pattern_observation: 'Your nutrition patterns this week show room for one adjustment',
    week_observation: `You've had ${pluralSessions(b.sessions_this_week)} this week`,
    dip_day: dipDay,
    // Explicit plural helpers for templates
    pluralDays: pluralDays(days),
    pluralSessions: pluralSessions(b.sessions_this_week),
  };
}

export function renderShort(ctx: RationaleContext): string {
  const template = pickTemplate(ctx.card.rationale_templates.short);
  return fillTemplate(template, extractVariables(ctx));
}

export function renderExpanded(ctx: RationaleContext): string {
  const template = pickTemplate(ctx.card.rationale_templates.expanded);
  return fillTemplate(template, extractVariables(ctx));
}

// Find cross-modality link note
export function findCrossModalityNote(
  priorityCard: CatalogCard,
  supportCards: CatalogCard[],
): string | null {
  for (const support of supportCards) {
    if (priorityCard.cross_modality_domains?.includes(support.domain)) {
      if (priorityCard.domain === 'strength' && support.domain === 'mobility') {
        return `The mobility piece below is your warm-up — pair them.`;
      }
      if (priorityCard.domain === 'mobility' && support.domain === 'strength') {
        return `Tomorrow's strength session will feel different after this.`;
      }
      if (priorityCard.domain === 'breathing' && support.domain === 'recovery') {
        return `We'll come back to strength Friday if things settle.`;
      }
      if (priorityCard.domain === 'cardio' && support.domain === 'mobility') {
        return `If this lands well, tomorrow we can step it up.`;
      }
      return null;
    }
  }
  return null;
}

// Determine links_to_card_id for a card
export function findLinkedCardId(
  priorityCard: CatalogCard,
  supportCards: CatalogCard[],
): string | null {
  for (const support of supportCards) {
    if (priorityCard.cross_modality_domains?.includes(support.domain)) {
      return support.card_id;
    }
  }
  return null;
}
