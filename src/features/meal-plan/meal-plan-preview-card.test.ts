import { describe, expect, it } from 'vitest';

import { MEAL_ORDER } from '@/features/diary/aggregations';
import {
  roundPlannedTotals,
  sumPlannedMacros,
} from '@/features/meal-plan/aggregations';
import type { PlannedMeal } from '@/features/meal-plan/types';

function meal(partial: Partial<PlannedMeal> & Pick<PlannedMeal, 'id' | 'meal_type'>): PlannedMeal {
  return {
    plan_date: '2026-11-14',
    recipe_id: null,
    title: 'Meal',
    notes: null,
    servings: 1,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    created_at: '2026-11-14T00:00:00Z',
    updated_at: '2026-11-14T00:00:00Z',
    logged_food_entry_id: null,
    logged_servings: null,
    logged_at: null,
    ...partial,
  };
}

describe('meal plan preview totals', () => {
  it('sums planned macros with the same helpers as Meal Plan', () => {
    const meals = [
      meal({ id: '1', meal_type: 'breakfast', calories: 400, protein_g: 30 }),
      meal({ id: '2', meal_type: 'lunch', calories: 500, protein_g: 40 }),
      meal({ id: '3', meal_type: 'breakfast', calories: 100, protein_g: 10 }),
    ];
    const totals = roundPlannedTotals(sumPlannedMacros(meals));
    expect(totals.calories).toBe(1000);
    expect(totals.proteinG).toBe(80);
    const slots = MEAL_ORDER.filter((slot) => meals.some((row) => row.meal_type === slot)).length;
    expect(slots).toBe(2);
  });

  it('treats empty plan as no preview totals', () => {
    expect(sumPlannedMacros([]).calories).toBe(0);
  });
});
