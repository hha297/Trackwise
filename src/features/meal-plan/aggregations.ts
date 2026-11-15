import { MEAL_ORDER } from '@/features/diary/aggregations';
import type { MealType } from '@/features/food/types';

import type { PlannedMeal } from './types';

export type PlannedMacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function sumPlannedMacros(meals: PlannedMeal[]): PlannedMacroTotals {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + Number(meal.calories ?? 0),
      proteinG: acc.proteinG + Number(meal.protein_g ?? 0),
      carbsG: acc.carbsG + Number(meal.carbs_g ?? 0),
      fatG: acc.fatG + Number(meal.fat_g ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function groupPlannedMealsByDate(meals: PlannedMeal[]) {
  const map = new Map<string, PlannedMeal[]>();
  for (const meal of meals) {
    const list = map.get(meal.plan_date) ?? [];
    list.push(meal);
    map.set(meal.plan_date, list);
  }
  for (const [key, list] of map) {
    map.set(
      key,
      [...list].sort((a, b) => {
        const mealDiff = MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type);
        if (mealDiff !== 0) return mealDiff;
        return a.created_at.localeCompare(b.created_at);
      }),
    );
  }
  return map;
}

export function plannedMealsForMeal(meals: PlannedMeal[], meal: MealType) {
  return meals.filter((row) => row.meal_type === meal);
}

export function roundPlannedTotals(totals: PlannedMacroTotals): PlannedMacroTotals {
  return {
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG * 10) / 10,
    carbsG: Math.round(totals.carbsG * 10) / 10,
    fatG: Math.round(totals.fatG * 10) / 10,
  };
}
