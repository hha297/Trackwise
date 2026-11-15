import { describe, expect, it } from 'vitest';

import {
  groupPlannedMealsByDate,
  plannedMealsForMeal,
  roundPlannedTotals,
  sumPlannedMacros,
} from './aggregations';
import type { PlannedMeal } from './types';

function meal(partial: Partial<PlannedMeal> & Pick<PlannedMeal, 'id' | 'plan_date' | 'meal_type'>): PlannedMeal {
  return {
    title: 'Meal',
    notes: null,
    recipe_id: null,
    servings: 1,
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    logged_food_entry_id: null,
    logged_servings: null,
    logged_at: null,
    created_at: '2026-11-13T10:00:00.000Z',
    updated_at: '2026-11-13T10:00:00.000Z',
    ...partial,
  };
}

describe('meal plan aggregations', () => {
  it('sums daily planned macros', () => {
    const totals = sumPlannedMacros([
      meal({ id: '1', plan_date: '2026-11-13', meal_type: 'breakfast', calories: 300, protein_g: 20 }),
      meal({ id: '2', plan_date: '2026-11-13', meal_type: 'lunch', calories: 500, protein_g: 35 }),
    ]);
    expect(roundPlannedTotals(totals)).toEqual({
      calories: 800,
      proteinG: 55,
      carbsG: 0,
      fatG: 0,
    });
  });

  it('groups by date and meal order', () => {
    const grouped = groupPlannedMealsByDate([
      meal({ id: 'd', plan_date: '2026-11-13', meal_type: 'dinner', created_at: '2026-11-13T12:00:00.000Z' }),
      meal({ id: 'b', plan_date: '2026-11-13', meal_type: 'breakfast', created_at: '2026-11-13T11:00:00.000Z' }),
      meal({ id: 'n', plan_date: '2026-11-14', meal_type: 'lunch' }),
    ]);
    expect(grouped.get('2026-11-13')?.map((m) => m.id)).toEqual(['b', 'd']);
    expect(grouped.get('2026-11-14')?.map((m) => m.id)).toEqual(['n']);
  });

  it('filters by meal type', () => {
    const rows = [
      meal({ id: '1', plan_date: '2026-11-13', meal_type: 'snacks' }),
      meal({ id: '2', plan_date: '2026-11-13', meal_type: 'lunch' }),
    ];
    expect(plannedMealsForMeal(rows, 'snacks').map((m) => m.id)).toEqual(['1']);
  });
});
