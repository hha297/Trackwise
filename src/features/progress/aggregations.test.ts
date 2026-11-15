import { describe, expect, it } from 'vitest';

import {
  buildNutritionTrends,
  buildProgressOverview,
  buildBodyMetricSeries,
  resolveBodyMetricValue,
} from '@/features/progress/aggregations';
import type { BodyMeasurement } from '@/features/measurements/hooks';
import { NAVY_COMPOSITION_METHOD } from '@/features/measurements/navy-body-fat';
import { progressRange, trendSourceBuckets } from '@/features/progress/period';
import type { FoodEntry } from '@/features/food/types';
import type { WorkoutListItem } from '@/features/workout/types';

function food(partial: Partial<FoodEntry> & { logged_on: string }): FoodEntry {
  return {
    id: partial.id ?? `f-${partial.logged_on}`,
    logged_on: partial.logged_on,
    meal_type: partial.meal_type ?? 'lunch',
    quantity: 1,
    food_name: 'Test',
    brand: null,
    serving_label: partial.serving_label ?? '',
    calories: partial.calories ?? 500,
    protein_g: partial.protein_g ?? 30,
    carbs_g: partial.carbs_g ?? 40,
    fat_g: partial.fat_g ?? 15,
    image_url: partial.image_url ?? null,
  };
}

function workout(partial: Partial<WorkoutListItem> & { started_at: string }): WorkoutListItem {
  return {
    id: partial.id ?? `w-${partial.started_at}`,
    name: 'Lift',
    started_at: partial.started_at,
    ended_at: partial.ended_at ?? partial.started_at.replace('T10:', 'T11:'),
    estimated_calories: partial.estimated_calories ?? 200,
  };
}

describe('buildProgressOverview', () => {
  it('averages only days with food and does not fabricate adherence', () => {
    const overview = buildProgressOverview({
      dayKeys: ['2026-11-01', '2026-11-02', '2026-11-03'],
      todayKey: '2026-11-03',
      entries: [
        food({ logged_on: '2026-11-01', calories: 2000, protein_g: 120 }),
        food({ logged_on: '2026-11-02', calories: 1800, protein_g: 100 }),
      ],
      workouts: [workout({ started_at: '2026-11-01T10:00:00' })],
      measurements: [],
      goal: {
        id: 'g1',
        goal_type: 'maintain_weight',
        target_weight_kg: null,
        daily_calorie_target: 2000,
        weekly_change_kg: null,
        protein_g: 110,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        diet_preset: null,
        carbs_pct: null,
        protein_pct: null,
        fat_pct: null,
        is_active: true,
      },
    });

    expect(overview.avgCalories).toBe(1900);
    expect(overview.avgProtein).toBe(110);
    expect(overview.workoutSessions).toBe(1);
    expect(overview.estWorkoutKcal).toBe(200);
    // Only 2 completed food days → adherence stays unavailable.
    expect(overview.goalAdherencePct).toBeNull();
  });

  it('reports weight change from first to last measurement in range', () => {
    const measurements: BodyMeasurement[] = [
      {
        id: '1',
        measured_on: '2026-11-01',
        weight_kg: 80,
        body_fat_percent: 20,
        waist_cm: null,
        neck_cm: null,
        hip_cm: null,
        bicep_cm: null,
        thigh_cm: null,
        fat_mass_kg: null,
        lean_mass_kg: null,
        ffmi: null,
        composition_method: 'manual',
        notes: null,
      },
      {
        id: '2',
        measured_on: '2026-11-10',
        weight_kg: 78.5,
        body_fat_percent: 19,
        waist_cm: null,
        neck_cm: null,
        hip_cm: null,
        bicep_cm: null,
        thigh_cm: null,
        fat_mass_kg: null,
        lean_mass_kg: null,
        ffmi: null,
        composition_method: 'manual',
        notes: null,
      },
    ];

    const overview = buildProgressOverview({
      dayKeys: ['2026-11-01', '2026-11-10'],
      todayKey: '2026-11-10',
      entries: [],
      workouts: [],
      measurements,
      goal: null,
    });

    expect(overview.weightChangeKg).toBe(-1.5);
    expect(overview.bodyFatChangePct).toBe(-1);
  });
});

describe('progressRange periods', () => {
  it('builds inclusive 7 / 30 / 90 day windows ending today', () => {
    expect(progressRange(7, '2026-11-14').dayKeys).toHaveLength(7);
    expect(progressRange(7, '2026-11-14').startKey).toBe('2026-11-08');
    expect(progressRange(30, '2026-11-14').dayKeys).toHaveLength(30);
    expect(progressRange(90, '2026-11-14').dayKeys).toHaveLength(90);
  });
});

describe('chart bucketing', () => {
  it('uses one daily column for 7 / 30 / 90 (habit-calendar density)', () => {
    const d7 = progressRange(7, '2026-11-14');
    const d30 = progressRange(30, '2026-11-14');
    const d90 = progressRange(90, '2026-11-14');
    expect(trendSourceBuckets(7, d7.dayKeys)).toHaveLength(7);
    expect(trendSourceBuckets(30, d30.dayKeys)).toHaveLength(30);
    expect(trendSourceBuckets(90, d90.dayKeys)).toHaveLength(90);

    const series = buildNutritionTrends({
      period: 90,
      dayKeys: d90.dayKeys,
      todayKey: d90.todayKey,
      entries: [
        food({ logged_on: '2026-10-01', calories: 2000 }),
        food({ logged_on: '2026-10-15', calories: 1900 }),
      ],
      locale: 'en-US',
    });
    expect(series.mode).toBe('daily');
    expect(series.buckets).toHaveLength(90);
  });
});

describe('resolveBodyMetricValue', () => {
  it('marks Navy composition as estimated', () => {
    const row: BodyMeasurement = {
      id: '1',
      measured_on: '2026-11-01',
      weight_kg: 80,
      body_fat_percent: 18.5,
      waist_cm: 85,
      neck_cm: 38,
      hip_cm: null,
      bicep_cm: null,
      thigh_cm: null,
      fat_mass_kg: 14.8,
      lean_mass_kg: 65.2,
      ffmi: 21.2,
      composition_method: NAVY_COMPOSITION_METHOD,
      notes: null,
    };
    const point = resolveBodyMetricValue(row, 'body_fat_percent');
    expect(point?.source).toBe('estimated');
    expect(point?.value).toBe(18.5);
  });

  it('derives fat mass from weight and BF% when masses are missing', () => {
    const series = buildBodyMetricSeries({
      measurements: [
        {
          id: '1',
          measured_on: '2026-11-01',
          weight_kg: 100,
          body_fat_percent: 20,
          waist_cm: null,
          neck_cm: null,
          hip_cm: null,
          bicep_cm: null,
          thigh_cm: null,
          fat_mass_kg: null,
          lean_mass_kg: null,
          ffmi: null,
          composition_method: 'manual',
          notes: null,
        },
      ],
      startKey: '2026-11-01',
      endKey: '2026-11-01',
      metric: 'fat_mass_kg',
    });
    expect(series.points[0]?.value).toBe(20);
    expect(series.points[0]?.source).toBe('derived');
  });
});
