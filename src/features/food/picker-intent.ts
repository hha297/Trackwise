import type { MealType } from './types';

/** Why the food picker was opened. */
export type FoodPickerIntent = 'log' | 'plan';

/** Source tab inside the unified picker. */
export type FoodPickerSource = 'foods' | 'recipes' | 'create';

export function parseFoodPickerIntent(value: string | undefined): FoodPickerIntent {
  return value === 'plan' ? 'plan' : 'log';
}

export function parseFoodPickerSource(value: string | undefined): FoodPickerSource {
  if (value === 'recipes' || value === 'create' || value === 'manual') {
    return value === 'manual' ? 'create' : value;
  }
  return 'foods';
}

export function isMealType(value: string | undefined): value is MealType {
  return (
    value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snacks'
  );
}

export function parseMealType(value: string | undefined, fallback: MealType = 'lunch'): MealType {
  return isMealType(value) ? value : fallback;
}
