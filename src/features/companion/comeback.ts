import { COMEBACK_INACTIVITY_DAYS } from './constants';
import { daysBetweenDiaryKeys } from './dates';
import type { ComebackDecision, ComebackState } from './types';

export type ComebackInput = {
  todayKey: string;
  /** Latest local day with food, water, a completed workout, or similar logged activity. */
  lastMeaningfulActivityKey: string | null;
  /** Previously shown for this inactivity period, if any. */
  previous: ComebackState | null;
  inactivityDays?: number;
};

/**
 * Welcome-back is for returning users only.
 *
 * Meaningful activity = diary logs (food / water / completed workout), not app opens.
 * Brand-new users (no activity yet) are never treated as returning.
 * Shown at most once per inactivity period, identified by lastMeaningfulActivityKey.
 */
export function evaluateComeback(input: ComebackInput): ComebackDecision {
  const threshold = input.inactivityDays ?? COMEBACK_INACTIVITY_DAYS;
  const last = input.lastMeaningfulActivityKey;

  if (!last) {
    return {
      eligible: false,
      reason: 'new_user',
      lastActivityKey: null,
      inactiveDays: 0,
    };
  }

  const inactiveDays = daysBetweenDiaryKeys(last, input.todayKey);
  if (inactiveDays < 0) {
    return {
      eligible: false,
      reason: 'active',
      lastActivityKey: last,
      inactiveDays: 0,
    };
  }
  if (inactiveDays === 0) {
    return {
      eligible: false,
      reason: 'active',
      lastActivityKey: last,
      inactiveDays: 0,
    };
  }
  if (inactiveDays < threshold) {
    return {
      eligible: false,
      reason: 'below_threshold',
      lastActivityKey: last,
      inactiveDays,
    };
  }

  if (input.previous?.lastActivityAtShow === last) {
    return {
      eligible: false,
      reason: 'already_shown',
      lastActivityKey: last,
      inactiveDays,
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
    lastActivityKey: last,
    inactiveDays,
  };
}

export function comebackShownState(todayKey: string, lastActivityKey: string): ComebackState {
  return { lastActivityAtShow: lastActivityKey, shownOn: todayKey };
}
