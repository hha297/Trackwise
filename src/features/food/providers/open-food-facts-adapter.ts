import { detectFoodStateHint } from './aliases';
import { nutritionCompleteness, roundNutrient } from './nutrition';
import type { NormalizedFood } from './types';
import {
  searchOpenFoodFactsProducts,
  type TrackwiseFood,
} from '../open-food-facts';

export function normalizedFromOpenFoodFacts(
  food: TrackwiseFood,
  language?: string | null,
): NormalizedFood | null {
  if (!food.name.trim()) return null;

  const nutrition = {
    calories: roundNutrient(food.calories, 1),
    proteinG: roundNutrient(food.proteinG, 2),
    carbsG: roundNutrient(food.carbsG, 2),
    fatG: roundNutrient(food.fatG, 2),
    fiberG: roundNutrient(food.fiberG ?? null, 2),
    sugarsG: roundNutrient(food.sugarsG ?? null, 2),
    saturatedFatG: roundNutrient(food.saturatedFatG ?? null, 2),
    sodiumMg: roundNutrient(food.sodiumMg ?? null, 1),
  };

  const completeness = nutritionCompleteness(nutrition);
  if (completeness === 'insufficient') return null;

  const kind = food.brand ? 'branded' : 'generic';
  const state = detectFoodStateHint(food.name);

  return {
    id: `off:${food.barcode || food.name.trim().toLowerCase()}`,
    provider: 'open_food_facts',
    providerFoodId: food.barcode || food.name.trim().toLowerCase(),
    barcode: food.barcode?.trim() || null,
    name: food.name.trim(),
    brand: food.brand,
    description: null,
    kind,
    state,
    country: null,
    language: language ?? null,
    imageUrl: food.imageUrl,
    nutritionBasis: food.basis.kind === 'per100' ? 'per100' : 'serving',
    basisUnit:
      food.basis.kind === 'per100'
        ? food.basis.unit
        : food.basis.unit === 'g' || food.basis.unit === 'ml'
          ? food.basis.unit
          : null,
    nutrition,
    servings:
      food.serving != null
        ? [
            {
              id: 'off-serving',
              label: food.serving.label,
              amount: food.serving.amount,
              unit: food.serving.unit,
              grams: food.serving.unit === 'g' ? food.serving.amount : null,
              isDefault: true,
            },
          ]
        : [
            {
              id: 'off-100',
              label: food.basis.kind === 'per100' ? `100 ${food.basis.unit}` : '1 serving',
              amount: food.basis.kind === 'per100' ? 100 : 1,
              unit: food.basis.kind === 'per100' ? food.basis.unit : 'serving',
              grams: food.basis.kind === 'per100' && food.basis.unit === 'g' ? 100 : null,
              isDefault: true,
            },
          ],
    completeness,
    rawOrCookedHint: state === 'unknown' ? null : state,
  };
}

export async function searchOpenFoodFactsNormalized(
  query: string,
  options: { signal?: AbortSignal; language?: string | null; pageSize?: number } = {},
): Promise<NormalizedFood[]> {
  const products = await searchOpenFoodFactsProducts(query, {
    signal: options.signal,
    language: options.language,
    pageSize: options.pageSize ?? 16,
  });
  return products
    .map((product) => normalizedFromOpenFoodFacts(product, options.language))
    .filter((row): row is NormalizedFood => row != null);
}
