import { describe, expect, it } from 'vitest';

import { plannedMealDiaryDateKey, scalePlannedMealNutrition } from './nutrition';
import { plannedMealClientRequestId } from './status';
import type { PlannedMeal } from './types';

const meal: PlannedMeal = {
  id: 'plan-1',
  plan_date: '2026-11-14',
  meal_type: 'lunch',
  recipe_id: null,
  title: 'Bowl',
  notes: null,
  servings: 2,
  calories: 500,
  protein_g: 40,
  carbs_g: 50,
  fat_g: 20,
  logged_food_entry_id: null,
  logged_servings: null,
  logged_at: null,
  created_at: '2026-11-14T00:00:00Z',
  updated_at: '2026-11-14T00:00:00Z',
};

describe('scalePlannedMealNutrition', () => {
  it('scales planned snapshot by actual/planned servings', () => {
    expect(scalePlannedMealNutrition(meal, 1)).toEqual({
      calories: 250,
      proteinG: 20,
      carbsG: 25,
      fatG: 10,
    });
  });

  it('keeps macros when actual equals planned', () => {
    expect(scalePlannedMealNutrition(meal, 2)).toEqual({
      calories: 500,
      proteinG: 40,
      carbsG: 50,
      fatG: 20,
    });
  });

  it('supports fractional actual servings (partial log)', () => {
    expect(scalePlannedMealNutrition(meal, 0.5)).toEqual({
      calories: 125,
      proteinG: 10,
      carbsG: 12.5,
      fatG: 5,
    });
  });

  it('rejects non-positive actual servings', () => {
    expect(() => scalePlannedMealNutrition(meal, 0)).toThrow(/positive/i);
  });
});

describe('duplicate protection keys', () => {
  it('uses a stable client_request_id per planned meal', () => {
    expect(plannedMealClientRequestId(meal.id)).toBe('planned_meal:plan-1');
    expect(plannedMealClientRequestId(meal.id)).toBe(plannedMealClientRequestId('plan-1'));
  });
});

describe('date boundaries', () => {
  it('logs against the plan local date key, not a UTC slice of logged_at', () => {
    expect(plannedMealDiaryDateKey(meal)).toBe('2026-11-14');
    expect(
      plannedMealDiaryDateKey({
        plan_date: '2026-11-13',
      }),
    ).toBe('2026-11-13');
  });
});
