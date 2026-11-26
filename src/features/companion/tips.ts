import { classifyDayCalories } from '@/features/diary/goal-status';
import { computeLoggingStreak } from '@/features/engagement/streaks';

import { PROTEIN_REMAINING_MIN_G, TIP_COOLDOWN_DAYS } from './constants';
import { daysBetweenDiaryKeys, maxDiaryDateKey } from './dates';
import type { CompanionSuggestion, OverduePlanSummary } from './types';

export type TipRuleId =
  | 'protein_trend_low'
  | 'logging_gap'
  | 'missed_sessions'
  | 'habit_streak'
  | 'restart_simple';

export type ProteinDay = {
  dateKey: string;
  proteinG: number;
  calories: number;
};

export type TipInput = {
  todayKey: string;
  proteinTargetG: number | null;
  calorieTarget: number | null;
  recentProteinDays: ProteinDay[];
  nutritionKeys: string[];
  workoutKeys: string[];
  unionKeys: string[];
  overdueInWeek: OverduePlanSummary[];
  tipsShown: Record<string, string>;
  cooldownDays?: number;
};

const TIP_PRIORITY: Record<TipRuleId, number> = {
  protein_trend_low: 0,
  missed_sessions: 1,
  logging_gap: 2,
  restart_simple: 3,
  habit_streak: 4,
};

function onCooldown(
  id: TipRuleId,
  todayKey: string,
  tipsShown: Record<string, string>,
  cooldownDays: number,
): boolean {
  const last = tipsShown[id];
  if (!last) return false;
  return daysBetweenDiaryKeys(last, todayKey) < cooldownDays;
}

function completedPastDays(days: ProteinDay[], todayKey: string): ProteinDay[] {
  return days.filter((day) => day.dateKey < todayKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

function proteinTrendLow(input: TipInput): boolean {
  if (input.proteinTargetG == null || !(input.proteinTargetG > 0)) return false;
  const past = completedPastDays(input.recentProteinDays, input.todayKey).slice(-3);
  if (past.length < 3) return false;
  return past.every((day) => input.proteinTargetG! - day.proteinG >= PROTEIN_REMAINING_MIN_G);
}

function loggingGap(input: TipInput): boolean {
  const lastFood = maxDiaryDateKey(input.nutritionKeys);
  if (!lastFood) return false;
  const gap = daysBetweenDiaryKeys(lastFood, input.todayKey);
  return gap >= 2 && gap < 7;
}

function missedSessions(input: TipInput): boolean {
  return input.overdueInWeek.length >= 2;
}

function habitStreak(input: TipInput): boolean {
  const streak = computeLoggingStreak(input.unionKeys, input.todayKey);
  return streak.current >= 7;
}

function restartSimple(input: TipInput): boolean {
  const last = maxDiaryDateKey(input.unionKeys);
  if (!last) return false;
  const gap = daysBetweenDiaryKeys(last, input.todayKey);
  return gap >= 3 && gap < 7;
}

function tip(
  id: TipRuleId,
  category: CompanionSuggestion['category'],
  cta: CompanionSuggestion['cta'],
  params: CompanionSuggestion['params'] = {},
): CompanionSuggestion {
  return {
    id,
    category,
    priority: TIP_PRIORITY[id],
    dismissible: true,
    params,
    cta,
  };
}

/**
 * Deterministic, one-at-a-time tips. Rules that do not match are omitted.
 * Conflicting restart vs habit: habit requires an alive 7-day streak, restart requires a gap.
 */
export function matchContextualTips(input: TipInput): CompanionSuggestion[] {
  const cooldown = input.cooldownDays ?? TIP_COOLDOWN_DAYS;
  const matched: CompanionSuggestion[] = [];

  if (proteinTrendLow(input)) {
    matched.push(tip('protein_trend_low', 'tip', { href: '/food/add', params: { intent: 'log', date: input.todayKey } }));
  }
  if (missedSessions(input)) {
    matched.push(tip('missed_sessions', 'tip', { href: '/workout/plan' }));
  }
  if (loggingGap(input) && !proteinTrendLow(input)) {
    matched.push(
      tip('logging_gap', 'tip', { href: '/food/add', params: { intent: 'log', date: input.todayKey } }),
    );
  }
  if (restartSimple(input) && !habitStreak(input)) {
    matched.push(tip('restart_simple', 'tip', { href: '/(tabs)/workout' }));
  }
  if (habitStreak(input)) {
    matched.push(tip('habit_streak', 'tip', { href: '/(tabs)/progress' }));
  }

  return matched
    .filter((item) => !onCooldown(item.id as TipRuleId, input.todayKey, input.tipsShown, cooldown))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function nutritionDaysOnTrack(input: {
  days: { dateKey: string; calories: number; hasFood: boolean }[];
  todayKey: string;
  target: number;
}): string[] {
  return input.days
    .filter((day) => day.dateKey < input.todayKey && day.hasFood)
    .filter(
      (day) =>
        classifyDayCalories({
          consumed: day.calories,
          target: input.target,
          dateKey: day.dateKey,
          todayKey: input.todayKey,
          hasFoodLogs: true,
        }) === 'achieved',
    )
    .map((day) => day.dateKey)
    .sort();
}
