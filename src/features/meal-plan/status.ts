import type { PlannedMeal, PlannedMealLogStatus } from './types';

const EPS = 1e-6;

/** Derive Planned / Partially logged / Logged from plan + diary link fields. */
export function derivePlannedMealLogStatus(meal: PlannedMeal): PlannedMealLogStatus {
  if (meal.logged_food_entry_id == null || meal.logged_servings == null) {
    return 'planned';
  }
  if (meal.logged_servings + EPS < meal.servings) {
    return 'partial';
  }
  return 'logged';
}

export function plannedMealClientRequestId(plannedMealId: string) {
  return `planned_meal:${plannedMealId}`;
}
