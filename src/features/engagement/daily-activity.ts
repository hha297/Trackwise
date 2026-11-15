import type { CategoryDayFlags } from '@/features/engagement/activity-days';

export const DAILY_ACTIVITY_QUERY_KEY = 'user-daily-activity';

export type DailyActivityKind = 'nutrition' | 'hydration' | 'workout';

export type DailyActivityRow = CategoryDayFlags & {
  activityDate: string;
};

export type DailyActivityHistory = {
  rows: DailyActivityRow[];
  nutritionKeys: string[];
  hydrationKeys: string[];
  workoutKeys: string[];
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDiaryActivityDateKey(value: string): boolean {
  return DATE_KEY.test(value);
}

export function uniqueActivityDateKeys(keys: Iterable<string>): string[] {
  return [...new Set([...keys].filter((key) => isDiaryActivityDateKey(key)))].sort();
}

/** Union persisted earned days with logs still present. Never drops a persisted day. */
export function mergeEarnedDayKeys(
  persistedKeys: Iterable<string>,
  liveKeys: Iterable<string>,
): string[] {
  return uniqueActivityDateKeys([...persistedKeys, ...liveKeys]);
}

export function applyDailyActivityFlags(
  existing: CategoryDayFlags | undefined,
  earned: Partial<CategoryDayFlags>,
): CategoryDayFlags {
  return {
    nutrition: Boolean(existing?.nutrition || earned.nutrition),
    hydration: Boolean(existing?.hydration || earned.hydration),
    workout: Boolean(existing?.workout || earned.workout),
  };
}

export function keysNeedingPersist(
  liveKeys: Iterable<string>,
  persistedKeys: Iterable<string>,
): string[] {
  const persisted = new Set(uniqueActivityDateKeys(persistedKeys));
  return uniqueActivityDateKeys(liveKeys).filter((key) => !persisted.has(key));
}

export function historyFromDailyActivityRows(rows: DailyActivityRow[]): DailyActivityHistory {
  const nutritionKeys: string[] = [];
  const hydrationKeys: string[] = [];
  const workoutKeys: string[] = [];
  for (const row of rows) {
    if (!isDiaryActivityDateKey(row.activityDate)) continue;
    if (row.nutrition) nutritionKeys.push(row.activityDate);
    if (row.hydration) hydrationKeys.push(row.activityDate);
    if (row.workout) workoutKeys.push(row.activityDate);
  }
  return {
    rows,
    nutritionKeys: uniqueActivityDateKeys(nutritionKeys),
    hydrationKeys: uniqueActivityDateKeys(hydrationKeys),
    workoutKeys: uniqueActivityDateKeys(workoutKeys),
  };
}

export function dailyActivityQueryKey(
  userId: string | undefined,
  startKey?: string,
  endKey?: string,
) {
  return [DAILY_ACTIVITY_QUERY_KEY, userId, startKey, endKey] as const;
}
