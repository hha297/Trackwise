import { classifyDayCalories } from '@/features/diary/goal-status';

import { CALORIES_CLOSE_RATIO, PROTEIN_REMAINING_MIN_G } from './constants';
import { daysBetweenDiaryKeys } from './dates';
import type { CompanionInput, CompanionSuggestion } from './types';

/**
 * Daily Companion priority (lowest number wins). One suggestion at a time.
 *
 *  10  scheduled_workout   — planned workout today, not completed
 *  20  overdue_workout     — missed planned session; offer reschedule, no guilt
 *  30  log_food            — no meals logged today
 *  40  protein_remaining   — food logged, protein still meaningfully below target
 *  50  calories_close      — approaching calorie target; never "eat less"
 *  60  nutrition_complete  — calorie (and protein if set) targets reached
 *  70  workout_complete    — today's session done
 *  75  rest_day            — planned rest/recovery today
 *  80  optional_activity   — no plan, history exists, nothing completed today
 *  90+ contextual tips     — pattern-based, cooldown already applied
 * 110  multi_progress      — food + workout today
 * 120  partial_day         — some of today's routine done
 * 130  welcome             — insufficient data for personalization
 *
 * Dismissed ids are skipped. Completing the suggested action changes the data,
 * so the next evaluation naturally picks a different suggestion.
 */
export const COMPANION_PRIORITY = {
  scheduled_workout: 10,
  overdue_workout: 20,
  log_food: 30,
  protein_remaining: 40,
  calories_close: 50,
  nutrition_complete: 60,
  workout_complete: 70,
  rest_day: 75,
  optional_activity: 80,
  tip_base: 90,
  multi_progress: 110,
  partial_day: 120,
  welcome: 130,
} as const;

function dismissKey(id: string, todayKey: string): string {
  return `${id}:${todayKey}`;
}

function isDismissed(id: string, todayKey: string, dismissed: ReadonlySet<string>): boolean {
  return dismissed.has(id) || dismissed.has(dismissKey(id, todayKey));
}

function proteinRemainingG(input: CompanionInput): number | null {
  if (input.proteinTargetG == null || !(input.proteinTargetG > 0)) return null;
  return Math.round(input.proteinTargetG - input.consumedProteinG);
}

function caloriesOnTrack(input: CompanionInput): boolean {
  if (input.calorieTarget == null || !(input.calorieTarget > 0) || !input.hasFoodLogsToday) {
    return false;
  }
  return (
    classifyDayCalories({
      consumed: input.consumedCalories,
      target: input.calorieTarget,
      dateKey: input.todayKey,
      todayKey: input.todayKey,
      hasFoodLogs: true,
    }) === 'achieved'
  );
}

function caloriesClose(input: CompanionInput): boolean {
  if (input.calorieTarget == null || !(input.calorieTarget > 0) || !input.hasFoodLogsToday) {
    return false;
  }
  if (input.consumedCalories > input.calorieTarget) return false;
  const ratio = input.consumedCalories / input.calorieTarget;
  return ratio >= CALORIES_CLOSE_RATIO;
}

function foodCta(dateKey: string): CompanionSuggestion['cta'] {
  return { href: '/food/add', params: { intent: 'log', date: dateKey } };
}

export function buildCompanionCandidates(input: CompanionInput): CompanionSuggestion[] {
  const candidates: CompanionSuggestion[] = [];
  const todayWorkoutDone = input.completedWorkoutsToday > 0;
  const todayWorkoutPending =
    input.todayPlan?.kind === 'workout' && !input.todayPlan.completedWorkoutId && !todayWorkoutDone;
  const todayRest =
    input.todayPlan?.kind === 'rest' || input.todayPlan?.kind === 'recovery';

  if (todayWorkoutPending) {
    candidates.push({
      id: 'scheduled_workout',
      category: 'workout',
      priority: COMPANION_PRIORITY.scheduled_workout,
      dismissible: true,
      params: { title: input.todayPlan?.title ?? '' },
      cta: { href: '/(tabs)/workout' },
    });
  }

  if (!todayWorkoutPending && input.overduePlans.length > 0 && !todayWorkoutDone) {
    const overdue = input.overduePlans[0]!;
    candidates.push({
      id: 'overdue_workout',
      category: 'workout',
      priority: COMPANION_PRIORITY.overdue_workout,
      dismissible: true,
      params: { date: overdue.planDate, title: overdue.title ?? '' },
      cta: { href: '/workout/plan' },
    });
  }

  if (!input.hasFoodLogsToday) {
    candidates.push({
      id: 'log_food',
      category: 'nutrition',
      priority: COMPANION_PRIORITY.log_food,
      dismissible: true,
      params: {},
      cta: foodCta(input.dateKey),
    });
  }

  const proteinLeft = proteinRemainingG(input);
  if (input.hasFoodLogsToday && proteinLeft != null && proteinLeft >= PROTEIN_REMAINING_MIN_G) {
    candidates.push({
      id: 'protein_remaining',
      category: 'nutrition',
      priority: COMPANION_PRIORITY.protein_remaining,
      dismissible: true,
      params: { grams: proteinLeft },
      cta: foodCta(input.dateKey),
    });
  }

  if (caloriesClose(input) && !caloriesOnTrack(input)) {
    candidates.push({
      id: 'calories_close',
      category: 'nutrition',
      priority: COMPANION_PRIORITY.calories_close,
      dismissible: true,
      params: {
        consumed: Math.round(input.consumedCalories),
        target: Math.round(input.calorieTarget ?? 0),
      },
      cta: { href: '/(tabs)/progress' },
    });
  }

  const proteinMet = proteinLeft == null || proteinLeft <= 0;
  if (caloriesOnTrack(input) && proteinMet) {
    candidates.push({
      id: 'nutrition_complete',
      category: 'nutrition',
      priority: COMPANION_PRIORITY.nutrition_complete,
      dismissible: true,
      params: {},
      cta: { href: '/(tabs)/progress' },
    });
  }

  if (todayWorkoutDone) {
    candidates.push({
      id: 'workout_complete',
      category: 'workout',
      priority: COMPANION_PRIORITY.workout_complete,
      dismissible: true,
      params: {},
      cta: { href: '/(tabs)/progress' },
    });
  }

  if (todayRest && !todayWorkoutDone) {
    candidates.push({
      id: 'rest_day',
      category: 'workout',
      priority: COMPANION_PRIORITY.rest_day,
      dismissible: true,
      params: {},
      cta: { href: '/workout/plan' },
    });
  }

  if (!todayPlanBlocksOptional(input) && !todayWorkoutDone && input.hasWorkoutHistory) {
    candidates.push({
      id: 'optional_activity',
      category: 'workout',
      priority: COMPANION_PRIORITY.optional_activity,
      dismissible: true,
      params: {},
      cta: { href: '/(tabs)/workout' },
    });
  }

  for (const tip of input.tips) {
    candidates.push({
      ...tip,
      priority: COMPANION_PRIORITY.tip_base + tip.priority,
    });
  }

  if (input.hasFoodLogsToday && todayWorkoutDone) {
    candidates.push({
      id: 'multi_progress',
      category: 'general',
      priority: COMPANION_PRIORITY.multi_progress,
      dismissible: true,
      params: {},
      cta: { href: '/(tabs)/progress' },
    });
  } else if (input.hasFoodLogsToday || todayWorkoutDone) {
    candidates.push({
      id: 'partial_day',
      category: 'general',
      priority: COMPANION_PRIORITY.partial_day,
      dismissible: true,
      params: {},
      cta: input.hasFoodLogsToday ? { href: '/(tabs)/workout' } : foodCta(input.dateKey),
    });
  }

  const quietDays =
    input.lastMeaningfulActivityKey == null
      ? null
      : daysBetweenDiaryKeys(input.lastMeaningfulActivityKey, input.todayKey);
  if (!input.hasGoal || (quietDays == null && !input.hasFoodLogsToday && !input.hasWorkoutHistory)) {
    candidates.push({
      id: 'welcome',
      category: 'general',
      priority: COMPANION_PRIORITY.welcome,
      dismissible: true,
      params: {},
      cta: foodCta(input.dateKey),
    });
  }

  return candidates;
}

function todayPlanBlocksOptional(input: CompanionInput): boolean {
  if (!input.todayPlan) return false;
  if (input.todayPlan.kind === 'rest' || input.todayPlan.kind === 'recovery') return true;
  return input.todayPlan.kind === 'workout';
}

export function selectCompanionSuggestion(input: CompanionInput): CompanionSuggestion | null {
  if (input.dateKey !== input.todayKey) return null;

  const ranked = buildCompanionCandidates(input)
    .filter((item) => !isDismissed(item.id, input.todayKey, input.dismissedIds))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  return ranked[0] ?? null;
}

export function companionDismissKey(id: string, todayKey: string): string {
  return dismissKey(id, todayKey);
}
