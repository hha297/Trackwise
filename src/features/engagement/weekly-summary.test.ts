import { describe, expect, it } from 'vitest';

import { buildWeeklySummary } from './weekly-summary';

describe('buildWeeklySummary', () => {
  it('uses Monday–Sunday week containing the anchor', () => {
    // 2026-11-13 is Friday → week Mon 09 – Sun 15
    const summary = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: ['2026-11-09', '2026-11-13'],
      hydrationLoggedDayKeys: ['2026-11-10'],
      workoutCompletedDayKeys: ['2026-11-11'],
      completedWorkoutSessions: 2,
      foodEntriesInWeek: [
        {
          logged_on: '2026-11-09',
          calories: 2000,
          protein_g: 100,
          carbs_g: 200,
          fat_g: 60,
        },
        {
          logged_on: '2026-11-13',
          calories: 1800,
          protein_g: 90,
          carbs_g: 180,
          fat_g: 50,
        },
      ],
      hydrationAmountByDay: new Map([
        ['2026-11-10', 1500],
        ['2026-11-13', 500],
      ]),
      hydrationTargetMl: 2000,
    });

    expect(summary.weekStartKey).toBe('2026-11-09');
    expect(summary.weekEndKey).toBe('2026-11-15');
    expect(summary.nutritionLoggingDays).toBe(2);
    expect(summary.hydrationLoggingDays).toBe(1);
    expect(summary.workoutDays).toBe(1);
    expect(summary.completedWorkoutSessions).toBe(2);
    expect(summary.avgCalories).toBe(1900);
    expect(summary.avgProteinG).toBe(95);
    expect(summary.totalHydrationMl).toBe(2000);
    expect(summary.hydrationTargetProgress).not.toBeNull();
  });

  it('handles empty users without inventing goals', () => {
    const summary = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: [],
      hydrationLoggedDayKeys: [],
      workoutCompletedDayKeys: [],
      completedWorkoutSessions: 0,
      foodEntriesInWeek: [],
      hydrationAmountByDay: new Map(),
      hydrationTargetMl: null,
    });
    expect(summary.nutritionLoggingDays).toBe(0);
    expect(summary.avgCalories).toBeNull();
    expect(summary.hydrationTargetProgress).toBeNull();
  });

  it('supports nutrition-only, workout-only, and hydration-only weeks', () => {
    const nutritionOnly = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: ['2026-11-13'],
      hydrationLoggedDayKeys: [],
      workoutCompletedDayKeys: [],
      completedWorkoutSessions: 0,
      foodEntriesInWeek: [
        {
          logged_on: '2026-11-13',
          calories: 1500,
          protein_g: 80,
          carbs_g: 150,
          fat_g: 40,
        },
      ],
      hydrationAmountByDay: new Map(),
      hydrationTargetMl: 2000,
    });
    expect(nutritionOnly.nutritionLoggingDays).toBe(1);
    expect(nutritionOnly.workoutDays).toBe(0);
    expect(nutritionOnly.hydrationTargetProgress).toBeNull();

    const workoutOnly = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: [],
      hydrationLoggedDayKeys: [],
      workoutCompletedDayKeys: ['2026-11-12', '2026-11-13'],
      completedWorkoutSessions: 3,
      foodEntriesInWeek: [],
      hydrationAmountByDay: new Map(),
      hydrationTargetMl: null,
    });
    expect(workoutOnly.workoutDays).toBe(2);
    expect(workoutOnly.completedWorkoutSessions).toBe(3);
    expect(workoutOnly.avgCalories).toBeNull();

    const hydrationOnly = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: [],
      hydrationLoggedDayKeys: ['2026-11-13'],
      workoutCompletedDayKeys: [],
      completedWorkoutSessions: 0,
      foodEntriesInWeek: [],
      hydrationAmountByDay: new Map([['2026-11-13', 2000]]),
      hydrationTargetMl: 2000,
    });
    expect(hydrationOnly.hydrationLoggingDays).toBe(1);
    expect(hydrationOnly.totalHydrationMl).toBe(2000);
    expect(hydrationOnly.hydrationTargetProgress).toBeGreaterThan(0);
  });

  it('ignores activity outside the week window', () => {
    const summary = buildWeeklySummary({
      anchorKey: '2026-11-13',
      foodLoggedDayKeys: ['2026-11-08', '2026-11-16'],
      hydrationLoggedDayKeys: ['2026-11-01'],
      workoutCompletedDayKeys: ['2026-11-20'],
      completedWorkoutSessions: 5,
      foodEntriesInWeek: [],
      hydrationAmountByDay: new Map(),
      hydrationTargetMl: null,
    });
    expect(summary.nutritionLoggingDays).toBe(0);
    expect(summary.hydrationLoggingDays).toBe(0);
    expect(summary.workoutDays).toBe(0);
  });
});
