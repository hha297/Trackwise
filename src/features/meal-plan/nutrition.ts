import { scalePlannedMacros } from '@/features/recipes/calculations';

import type { PlannedMeal } from './types';

/** Scale planned snapshot macros to an actual logged serving count. */
export function scalePlannedMealNutrition(meal: PlannedMeal, actualServings: number) {
  return scalePlannedMacros(
    {
      calories: meal.calories,
      proteinG: meal.protein_g,
      carbsG: meal.carbs_g,
      fatG: meal.fat_g,
    },
    meal.servings,
    actualServings,
  );
}

/**
 * Contract used by log_planned_meal: diary logged_on equals the plan's local date key.
 * Callers must pass diary date keys (YYYY-MM-DD), never UTC-sliced timestamps.
 */
export function plannedMealDiaryDateKey(meal: Pick<PlannedMeal, 'plan_date'>): string {
  return meal.plan_date;
}
