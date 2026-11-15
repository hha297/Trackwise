import { describe, expect, it } from 'vitest';

import {
  activityDaysForKind,
  buildActivityHistoryDays,
  summarizeDayActivity,
} from '@/features/progress/activity-history';
import type { FoodEntry } from '@/features/food/types';
import type { HydrationEntry } from '@/features/hydration/calculations';
import type { WorkoutListItem } from '@/features/workout/types';

function food(partial: Partial<FoodEntry> & { id: string; logged_on: string }): FoodEntry {
  return {
    meal_type: 'lunch',
    quantity: 1,
    food_name: 'Meal',
    brand: null,
    serving_label: '1 serving',
    calories: 400,
    protein_g: 20,
    carbs_g: 40,
    fat_g: 10,
    image_url: null,
    ...partial,
  };
}

function water(
  partial: Partial<HydrationEntry> & { id: string; loggedOn: string },
): HydrationEntry {
  return {
    amountMl: 250,
    createdAt: `${partial.loggedOn}T10:00:00.000Z`,
    ...partial,
  };
}

function workout(
  partial: Partial<WorkoutListItem> & { id: string; started_at: string },
): WorkoutListItem {
  return {
    name: 'Lift',
    ended_at: null,
    estimated_calories: 200,
    status: 'completed',
    ...partial,
  };
}

describe('buildActivityHistoryDays', () => {
  it('groups by day, newest first, and hides empty days', () => {
    const days = buildActivityHistoryDays({
      startKey: '2026-11-01',
      endKey: '2026-11-14',
      foodEntries: [
        food({ id: 'f1', logged_on: '2026-11-10', food_name: 'Oats' }),
        food({ id: 'f2', logged_on: '2026-11-12', food_name: 'Salad' }),
      ],
      hydrationEntries: [water({ id: 'h1', loggedOn: '2026-11-12', amountMl: 500 })],
      workouts: [
        workout({ id: 'w1', started_at: '2026-11-11T18:00:00.000Z', name: 'Run' }),
      ],
    });

    expect(days.map((day) => day.dayKey)).toEqual([
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
    ]);
    expect(days[0]!.items.map((item) => item.kind).sort()).toEqual([
      'hydration',
      'nutrition',
    ]);
  });

  it('filters to the selected period and skips incomplete workouts', () => {
    const days = buildActivityHistoryDays({
      startKey: '2026-11-08',
      endKey: '2026-11-14',
      foodEntries: [food({ id: 'f1', logged_on: '2026-11-01', food_name: 'Old' })],
      hydrationEntries: [],
      workouts: [
        workout({
          id: 'w1',
          started_at: '2026-11-10T09:00:00.000Z',
          status: 'in_progress',
        }),
        workout({ id: 'w2', started_at: '2026-11-10T10:00:00.000Z' }),
      ],
    });

    expect(days).toHaveLength(1);
    expect(days[0]!.dayKey).toBe('2026-11-10');
    expect(days[0]!.items).toHaveLength(1);
    expect(days[0]!.items[0]!.id).toBe('workout-w2');
  });

  it('does not treat multiple entries on one day as multiple days', () => {
    const days = buildActivityHistoryDays({
      startKey: '2026-11-01',
      endKey: '2026-11-30',
      foodEntries: [
        food({ id: 'a', logged_on: '2026-11-05', food_name: 'A' }),
        food({ id: 'b', logged_on: '2026-11-05', food_name: 'B' }),
      ],
      hydrationEntries: [water({ id: 'h', loggedOn: '2026-11-05' })],
      workouts: [],
    });

    expect(days).toHaveLength(1);
    expect(days[0]!.items).toHaveLength(3);
  });

  it('keeps gram amounts for nutrition and filters by category', () => {
    const days = buildActivityHistoryDays({
      startKey: '2026-11-01',
      endKey: '2026-11-30',
      foodEntries: [
        food({
          id: 'a',
          logged_on: '2026-11-05',
          food_name: 'Rice',
          amount: 150,
          amount_unit: 'g',
        }),
      ],
      hydrationEntries: [water({ id: 'h', loggedOn: '2026-11-05', amountMl: 300 })],
      workouts: [],
    });

    expect(days[0]!.items.find((item) => item.kind === 'nutrition')?.amountG).toBe(150);
    const nutritionOnly = activityDaysForKind(days, 'nutrition');
    expect(nutritionOnly).toHaveLength(1);
    expect(nutritionOnly[0]!.items.every((item) => item.kind === 'nutrition')).toBe(true);
  });

  it('summarizes day chips as ml / kcal|g / kcal|min', () => {
    expect(
      summarizeDayActivity('hydration', [
        {
          id: '1',
          kind: 'hydration',
          dayKey: '2026-11-05',
          sortKey: 'a',
          title: 'hydration',
          detail: null,
          calories: null,
          amountG: null,
          amountMl: 250,
          durationSec: null,
          mealType: null,
          imageUrl: null,
        },
        {
          id: '2',
          kind: 'hydration',
          dayKey: '2026-11-05',
          sortKey: 'b',
          title: 'hydration',
          detail: null,
          calories: null,
          amountG: null,
          amountMl: 500,
          durationSec: null,
          mealType: null,
          imageUrl: null,
        },
      ]).primary,
    ).toEqual({ type: 'ml', value: 750 });

    expect(
      summarizeDayActivity('nutrition', [
        {
          id: '1',
          kind: 'nutrition',
          dayKey: '2026-11-05',
          sortKey: 'a',
          title: 'Rice',
          detail: null,
          calories: 400,
          amountG: 150,
          amountMl: null,
          durationSec: null,
          mealType: 'lunch',
          imageUrl: null,
        },
      ]).primary,
    ).toEqual({ type: 'kcal', value: 400 });

    expect(
      summarizeDayActivity('workout', [
        {
          id: '1',
          kind: 'workout',
          dayKey: '2026-11-05',
          sortKey: 'a',
          title: 'Lift',
          detail: null,
          calories: null,
          amountG: null,
          amountMl: null,
          durationSec: 1800,
          mealType: null,
          imageUrl: null,
        },
      ]).primary,
    ).toEqual({ type: 'min', value: 30 });
  });
});
