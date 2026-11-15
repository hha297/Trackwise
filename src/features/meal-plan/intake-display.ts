import { scalePlannedMealNutrition } from './nutrition';
import { derivePlannedMealLogStatus } from './status';
import type { PlannedMeal, PlannedMealLogStatus } from './types';

const STEP = 0.25;
const MIN = 0.25;
const MAX = 99;

/** Snap servings to a compact UI step while keeping positive values. */
export function snapServings(value: number): number {
  if (!(value > 0)) return MIN;
  const snapped = Math.round(value / STEP) * STEP;
  const clamped = Math.min(MAX, Math.max(MIN, snapped));
  return Math.round(clamped * 100) / 100;
}

export function stepServings(value: number, direction: -1 | 1): number {
  return snapServings(value + direction * STEP);
}

export type IntakePreview = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Preview nutrition for a candidate actual serving count (log panel). */
export function previewActualIntake(
  meal: PlannedMeal,
  actualServings: number,
): IntakePreview | null {
  if (!(actualServings > 0) || !(meal.servings > 0)) return null;
  try {
    return scalePlannedMealNutrition(meal, actualServings);
  } catch {
    return null;
  }
}

/** Actual intake summary after a diary link exists. */
export function actualIntakeSummary(meal: PlannedMeal): {
  status: PlannedMealLogStatus;
  servings: number | null;
  calories: number | null;
  remainingServings: number | null;
} {
  const status = derivePlannedMealLogStatus(meal);
  if (status === 'planned' || meal.logged_servings == null) {
    return { status: 'planned', servings: null, calories: null, remainingServings: null };
  }
  const preview = previewActualIntake(meal, meal.logged_servings);
  const remaining =
    status === 'partial' ? Math.max(0, meal.servings - meal.logged_servings) : null;
  return {
    status,
    servings: meal.logged_servings,
    calories: preview ? Math.round(preview.calories) : null,
    remainingServings: remaining != null ? Math.round(remaining * 100) / 100 : null,
  };
}
