import { describe, expect, it } from 'vitest';

import { toDiaryDateKey } from '@/utils/date';

import { buildConsistencySnapshot } from './activity-days';
import {
  applyDailyActivityFlags,
  historyFromDailyActivityRows,
  keysNeedingPersist,
  mergeEarnedDayKeys,
  uniqueActivityDateKeys,
} from './daily-activity';
import { computeLoggingStreak, computeWorkoutStreak, buildWorkoutDayKinds } from './streaks';

function streaksFromHistory(input: {
  todayKey: string;
  persistedNutrition?: string[];
  persistedHydration?: string[];
  persistedWorkout?: string[];
  liveNutrition?: string[];
  liveHydration?: string[];
  liveWorkout?: string[];
  restKeys?: string[];
}) {
  const nutritionKeys = mergeEarnedDayKeys(
    input.persistedNutrition ?? [],
    input.liveNutrition ?? [],
  );
  const hydrationKeys = mergeEarnedDayKeys(
    input.persistedHydration ?? [],
    input.liveHydration ?? [],
  );
  const workoutKeys = mergeEarnedDayKeys(input.persistedWorkout ?? [], input.liveWorkout ?? []);
  const nutrition = computeLoggingStreak(nutritionKeys, input.todayKey);
  const hydration = computeLoggingStreak(hydrationKeys, input.todayKey);
  const workout = computeWorkoutStreak(
    buildWorkoutDayKinds({
      completedWorkoutDayKeys: workoutKeys,
      restOrRecoveryDayKeys: input.restKeys ?? [],
    }),
    input.todayKey,
  );
  const consistency = buildConsistencySnapshot({
    todayKey: input.todayKey,
    nutritionKeys,
    hydrationKeys,
    workoutCompletedKeys: workoutKeys,
    workoutCompletedCurrent: workout.currentCompletedDays,
    workoutLongestCompleted: workout.longestCompletedDays,
    workoutAlive: workout.alive,
    nutrition,
    hydration,
  });
  return { nutritionKeys, hydrationKeys, workoutKeys, nutrition, hydration, workout, consistency };
}

describe('earn once per local calendar day', () => {
  it('lets food logging earn one active day', () => {
    const earned = applyDailyActivityFlags(undefined, { nutrition: true });
    const keys = mergeEarnedDayKeys(['2026-11-15'], []);
    const streak = computeLoggingStreak(keys, '2026-11-15');
    expect(earned.nutrition).toBe(true);
    expect(streak.current).toBe(1);
    expect(streak.todayActive).toBe(true);
  });

  it('lets water logging earn one active day', () => {
    const keys = mergeEarnedDayKeys(['2026-11-15'], []);
    expect(computeLoggingStreak(keys, '2026-11-15').current).toBe(1);
  });

  it('lets a completed workout earn one active day', () => {
    const { workout, consistency } = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedWorkout: ['2026-11-15'],
    });
    expect(workout.currentCompletedDays).toBe(1);
    expect(consistency.overall.current).toBe(1);
  });

  it('counts food, water, and workout on the same day as one overall day', () => {
    const { consistency, nutritionKeys } = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-15', '2026-11-15'],
      persistedHydration: ['2026-11-15'],
      persistedWorkout: ['2026-11-15'],
    });
    expect(nutritionKeys).toEqual(['2026-11-15']);
    expect(consistency.overall.current).toBe(1);
    expect(consistency.overall.longest).toBe(1);
  });

  it('does not create a second day when the same category is logged again', () => {
    const first = applyDailyActivityFlags(undefined, { nutrition: true });
    const second = applyDailyActivityFlags(first, { nutrition: true });
    expect(second).toEqual(first);
    expect(uniqueActivityDateKeys(['2026-11-15', '2026-11-15'])).toEqual(['2026-11-15']);
  });
});

describe('deletion does not revoke earned days', () => {
  it('keeps the day when one remaining log is deleted', () => {
    const afterDelete = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-15'],
      persistedHydration: ['2026-11-15'],
      liveNutrition: [],
      liveHydration: ['2026-11-15'],
    });
    expect(afterDelete.consistency.overall.current).toBe(1);
    expect(afterDelete.nutrition.todayActive).toBe(true);
  });

  it('keeps the day after every log on that day is deleted', () => {
    const afterDelete = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-15'],
      persistedHydration: ['2026-11-15'],
      persistedWorkout: ['2026-11-15'],
      liveNutrition: [],
      liveHydration: [],
      liveWorkout: [],
    });
    expect(afterDelete.consistency.overall.current).toBe(1);
    expect(afterDelete.nutrition.current).toBe(1);
    expect(afterDelete.hydration.current).toBe(1);
    expect(afterDelete.workout.currentCompletedDays).toBe(1);
  });

  it('keeps historical longest after deleting old logs', () => {
    const afterDelete = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-01', '2026-11-02', '2026-11-03'],
      liveNutrition: [],
    });
    expect(afterDelete.nutrition.current).toBe(0);
    expect(afterDelete.nutrition.longest).toBe(3);
    expect(afterDelete.consistency.overall.longest).toBe(3);
  });

  it('does not treat deleting and re-logging the same day as a new streak day', () => {
    const persisted = applyDailyActivityFlags(
      applyDailyActivityFlags(undefined, { nutrition: true }),
      { nutrition: true },
    );
    const keys = mergeEarnedDayKeys(['2026-11-15'], ['2026-11-15']);
    expect(persisted.nutrition).toBe(true);
    expect(computeLoggingStreak(keys, '2026-11-15').current).toBe(1);
  });
});

describe('existing consecutive-day streak rules', () => {
  it('continues the streak on a new consecutive earned day', () => {
    const { consistency } = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-13', '2026-11-14', '2026-11-15'],
    });
    expect(consistency.overall.current).toBe(3);
    expect(consistency.overall.alive).toBe(true);
  });

  it('breaks current streak when a later day has no qualifying activity', () => {
    const { consistency } = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedNutrition: ['2026-11-12', '2026-11-13'],
    });
    expect(consistency.overall.current).toBe(0);
    expect(consistency.overall.alive).toBe(false);
    expect(consistency.overall.longest).toBe(2);
  });

  it('keeps yesterday grace when today is still empty', () => {
    const { consistency } = streaksFromHistory({
      todayKey: '2026-11-15',
      persistedHydration: ['2026-11-13', '2026-11-14'],
    });
    expect(consistency.overall.todayActive).toBe(false);
    expect(consistency.overall.alive).toBe(true);
    expect(consistency.overall.current).toBe(2);
  });
});

describe('concurrent and timezone boundaries', () => {
  it('dedupes concurrent earns of the same user and date', () => {
    const persisted = ['2026-11-15'];
    const incoming = ['2026-11-15', '2026-11-15'];
    expect(keysNeedingPersist(incoming, persisted)).toEqual([]);
    expect(mergeEarnedDayKeys(persisted, incoming)).toEqual(['2026-11-15']);
  });

  it('records the device local calendar day, not a UTC date slice', () => {
    const localEvening = new Date(2026, 10, 15, 23, 45, 0);
    expect(toDiaryDateKey(localEvening)).toBe('2026-11-15');
    const justAfterMidnight = new Date(2026, 10, 16, 0, 10, 0);
    expect(toDiaryDateKey(justAfterMidnight)).toBe('2026-11-16');
  });

  it('ignores invalid date keys so a bad payload cannot create extra days', () => {
    expect(uniqueActivityDateKeys(['2026-11-15', 'nope', ''])).toEqual(['2026-11-15']);
  });
});

describe('history mapping', () => {
  it('splits category flags without duplicating the calendar day', () => {
    const history = historyFromDailyActivityRows([
      {
        activityDate: '2026-11-15',
        nutrition: true,
        hydration: true,
        workout: false,
      },
      {
        activityDate: '2026-11-14',
        nutrition: false,
        hydration: false,
        workout: true,
      },
    ]);
    expect(history.nutritionKeys).toEqual(['2026-11-15']);
    expect(history.hydrationKeys).toEqual(['2026-11-15']);
    expect(history.workoutKeys).toEqual(['2026-11-14']);
  });
});

describe('account deletion vs log deletion', () => {
  it('keeps earned days when logs are gone, independent of remaining records', () => {
    const afterLogDelete = mergeEarnedDayKeys(['2026-11-15'], []);
    expect(afterLogDelete).toEqual(['2026-11-15']);
  });
});
