import { describe, expect, it } from 'vitest';

import { deriveJourneyMilestones, streakEndForLength } from './milestones';

const TODAY = '2026-11-16';

describe('deriveJourneyMilestones', () => {
  it('awards first workout at the earliest completed session', () => {
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: ['2026-10-01', '2026-10-02'],
      nutritionKeys: [],
      unionKeys: ['2026-10-01', '2026-10-02'],
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows.find((row) => row.id === 'first_workout')?.achievedOn).toBe('2026-10-01');
  });

  it('does not award 10 workouts at 9 sessions', () => {
    const keys = Array.from({ length: 9 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: keys,
      nutritionKeys: [],
      unionKeys: keys,
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows.some((row) => row.id === 'workouts_10')).toBe(false);
  });

  it('awards 10 workouts exactly at the 10th session date', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: keys,
      nutritionKeys: [],
      unionKeys: keys,
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows.find((row) => row.id === 'workouts_10')?.achievedOn).toBe('2026-10-10');
  });

  it('keeps counting above the threshold without duplicating the milestone', () => {
    const keys = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const first = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: keys,
      nutritionKeys: [],
      unionKeys: keys,
      calorieTarget: null,
      nutritionDays: [],
    });
    const second = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: keys,
      nutritionKeys: [],
      unionKeys: keys,
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(first.filter((row) => row.id === 'workouts_10')).toHaveLength(1);
    expect(second.filter((row) => row.id === 'workouts_10')).toHaveLength(1);
    expect(first).toEqual(second);
  });

  it('awards 25 and 50 from the same history when both apply', () => {
    const keys = Array.from({ length: 50 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 1 + i));
      return date.toISOString().slice(0, 10);
    });
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: keys,
      nutritionKeys: [],
      unionKeys: keys,
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows.some((row) => row.id === 'workouts_25')).toBe(true);
    expect(rows.some((row) => row.id === 'workouts_50')).toBe(true);
  });

  it('awards food-day milestones from unique diary days', () => {
    const nutrition = ['2026-11-01', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: [],
      nutritionKeys: nutrition,
      unionKeys: nutrition,
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows.find((row) => row.id === 'first_food_day')?.achievedOn).toBe('2026-11-01');
    expect(rows.find((row) => row.id === 'food_days_7')?.achievedOn).toBe('2026-11-07');
    expect(rows.some((row) => row.id === 'food_days_30')).toBe(false);
  });

  it('awards nutrition-on-track only for completed days within tolerance', () => {
    const days = [
      { dateKey: '2026-11-01', calories: 2000, hasFood: true },
      { dateKey: '2026-11-02', calories: 1980, hasFood: true },
      { dateKey: '2026-11-03', calories: 2050, hasFood: true },
      { dateKey: '2026-11-04', calories: 1990, hasFood: true },
      { dateKey: '2026-11-05', calories: 2010, hasFood: true },
      { dateKey: '2026-11-06', calories: 1960, hasFood: true },
      { dateKey: '2026-11-07', calories: 2020, hasFood: true },
      { dateKey: TODAY, calories: 2000, hasFood: true },
    ];
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: [],
      nutritionKeys: days.map((day) => day.dateKey),
      unionKeys: days.map((day) => day.dateKey),
      calorieTarget: 2000,
      nutritionDays: days,
    });
    expect(rows.find((row) => row.id === 'nutrition_on_track_7')?.achievedOn).toBe('2026-11-07');
  });

  it('does not award on-track from incomplete or far-off days', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      dateKey: `2026-11-0${i + 1}`,
      calories: 900,
      hasFood: true,
    }));
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: [],
      nutritionKeys: days.map((day) => day.dateKey),
      unionKeys: days.map((day) => day.dateKey),
      calorieTarget: 2000,
      nutritionDays: days,
    });
    expect(rows.some((row) => row.id === 'nutrition_on_track_7')).toBe(false);
  });

  it('orders the timeline by achievement date then id', () => {
    const rows = deriveJourneyMilestones({
      todayKey: TODAY,
      completedWorkoutKeys: ['2026-11-10'],
      nutritionKeys: ['2026-11-01'],
      unionKeys: ['2026-11-01', '2026-11-10'],
      calorieTarget: null,
      nutritionDays: [],
    });
    expect(rows[0]?.id).toBe('first_food_day');
    expect(rows.map((row) => row.achievedOn)).toEqual([...rows].sort((a, b) => a.achievedOn.localeCompare(b.achievedOn)).map((row) => row.achievedOn));
  });

  it('returns an empty list when there is no history', () => {
    expect(
      deriveJourneyMilestones({
        todayKey: TODAY,
        completedWorkoutKeys: [],
        nutritionKeys: [],
        unionKeys: [],
        calorieTarget: 2000,
        nutritionDays: [],
      }),
    ).toEqual([]);
  });
});

describe('streakEndForLength', () => {
  it('finds the first day a 7-day run completed', () => {
    const keys = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-10'];
    expect(streakEndForLength(keys, 7)).toBe('2026-11-07');
  });

  it('returns null below the length', () => {
    expect(streakEndForLength(['2026-11-01', '2026-11-02'], 7)).toBeNull();
  });
});
