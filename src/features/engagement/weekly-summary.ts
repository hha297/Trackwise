import { entriesToMacros, weekDateKeys } from '@/features/diary/aggregations';
import type { FoodEntry } from '@/features/food/types';

/**
 * Factual weekly engagement summary (Mon–Sun via weekDateKeys).
 * No invented achievement thresholds — progress is “X of 7 days” / counts only.
 */

export type WeeklySummaryInput = {
  anchorKey: string;
  foodLoggedDayKeys: Iterable<string>;
  hydrationLoggedDayKeys: Iterable<string>;
  /** Local day keys with ≥1 completed workout. */
  workoutCompletedDayKeys: Iterable<string>;
  /** Completed session count (may be > workout days). */
  completedWorkoutSessions: number;
  foodEntriesInWeek: Pick<FoodEntry, 'logged_on' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[];
  hydrationAmountByDay: Map<string, number>;
  hydrationTargetMl: number | null;
};

export type WeeklySummary = {
  weekStartKey: string;
  weekEndKey: string;
  weekKeys: string[];
  nutritionLoggingDays: number;
  hydrationLoggingDays: number;
  workoutDays: number;
  completedWorkoutSessions: number;
  /** Average daily calories across days that have food logs; null if none. */
  avgCalories: number | null;
  /** Average daily protein (g) across food-logged days; null if none. */
  avgProteinG: number | null;
  /**
   * Mean of (day intake / target) capped per day at 1, across week days with a target.
   * Null when target missing or no hydration logs.
   */
  hydrationTargetProgress: number | null;
  totalHydrationMl: number;
};

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const weekKeys = weekDateKeys(input.anchorKey);
  const weekStartKey = weekKeys[0]!;
  const weekEndKey = weekKeys[weekKeys.length - 1]!;
  const inWeek = (key: string) => key >= weekStartKey && key <= weekEndKey;

  const nutritionDays = new Set(
    [...new Set(input.foodLoggedDayKeys)].filter(inWeek),
  );
  const hydrationDays = new Set(
    [...new Set(input.hydrationLoggedDayKeys)].filter(inWeek),
  );
  const workoutDays = new Set(
    [...new Set(input.workoutCompletedDayKeys)].filter(inWeek),
  );

  const weekFood = input.foodEntriesInWeek.filter((entry) => inWeek(entry.logged_on));
  const byDay = new Map<string, typeof weekFood>();
  for (const entry of weekFood) {
    const list = byDay.get(entry.logged_on) ?? [];
    list.push(entry);
    byDay.set(entry.logged_on, list);
  }

  let avgCalories: number | null = null;
  let avgProteinG: number | null = null;
  if (byDay.size > 0) {
    let sumCal = 0;
    let sumP = 0;
    for (const entries of byDay.values()) {
      const macros = entriesToMacros(entries);
      sumCal += macros.calories;
      sumP += macros.proteinG;
    }
    avgCalories = Math.round(sumCal / byDay.size);
    avgProteinG = Math.round((sumP / byDay.size) * 10) / 10;
  }

  let totalHydrationMl = 0;
  for (const key of weekKeys) {
    totalHydrationMl += input.hydrationAmountByDay.get(key) ?? 0;
  }

  let hydrationTargetProgress: number | null = null;
  const target = input.hydrationTargetMl;
  if (target != null && target > 0 && hydrationDays.size > 0) {
    let sumRatio = 0;
    for (const key of weekKeys) {
      const amount = input.hydrationAmountByDay.get(key) ?? 0;
      sumRatio += Math.min(1, amount / target);
    }
    hydrationTargetProgress = Math.round((sumRatio / weekKeys.length) * 100) / 100;
  }

  return {
    weekStartKey,
    weekEndKey,
    weekKeys,
    nutritionLoggingDays: nutritionDays.size,
    hydrationLoggingDays: hydrationDays.size,
    workoutDays: workoutDays.size,
    completedWorkoutSessions: input.completedWorkoutSessions,
    avgCalories,
    avgProteinG,
    hydrationTargetProgress,
    totalHydrationMl,
  };
}
