/**
 * Feed Decision Engine — Readiness Computer
 * Derives readiness (high/medium/low) from user model.
 */
import type { Readiness, UserModel } from './types';

export function computeReadiness(user: UserModel): Readiness {
  const tap = user.latest_situation.readiness;
  const sleep = user.latest_situation.sleep_hours ?? 7;
  const discomfort = user.latest_body_state.discomfort_flags.length;
  const scanFlags = user.latest_body_state.scan_flags.length;

  // Sad tap → low regardless
  if (tap === 'sad') return 'low';

  // Low sleep → low if severe, medium if mild
  if (sleep < 5) return 'low';
  if (sleep < 6.5) {
    // Low sleep but not severe — check if other signals are OK
    if (tap === 'neutral' || discomfort > 0) return 'low';
    return 'medium';
  }

  // Discomfort flags → pull down
  if (discomfort >= 2) return 'low';
  if (discomfort === 1) {
    if (tap === 'neutral') return 'medium';
    return 'medium'; // still can't be high with active discomfort
  }

  // Scan flags with neutral tap → medium
  if (scanFlags > 0 && tap === 'neutral') return 'medium';

  // Happy + good sleep + no discomfort → high
  if (tap === 'happy' && sleep >= 6.5 && discomfort === 0) return 'high';

  // Neutral otherwise → medium
  return 'medium';
}

export function renderReadinessRationale(user: UserModel, readiness: Readiness): string {
  const tap = user.latest_situation.readiness;
  const sleep = user.latest_situation.sleep_hours;
  const discomfort = user.latest_body_state.discomfort_flags;
  const scanFlags = user.latest_body_state.scan_flags;

  if (readiness === 'high') {
    if (sleep !== undefined && sleep >= 7) {
      return `Sleep was solid last night and you're feeling ready — good day to work.`;
    }
    return `You're feeling ready and your recovery markers look good.`;
  }

  if (readiness === 'low') {
    if (tap === 'sad' && discomfort.length > 0) {
      return `You flagged tired and ${discomfort[0]} discomfort — protecting tomorrow is the priority today.`;
    }
    if (sleep !== undefined && sleep < 6) {
      return `Sleep was short — ${sleep.toFixed(1)} hours — and your body needs recovery more than effort tonight.`;
    }
    if (discomfort.length > 0) {
      return `${discomfort[0]} is flagged — today's about protecting the week, not pushing through it.`;
    }
    return `Your readiness signals are low — a quiet day protects tomorrow better than pushing would.`;
  }

  // medium
  if (scanFlags.length > 0) {
    return `Your scan flagged ${scanFlags[0]} — medium readiness today, enough to work but smart to stay targeted.`;
  }
  if (sleep !== undefined && sleep < 7) {
    return `Sleep was a bit short — medium readiness is the honest read for today.`;
  }
  return `Your readiness is steady today — good conditions for focused, moderate work.`;
}
