import type { FoodEntry, MealType } from '@/features/food/types';
import type { HydrationEntry } from '@/features/hydration/calculations';
import type { WorkoutListItem } from '@/features/workout/types';
import { toDiaryDateKey } from '@/utils/date';

export type ActivityHistoryKind = 'nutrition' | 'hydration' | 'workout';

export type ActivityHistoryItem = {
  id: string;
  kind: ActivityHistoryKind;
  dayKey: string;
  /** Sort key within the day (ISO timestamp or meal time). */
  sortKey: string;
  title: string;
  detail: string | null;
  calories: number | null;
  amountG: number | null;
  amountMl: number | null;
  /** Workout active duration in seconds when known. */
  durationSec: number | null;
  mealType: MealType | null;
  /** Food product / workout exercise preview URL when available. */
  imageUrl: string | null;
};

export type ActivityHistoryDay = {
  dayKey: string;
  items: ActivityHistoryItem[];
};

/** Approximate local times so meals sort with other timed activities (newest first). */
const MEAL_TIME: Record<MealType, string> = {
  breakfast: 'T08:00:00.000',
  lunch: 'T12:30:00.000',
  dinner: 'T19:00:00.000',
  snacks: 'T15:30:00.000',
};

function isCompletedWorkout(workout: WorkoutListItem): boolean {
  return (workout.status ?? 'completed') === 'completed';
}

/**
 * Merge nutrition, hydration, and completed workouts into day groups.
 * Only days with at least one activity are returned, newest first.
 */
export function buildActivityHistoryDays(input: {
  startKey: string;
  endKey: string;
  foodEntries: FoodEntry[];
  hydrationEntries: HydrationEntry[];
  workouts: WorkoutListItem[];
}): ActivityHistoryDay[] {
  const { startKey, endKey } = input;
  const byDay = new Map<string, ActivityHistoryItem[]>();

  const push = (item: ActivityHistoryItem) => {
    if (item.dayKey < startKey || item.dayKey > endKey) return;
    const list = byDay.get(item.dayKey);
    if (list) list.push(item);
    else byDay.set(item.dayKey, [item]);
  };

  for (const entry of input.foodEntries) {
    const amount = entry.amount != null && Number.isFinite(entry.amount) ? entry.amount : null;
    push({
      id: `food-${entry.id}`,
      kind: 'nutrition',
      dayKey: entry.logged_on,
      sortKey: `${entry.logged_on}${MEAL_TIME[entry.meal_type] ?? 'T12:00:00.000'}`,
      title: entry.food_name,
      detail: entry.serving_label || null,
      calories: Math.round(entry.calories),
      amountG: entry.amount_unit === 'g' && amount != null ? amount : null,
      amountMl: entry.amount_unit === 'ml' && amount != null ? amount : null,
      durationSec: null,
      mealType: entry.meal_type,
      imageUrl: entry.image_url?.trim() || null,
    });
  }

  for (const entry of input.hydrationEntries) {
    push({
      id: `hydration-${entry.id}`,
      kind: 'hydration',
      dayKey: entry.loggedOn,
      sortKey: entry.createdAt,
      title: 'hydration',
      detail: null,
      calories: null,
      amountG: null,
      amountMl: entry.amountMl,
      durationSec: null,
      mealType: null,
      imageUrl: null,
    });
  }

  for (const workout of input.workouts) {
    if (!isCompletedWorkout(workout)) continue;
    const dayKey = toDiaryDateKey(new Date(workout.started_at));
    const preview = workout.previews?.[0];
    const durationSec =
      workout.active_duration_sec != null && workout.active_duration_sec > 0
        ? Math.round(workout.active_duration_sec)
        : null;
    push({
      id: `workout-${workout.id}`,
      kind: 'workout',
      dayKey,
      sortKey: workout.started_at,
      title: workout.name,
      detail: null,
      calories:
        workout.estimated_calories > 0 ? Math.round(workout.estimated_calories) : null,
      amountG: null,
      amountMl: null,
      durationSec,
      mealType: null,
      imageUrl: preview?.image_url?.trim() || null,
    });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dayKey, items]) => ({
      dayKey,
      items: items.sort((left, right) => {
        if (left.sortKey === right.sortKey) return left.id.localeCompare(right.id);
        return left.sortKey < right.sortKey ? 1 : -1;
      }),
    }));
}

/** Days that include at least one item of `kind`, items filtered to that kind. */
export function activityDaysForKind(
  days: ActivityHistoryDay[],
  kind: ActivityHistoryKind,
): ActivityHistoryDay[] {
  return days
    .map((day) => ({
      dayKey: day.dayKey,
      items: day.items.filter((item) => item.kind === kind),
    }))
    .filter((day) => day.items.length > 0);
}

export type DayActivitySummary = {
  /** Prefer this for the day chip: ml / kcal|g / kcal|min. */
  primary: { type: 'ml' | 'g' | 'kcal' | 'min'; value: number } | null;
};

/** Aggregate a day's items into the preferred chip metric for that category. */
export function summarizeDayActivity(
  kind: ActivityHistoryKind,
  items: ActivityHistoryItem[],
): DayActivitySummary {
  if (kind === 'hydration') {
    const ml = items.reduce((sum, item) => sum + (item.amountMl ?? 0), 0);
    return ml > 0 ? { primary: { type: 'ml', value: ml } } : { primary: null };
  }

  if (kind === 'nutrition') {
    const kcal = items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
    if (kcal > 0) return { primary: { type: 'kcal', value: Math.round(kcal) } };
    const grams = items.reduce((sum, item) => sum + (item.amountG ?? 0), 0);
    if (grams > 0) return { primary: { type: 'g', value: grams } };
    return { primary: null };
  }

  const kcal = items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
  if (kcal > 0) return { primary: { type: 'kcal', value: Math.round(kcal) } };
  const seconds = items.reduce((sum, item) => sum + (item.durationSec ?? 0), 0);
  if (seconds > 0) {
    return { primary: { type: 'min', value: Math.max(1, Math.round(seconds / 60)) } };
  }
  return { primary: null };
}
