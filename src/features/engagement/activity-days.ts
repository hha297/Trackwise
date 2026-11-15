import { diaryDayKeysInclusive, previousDiaryDateKey, shiftDiaryDateKey } from '@/features/engagement/dates';
import { computeLoggingStreak, type LoggingStreakResult } from '@/features/engagement/streaks';
import { parseDiaryDateKey, toDiaryDateKey } from '@/utils/date';

export type CategoryDayFlags = {
  nutrition: boolean;
  hydration: boolean;
  workout: boolean;
};

export type DayActivity = CategoryDayFlags & {
  dayKey: string;
  /** Categories active that day (0–3). Workout counts only completed sessions. */
  intensity: 0 | 1 | 2 | 3;
  /** Any of the three categories logged. */
  anyActive: boolean;
  isFuture: boolean;
  isToday: boolean;
};

export type ConsistencySnapshot = {
  /** Union of any-category active days, using existing logging-streak rules. */
  overall: LoggingStreakResult;
  nutrition: LoggingStreakResult;
  hydration: LoggingStreakResult;
  workoutCompletedDays: number;
  workoutLongestCompletedDays: number;
  workoutAlive: boolean;
  activeThisMonth: number;
  monthKey: string;
};

export const MILESTONE_DAYS = [7, 14, 30, 60, 100] as const;

export type MilestoneStatus = {
  days: (typeof MILESTONE_DAYS)[number];
  unlocked: boolean;
};

/** Deduped union of active calendar days across categories. */
export function unionActiveDayKeys(
  nutritionKeys: Iterable<string>,
  hydrationKeys: Iterable<string>,
  workoutCompletedKeys: Iterable<string>,
): string[] {
  return [...new Set([...nutritionKeys, ...hydrationKeys, ...workoutCompletedKeys])]
    .filter(Boolean)
    .sort();
}

export function buildCategoryFlagsByDay(input: {
  nutritionKeys: Iterable<string>;
  hydrationKeys: Iterable<string>;
  workoutCompletedKeys: Iterable<string>;
}): Map<string, CategoryDayFlags> {
  const nutrition = new Set([...input.nutritionKeys].filter(Boolean));
  const hydration = new Set([...input.hydrationKeys].filter(Boolean));
  const workout = new Set([...input.workoutCompletedKeys].filter(Boolean));
  const all = new Set([...nutrition, ...hydration, ...workout]);
  const map = new Map<string, CategoryDayFlags>();
  for (const dayKey of all) {
    map.set(dayKey, {
      nutrition: nutrition.has(dayKey),
      hydration: hydration.has(dayKey),
      workout: workout.has(dayKey),
    });
  }
  return map;
}

export function dayIntensity(flags: CategoryDayFlags | undefined): 0 | 1 | 2 | 3 {
  if (!flags) return 0;
  const count =
    (flags.nutrition ? 1 : 0) + (flags.hydration ? 1 : 0) + (flags.workout ? 1 : 0);
  return count as 0 | 1 | 2 | 3;
}

export function buildDayActivity(input: {
  dayKey: string;
  flags: CategoryDayFlags | undefined;
  todayKey: string;
}): DayActivity {
  const intensity = dayIntensity(input.flags);
  return {
    dayKey: input.dayKey,
    nutrition: Boolean(input.flags?.nutrition),
    hydration: Boolean(input.flags?.hydration),
    workout: Boolean(input.flags?.workout),
    intensity,
    anyActive: intensity > 0,
    isFuture: input.dayKey > input.todayKey,
    isToday: input.dayKey === input.todayKey,
  };
}

/** Local calendar month of todayKey → count of any-active days. */
export function countActiveDaysInMonth(
  activeKeys: Iterable<string>,
  todayKey: string,
): { count: number; monthKey: string } {
  const monthKey = todayKey.slice(0, 7);
  let count = 0;
  for (const key of new Set([...activeKeys].filter(Boolean))) {
    if (key.startsWith(monthKey) && key <= todayKey) count += 1;
  }
  return { count, monthKey };
}

export function buildConsistencySnapshot(input: {
  todayKey: string;
  nutritionKeys: Iterable<string>;
  hydrationKeys: Iterable<string>;
  workoutCompletedKeys: Iterable<string>;
  workoutCompletedCurrent: number;
  workoutLongestCompleted: number;
  workoutAlive: boolean;
  nutrition: LoggingStreakResult;
  hydration: LoggingStreakResult;
}): ConsistencySnapshot {
  const union = unionActiveDayKeys(
    input.nutritionKeys,
    input.hydrationKeys,
    input.workoutCompletedKeys,
  );
  const overall = computeLoggingStreak(union, input.todayKey);
  const month = countActiveDaysInMonth(union, input.todayKey);
  return {
    overall,
    nutrition: input.nutrition,
    hydration: input.hydration,
    workoutCompletedDays: input.workoutCompletedCurrent,
    workoutLongestCompletedDays: input.workoutLongestCompleted,
    workoutAlive: input.workoutAlive,
    activeThisMonth: month.count,
    monthKey: month.monthKey,
  };
}

/** Last N weeks ending on the week that contains today (Mon–Sun via shift from today). */
export function heatmapRangeKeys(todayKey: string, weeks = 12): string[] {
  const days = weeks * 7;
  // Align end to today; start = today - (days-1)
  const startKey = shiftDiaryDateKey(todayKey, -(days - 1));
  return diaryDayKeysInclusive(startKey, todayKey);
}

/**
 * Heatmap columns: each column is a Mon–Sun week (Monday start),
 * clipped to the inclusive [start, today] window (future days after today omitted).
 */
export function buildHeatmapWeeks(
  dayKeys: string[],
  flagsByDay: Map<string, CategoryDayFlags>,
  todayKey: string,
): DayActivity[][] {
  if (dayKeys.length === 0) return [];
  const startKey = dayKeys[0]!;
  // Expand back to Monday of the first week for column alignment.
  const startDate = parseDiaryDateKey(startKey);
  const weekday = startDate.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = toDiaryDateKey(
    new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + mondayOffset),
  );

  const weeks: DayActivity[][] = [];
  let cursor = gridStart;
  let week: DayActivity[] = [];
  while (cursor <= todayKey) {
    const inWindow = cursor >= startKey && cursor <= todayKey;
    week.push(
      inWindow
        ? buildDayActivity({
            dayKey: cursor,
            flags: flagsByDay.get(cursor),
            todayKey,
          })
        : {
            dayKey: cursor,
            nutrition: false,
            hydration: false,
            workout: false,
            intensity: 0,
            anyActive: false,
            isFuture: cursor > todayKey,
            isToday: false,
          },
    );
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor = shiftDiaryDateKey(cursor, 1);
  }
  if (week.length > 0) {
    while (week.length < 7) {
      const padKey = shiftDiaryDateKey(week[week.length - 1]!.dayKey, 1);
      week.push({
        dayKey: padKey,
        nutrition: false,
        hydration: false,
        workout: false,
        intensity: 0,
        anyActive: false,
        isFuture: true,
        isToday: false,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Last 7 local days ending today — active-day flags for weekly bars. */
export function buildWeeklyActiveBars(
  flagsByDay: Map<string, CategoryDayFlags>,
  todayKey: string,
): DayActivity[] {
  const start = shiftDiaryDateKey(todayKey, -6);
  return diaryDayKeysInclusive(start, todayKey).map((dayKey) =>
    buildDayActivity({ dayKey, flags: flagsByDay.get(dayKey), todayKey }),
  );
}

export function countCategoryActiveDays(
  keys: Iterable<string>,
  startKey: string,
  endKey: string,
): number {
  let count = 0;
  for (const key of new Set([...keys].filter(Boolean))) {
    if (key >= startKey && key <= endKey) count += 1;
  }
  return count;
}

/** Unique active calendar days in an inclusive local date range (union or category). */
export function countActiveDaysInRange(
  keys: Iterable<string>,
  startKey: string,
  endKey: string,
): number {
  return countCategoryActiveDays(keys, startKey, endKey);
}

/**
 * Heatmap week columns for a Progress period (7 / 30 / 90).
 * Current and best streak stay period-independent elsewhere.
 */
export function consistencyWeeksForPeriod(periodDays: number): number {
  return Math.max(1, Math.ceil(periodDays / 7));
}

export function buildMilestones(bestDays: number): {
  items: MilestoneStatus[];
  next: MilestoneStatus | null;
} {
  const items = MILESTONE_DAYS.map((days) => ({
    days,
    unlocked: bestDays >= days,
  }));
  const next = items.find((item) => !item.unlocked) ?? null;
  return { items, next };
}

/** Re-export for tests / callers that need previous-day walks. */
export { previousDiaryDateKey };
