/**
 * RationaleGenerator — fills in template strings from card_catalog.
 * Per spec §11: observational-warm, ≤1 fact on short, ≤2 facts on expanded.
 */
import type { CatalogCard, UserModel } from './types.ts';

interface TemplateVars {
  days: string;
  sessions_count: string;
  dip_day: string;
  area: string;
  time_ago: string;
  reason: string;
  reason_short: string;
  reason_full: string;
  muscle_group: string;
  week_observation: string;
  pattern_observation: string;
  duration: string;
}

function buildVars(card: CatalogCard, user: UserModel): TemplateVars {
  const { recent_behavior_json, latest_body_state_json, constraints_json } = user;

  const lastSessionHours = recent_behavior_json.last_session_hours_ago ?? 72;
  const daysSinceLastSession = Math.round(lastSessionHours / 24);
  const daysText = daysSinceLastSession === 1 ? "a day" : `${daysSinceLastSession}`;

  const areas = constraints_json.discomfort_areas;
  const areaText = areas.length > 0 ? (areas[0] ?? 'an area').replace('_', ' ') : 'an area';

  const scanHours = latest_body_state_json.last_scan_hours_ago ?? 0;
  const scanTimeAgo = scanHours < 2 ? 'an hour ago' : `${Math.round(scanHours)} hours ago`;

  const sleep = recent_behavior_json.avg_sleep_hours_7d;
  const skips = recent_behavior_json.sessions_skipped_7d;
  let reason = '';
  let reasonShort = '';
  let reasonFull = '';

  if (areas.length > 0 && sleep < 6.5) {
    reason = `Your ${areaText} is flagged and sleep has been thin`;
    reasonShort = 'knee flagged and sleep thin';
    reasonFull = `Your ${areaText} is flagged and sleep has been short — averaging ${sleep.toFixed(0)} hours`;
  } else if (areas.length > 0) {
    reason = `Your ${areaText} is flagged`;
    reasonShort = `${areaText} flagged`;
    reasonFull = `Your ${areaText} is flagged`;
  } else if (sleep < 6.5) {
    reason = 'Sleep has been thin';
    reasonShort = 'sleep thin';
    reasonFull = `Sleep has been running short — averaging ${sleep.toFixed(0)} hours`;
  } else if (skips >= 3) {
    reason = "Three misses is a rhythm to reset, not a debt to repay";
    reasonShort = "three misses";
    reasonFull = "Three missed sessions in a row is a rhythm to reset, not a debt to repay";
  } else {
    reason = 'Today is a good day for a lighter focus';
    reasonShort = 'lighter day';
    reasonFull = 'Your body is signaling rest';
  }

  const muscleGroup = card.domain === 'strength'
    ? card.card_id.includes('lower') ? 'lower-body'
    : card.card_id.includes('upper') ? 'upper-body'
    : 'full-body'
    : card.domain;

  let weekObs = '';
  const sessions = recent_behavior_json.sessions_completed_7d;
  if (sessions >= 3) {
    weekObs = `You've been consistent this week — ${sessions} sessions logged`;
  } else if (skips >= 3) {
    weekObs = `Three missed sessions is a pattern worth noticing`;
  } else {
    weekObs = `You've logged ${sessions} sessions this week`;
  }

  const patternObs = sleep < 6.5
    ? `Sleep has been shorter than your baseline`
    : `Your patterns have been fairly consistent this week`;

  return {
    days: daysText,
    sessions_count: String(sessions),
    dip_day: 'earlier this week',
    area: areaText,
    time_ago: scanTimeAgo,
    reason,
    reason_short: reasonShort,
    reason_full: reasonFull,
    muscle_group: muscleGroup,
    week_observation: weekObs,
    pattern_observation: patternObs,
    duration: String(card.duration_min),
  };
}

function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{days\}/g, vars.days)
    .replace(/\{sessions_count\}/g, vars.sessions_count)
    .replace(/\{dip_day\}/g, vars.dip_day)
    .replace(/\{area\}/g, vars.area)
    .replace(/\{Area\}/g, vars.area.charAt(0).toUpperCase() + vars.area.slice(1))
    .replace(/\{time_ago\}/g, vars.time_ago)
    .replace(/\{reason\}/g, vars.reason)
    .replace(/\{reason_short\}/g, vars.reason_short)
    .replace(/\{Reason\}/g, vars.reason.charAt(0).toUpperCase() + vars.reason.slice(1))
    .replace(/\{reason_full\}/g, vars.reason_full)
    .replace(/\{Reason_full\}/g, vars.reason_full.charAt(0).toUpperCase() + vars.reason_full.slice(1))
    .replace(/\{muscle_group\}/g, vars.muscle_group)
    .replace(/\{week_observation\}/g, vars.week_observation)
    .replace(/\{Week_observation\}/g, vars.week_observation.charAt(0).toUpperCase() + vars.week_observation.slice(1))
    .replace(/\{pattern_observation\}/g, vars.pattern_observation)
    .replace(/\{Pattern_observation\}/g, vars.pattern_observation.charAt(0).toUpperCase() + vars.pattern_observation.slice(1))
    .replace(/\{duration\}/g, vars.duration);
}

/** Pick a template deterministically (day-of-week rotation to avoid repetition) */
function pickTemplate(templates: string[], seed?: number): string {
  const idx = (seed ?? new Date().getDay()) % templates.length;
  return templates[idx] ?? templates[0] ?? '';
}

export function renderShort(card: CatalogCard, user: UserModel): string {
  const templates = card.rationale_templates_json.short;
  const template = pickTemplate(templates);
  return fillTemplate(template, buildVars(card, user));
}

export function renderExpanded(card: CatalogCard, user: UserModel): string {
  const templates = card.rationale_templates_json.expanded;
  const template = pickTemplate(templates, new Date().getDay() + 1);
  return fillTemplate(template, buildVars(card, user));
}
