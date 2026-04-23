/**
 * ReadinessComputer — computes readiness from the five-layer user model.
 * Returns 'high' | 'medium' | 'low' and an observational-warm rationale sentence.
 */
import type { Readiness, UserModel } from './types.ts';

export interface ReadinessResult {
  readiness: Readiness;
  rationale: string;
}

/** Actual body discomfort areas — excludes scan identifiers */
function actualDiscomfortAreas(user: UserModel): string[] {
  return user.constraints_json.discomfort_areas.filter(
    (area) => !area.endsWith('_scan') && !area.startsWith('scan_'),
  );
}

export function computeReadiness(user: UserModel): ReadinessResult {
  const { latest_situation_json, recent_behavior_json } = user;

  const actualDiscomfort = actualDiscomfortAreas(user);
  const hasSevereDiscomfort =
    actualDiscomfort.length > 0 || recent_behavior_json.avg_sleep_hours_7d < 5.5;
  const hasMinorChallenges =
    recent_behavior_json.avg_sleep_hours_7d < 6.5 ||
    recent_behavior_json.stress_level === 'high' ||
    recent_behavior_json.sessions_skipped_7d > 2;

  // Sad readiness tap or severe constraints → low
  if (latest_situation_json.readiness === 'sad' || hasSevereDiscomfort) {
    return {
      readiness: 'low',
      rationale: buildLowRationale(user, actualDiscomfort),
    };
  }

  // Happy tap and no challenges → high
  if (latest_situation_json.readiness === 'happy' && !hasMinorChallenges) {
    return {
      readiness: 'high',
      rationale: buildHighRationale(user),
    };
  }

  // Everything else → medium
  return {
    readiness: 'medium',
    rationale: buildMediumRationale(user),
  };
}

function buildHighRationale(user: UserModel): string {
  const sleep = user.recent_behavior_json.avg_sleep_hours_7d;
  const sessions = user.recent_behavior_json.sessions_completed_7d;

  if (sleep >= 7) {
    return `Sleep has been solid — averaging ${sleep.toFixed(0)} hours — and you've logged ${sessions} sessions this week.`;
  }
  return `You're feeling good and your body has been responding well — ${sessions} sessions in this week.`;
}

function buildMediumRationale(user: UserModel): string {
  const hasScan = user.latest_body_state_json.last_scan_result !== null;
  const skips = user.recent_behavior_json.sessions_skipped_7d;

  if (hasScan) {
    const scanType = user.latest_body_state_json.scan_type ?? 'mobility';
    return `Your ${scanType.replace(/_/g, ' ')} scan came in recently — neutral readiness while your body adjusts.`;
  }
  if (skips > 0) {
    return `You've had a few skips this week — neutral readiness, which is a good place to start fresh.`;
  }
  return `Readiness is steady today — your body is in a good place for moderate work.`;
}

function buildLowRationale(user: UserModel, actualDiscomfort: string[]): string {
  const sleep = user.recent_behavior_json.avg_sleep_hours_7d;

  if (actualDiscomfort.length > 0 && sleep < 6.5) {
    const area = (actualDiscomfort[0] ?? 'an area').replace(/_/g, ' ');
    return `Sleep has been short and ${area} is flagged — tonight is about protecting tomorrow.`;
  }
  if (actualDiscomfort.length > 0) {
    const area = (actualDiscomfort[0] ?? 'an area').replace(/_/g, ' ');
    return `${area.charAt(0).toUpperCase() + area.slice(1)} is flagged — keeping today light protects the week ahead.`;
  }
  return `Sleep has been running short — keeping today light gives your body the recovery it's asking for.`;
}
