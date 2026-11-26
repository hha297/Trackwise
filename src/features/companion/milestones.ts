import { shiftDiaryDateKey } from '@/features/engagement/dates';
import { computeLoggingStreak } from '@/features/engagement/streaks';

import {
  CONSISTENCY_MILESTONES,
  ENGAGEMENT_MIN_ACTIVE_DAYS,
  ENGAGEMENT_SPAN_DAYS,
  FOOD_DAY_MILESTONES,
  NUTRITION_ON_TRACK_MILESTONE_DAYS,
  WORKOUT_COUNT_MILESTONES,
} from './constants';
import { daysBetweenDiaryKeys, minDiaryDateKey } from './dates';
import { nutritionDaysOnTrack } from './tips';
import type { JourneyMilestone, MilestoneId } from './types';

export type MilestoneInput = {
  todayKey: string;
  /** Completed workouts, oldest first. */
  completedWorkoutKeys: string[];
  nutritionKeys: string[];
  unionKeys: string[];
  calorieTarget: number | null;
  nutritionDays: { dateKey: string; calories: number; hasFood: boolean }[];
};

const MILESTONE_CATEGORY: Record<MilestoneId, JourneyMilestone['category']> = {
  first_workout: 'workout',
  workouts_10: 'workout',
  workouts_25: 'workout',
  workouts_50: 'workout',
  first_food_day: 'nutrition',
  food_days_7: 'nutrition',
  food_days_30: 'nutrition',
  nutrition_on_track_7: 'nutrition',
  consistency_7: 'consistency',
  consistency_28: 'consistency',
  engagement_90: 'consistency',
};

function uniqueSorted(keys: Iterable<string>): string[] {
  return [...new Set(keys)].filter(Boolean).sort();
}

function countThreshold(
  ordered: string[],
  count: number,
  id: MilestoneId,
): JourneyMilestone | null {
  if (ordered.length < count) return null;
  const achievedOn = ordered[count - 1];
  if (!achievedOn) return null;
  return {
    id,
    category: MILESTONE_CATEGORY[id],
    achievedOn,
    stat: count,
  };
}

function dateOfNthUniqueDay(keys: string[], n: number, id: MilestoneId): JourneyMilestone | null {
  const unique = uniqueSorted(keys);
  return countThreshold(unique, n, id);
}

/**
 * Idempotent, derived milestones. Recalculating the same history always yields
 * the same id + achievedOn. No persistence required for uniqueness.
 *
 * Skipped (cannot be verified from current tables without extra fetches):
 * personal records, strength % gains, weight-loss, calorie-deficit streaks.
 */
export function deriveJourneyMilestones(input: MilestoneInput): JourneyMilestone[] {
  const workouts = input.completedWorkoutKeys.filter(Boolean);
  const nutrition = uniqueSorted(input.nutritionKeys);
  const union = uniqueSorted(input.unionKeys);
  const found: JourneyMilestone[] = [];

  if (workouts.length >= 1) {
    found.push({
      id: 'first_workout',
      category: 'workout',
      achievedOn: workouts[0]!,
      stat: 1,
    });
  }
  for (const count of WORKOUT_COUNT_MILESTONES) {
    if (count === 1) continue;
    const row = countThreshold(workouts, count, `workouts_${count}` as MilestoneId);
    if (row) found.push(row);
  }

  const food1 = dateOfNthUniqueDay(nutrition, FOOD_DAY_MILESTONES[0], 'first_food_day');
  if (food1) found.push({ ...food1, stat: 1 });
  const food7 = dateOfNthUniqueDay(nutrition, FOOD_DAY_MILESTONES[1], 'food_days_7');
  if (food7) found.push(food7);
  const food30 = dateOfNthUniqueDay(nutrition, FOOD_DAY_MILESTONES[2], 'food_days_30');
  if (food30) found.push(food30);

  if (input.calorieTarget != null && input.calorieTarget > 0) {
    const onTrack = nutritionDaysOnTrack({
      days: input.nutritionDays,
      todayKey: input.todayKey,
      target: input.calorieTarget,
    });
    const row = countThreshold(onTrack, NUTRITION_ON_TRACK_MILESTONE_DAYS, 'nutrition_on_track_7');
    if (row) found.push(row);
  }

  const streak = computeLoggingStreak(union, input.todayKey);
  for (const days of CONSISTENCY_MILESTONES) {
    if (streak.longest < days) continue;
    const id = days === 7 ? 'consistency_7' : 'consistency_28';
    const achievedOn = streakEndForLength(union, days) ?? union[days - 1] ?? input.todayKey;
    found.push({
      id,
      category: 'consistency',
      achievedOn,
      stat: days,
    });
  }

  const firstActive = minDiaryDateKey(union);
  if (firstActive) {
    const span = daysBetweenDiaryKeys(firstActive, input.todayKey) + 1;
    const activeCount = union.filter((key) => key <= input.todayKey).length;
    if (span >= ENGAGEMENT_SPAN_DAYS && activeCount >= ENGAGEMENT_MIN_ACTIVE_DAYS) {
      const spanDate = shiftDiaryDateKey(firstActive, ENGAGEMENT_SPAN_DAYS - 1);
      const thirtieth = uniqueSorted(union)[ENGAGEMENT_MIN_ACTIVE_DAYS - 1] ?? spanDate;
      found.push({
        id: 'engagement_90',
        category: 'consistency',
        achievedOn: spanDate > thirtieth ? spanDate : thirtieth,
        stat: activeCount,
      });
    }
  }

  return found.sort((a, b) => {
    const byDate = a.achievedOn.localeCompare(b.achievedOn);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}

/** First date at which a consecutive run of `length` active days completed. */
export function streakEndForLength(activeKeys: Iterable<string>, length: number): string | null {
  const keys = uniqueSorted(activeKeys);
  if (keys.length < length) return null;
  let run = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1]!;
    const cur = keys[i]!;
    const gap = daysBetweenDiaryKeys(prev, cur);
    run = gap === 1 ? run + 1 : 1;
    if (run >= length) return cur;
  }
  return null;
}
