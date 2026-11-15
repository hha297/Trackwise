import type { Food } from '../types';
import type { NormalizedFood } from './types';

/** Map provider food into the existing diary/recipe `Food` shape. */
export function appFoodFromNormalized(food: NormalizedFood): Food {
  const serving =
    food.servings.find((row) => row.isDefault) ?? food.servings[0] ?? null;
  const servingLabel =
    serving?.label ??
    (food.nutritionBasis === 'per100'
      ? `100 ${food.basisUnit ?? 'g'}`
      : '1 serving');

  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    serving_label: servingLabel,
    serving_grams:
      serving?.grams ??
      (food.nutritionBasis === 'per100' && food.basisUnit === 'g' ? 100 : null),
    calories: food.nutrition.calories ?? 0,
    protein_g: food.nutrition.proteinG ?? 0,
    carbs_g: food.nutrition.carbsG ?? 0,
    fat_g: food.nutrition.fatG ?? 0,
    source: food.provider === 'local' ? 'manual' : food.provider,
    image_url: food.imageUrl,
    nutrition_basis: food.nutritionBasis,
    basis_unit:
      food.basisUnit ??
      (food.nutritionBasis === 'serving' ? 'serving' : 'g'),
    basis_amount: food.nutritionBasis === 'per100' ? 100 : serving?.amount ?? 1,
  };
}

export function isExternalProviderFoodId(id: string) {
  return (
    id.startsWith('off:') ||
    id.startsWith('usda:') ||
    id.startsWith('fatsecret:')
  );
}
