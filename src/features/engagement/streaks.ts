import { previousDiaryDateKey, shiftDiaryDateKey } from '@/features/engagement/dates';

/**
 * Streak rules (Phase 2 Group 1 — approved):
 *
 * Nutrition / hydration (logging consistency):
 * - A day is active with ≥1 valid entry on that local calendar day.
 * - Multiple entries still count as one active day.
 * - Goals/targets are NOT required.
 * - Current streak: if today active, include today; else if yesterday active, end yesterday;
 *   else 0. Walk consecutive active days only.
 *
 * Workout consistency:
 * - Active day: ≥1 workout with status `completed` (local date of `started_at`).
 * - Neutral day: planned `rest` or `recovery` with no completed workout.
 * - Inactive day: neither (unplanned miss) — breaks the streak.
 * - Completed workout on a rest/recovery plan day → active (not neutral).
 * - Current streak counts completed workout days only; neutrals do not increment.
 * - Current streak may span neutrals; unplanned inactive breaks it.
 * - Grace: if today is inactive, evaluation starts from yesterday.
 *   If today is active or neutral, evaluation starts from today.
 */

export type LoggingStreakResult = {
  current: number;
  longest: number;
  todayActive: boolean;
  alive: boolean;
  currentStartKey: string | null;
  currentEndKey: string | null;
};

export type WorkoutDayKind = 'active' | 'neutral' | 'inactive';

export type WorkoutStreakResult = {
  /** Completed workout days in the current consistency span. */
  currentCompletedDays: number;
  longestCompletedDays: number;
  todayKind: WorkoutDayKind;
  alive: boolean;
  currentStartKey: string | null;
  currentEndKey: string | null;
};

export function uniqueSortedDayKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)].filter(Boolean).sort();
}

export function activeDaySet(keys: Iterable<string>): Set<string> {
  return new Set(uniqueSortedDayKeys(keys));
}

export function computeLoggingStreak(
  activeKeys: Iterable<string>,
  todayKey: string,
): LoggingStreakResult {
  const active = activeDaySet(activeKeys);
  const todayActive = active.has(todayKey);
  const yesterdayKey = previousDiaryDateKey(todayKey);
  const yesterdayActive = active.has(yesterdayKey);

  let alive = false;
  let currentEndKey: string | null = null;
  if (todayActive) {
    alive = true;
    currentEndKey = todayKey;
  } else if (yesterdayActive) {
    alive = true;
    currentEndKey = yesterdayKey;
  }

  let current = 0;
  let currentStartKey: string | null = null;
  if (alive && currentEndKey) {
    let cursor = currentEndKey;
    while (active.has(cursor)) {
      current += 1;
      currentStartKey = cursor;
      cursor = previousDiaryDateKey(cursor);
    }
  }

  const longest = longestLoggingRun(active);

  return {
    current,
    longest: Math.max(longest, current),
    todayActive,
    alive,
    currentStartKey,
    currentEndKey,
  };
}

function longestLoggingRun(active: Set<string>): number {
  const sorted = [...active].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (previousDiaryDateKey(cur) === prev) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

export function classifyWorkoutDay(input: {
  hasCompletedWorkout: boolean;
  hasPlannedRestOrRecovery: boolean;
}): WorkoutDayKind {
  if (input.hasCompletedWorkout) return 'active';
  if (input.hasPlannedRestOrRecovery) return 'neutral';
  return 'inactive';
}

export function buildWorkoutDayKinds(input: {
  completedWorkoutDayKeys: Iterable<string>;
  restOrRecoveryDayKeys: Iterable<string>;
}): Map<string, WorkoutDayKind> {
  const completed = activeDaySet(input.completedWorkoutDayKeys);
  const rest = activeDaySet(input.restOrRecoveryDayKeys);
  const all = new Set([...completed, ...rest]);
  const map = new Map<string, WorkoutDayKind>();
  for (const key of all) {
    map.set(
      key,
      classifyWorkoutDay({
        hasCompletedWorkout: completed.has(key),
        hasPlannedRestOrRecovery: rest.has(key),
      }),
    );
  }
  return map;
}

function workoutKindOn(map: Map<string, WorkoutDayKind>, dayKey: string): WorkoutDayKind {
  return map.get(dayKey) ?? 'inactive';
}

function walkWorkoutSpan(
  kinds: Map<string, WorkoutDayKind>,
  endKey: string,
): { completed: number; startKey: string; lastActiveKey: string | null } {
  let cursor = endKey;
  let completed = 0;
  let startKey = endKey;
  let lastActiveKey: string | null = null;
  while (true) {
    const kind = workoutKindOn(kinds, cursor);
    if (kind === 'inactive') break;
    if (kind === 'active') {
      completed += 1;
      if (!lastActiveKey) lastActiveKey = cursor;
    }
    startKey = cursor;
    cursor = previousDiaryDateKey(cursor);
  }
  return { completed, startKey, lastActiveKey };
}

export function computeWorkoutStreak(
  kinds: Map<string, WorkoutDayKind>,
  todayKey: string,
): WorkoutStreakResult {
  const todayKind = workoutKindOn(kinds, todayKey);
  const yesterdayKey = previousDiaryDateKey(todayKey);
  const yesterdayKind = workoutKindOn(kinds, yesterdayKey);

  let evaluationEnd: string | null = null;
  if (todayKind === 'active' || todayKind === 'neutral') {
    evaluationEnd = todayKey;
  } else if (yesterdayKind === 'active' || yesterdayKind === 'neutral') {
    evaluationEnd = yesterdayKey;
  }

  let currentCompletedDays = 0;
  let currentStartKey: string | null = null;
  let currentEndKey: string | null = null;
  let alive = false;

  if (evaluationEnd) {
    const span = walkWorkoutSpan(kinds, evaluationEnd);
    if (span.completed > 0) {
      alive = true;
      currentCompletedDays = span.completed;
      currentStartKey = span.startKey;
      currentEndKey = span.lastActiveKey;
    }
  }

  return {
    currentCompletedDays,
    longestCompletedDays: Math.max(longestWorkoutRun(kinds), currentCompletedDays),
    todayKind,
    alive,
    currentStartKey,
    currentEndKey,
  };
}

/** Day-by-day scan from earliest known key through latest, treating gaps as inactive. */
function longestWorkoutRun(kinds: Map<string, WorkoutDayKind>): number {
  const keys = [...kinds.keys()].sort();
  if (keys.length === 0) return 0;
  const min = keys[0]!;
  const max = keys[keys.length - 1]!;
  let best = 0;
  let run = 0;
  let cursor = min;
  while (cursor <= max) {
    const kind = workoutKindOn(kinds, cursor);
    if (kind === 'inactive') {
      best = Math.max(best, run);
      run = 0;
    } else if (kind === 'active') {
      run += 1;
      best = Math.max(best, run);
    }
    cursor = shiftDiaryDateKey(cursor, 1);
  }
  return best;
}
