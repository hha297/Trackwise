import { detectFoodStateHint } from './aliases';
import { nutritionCompleteness, roundNutrient } from './nutrition';
import type { NormalizedFood } from './types';

type UsdaNutrient = {
  nutrientId?: number;
  nutrientNumber?: string | number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
  amount?: number;
};

type UsdaSearchFood = {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  gtinUpc?: string;
};

const ENERGY_KCAL = new Set([1008, 2047]);
const PROTEIN = new Set([1003]);
const FAT = new Set([1004]);
const CARBS = new Set([1005]);
const FIBER = new Set([1079]);
const SUGARS = new Set([2000, 1063]);
const SAT_FAT = new Set([1258]);
const SODIUM = new Set([1093]);

function nutrientAmount(n: UsdaNutrient) {
  const value = n.value ?? n.amount;
  return value != null && Number.isFinite(value) ? Number(value) : null;
}

function pickNutrient(nutrients: UsdaNutrient[], ids: Set<number>, unit?: string) {
  for (const n of nutrients) {
    const id = n.nutrientId;
    if (id == null || !ids.has(id)) continue;
    if (unit && n.unitName && n.unitName.toUpperCase() !== unit.toUpperCase()) continue;
    const amount = nutrientAmount(n);
    if (amount != null) return amount;
  }
  return null;
}

export function normalizedFromUsdaSearchFood(food: UsdaSearchFood): NormalizedFood | null {
  const name = food.description?.trim();
  if (!name) return null;

  const nutrients = food.foodNutrients ?? [];
  const nutrition = {
    calories: roundNutrient(pickNutrient(nutrients, ENERGY_KCAL, 'KCAL'), 1),
    proteinG: roundNutrient(pickNutrient(nutrients, PROTEIN, 'G'), 2),
    carbsG: roundNutrient(pickNutrient(nutrients, CARBS, 'G'), 2),
    fatG: roundNutrient(pickNutrient(nutrients, FAT, 'G'), 2),
    fiberG: roundNutrient(pickNutrient(nutrients, FIBER, 'G'), 2),
    sugarsG: roundNutrient(pickNutrient(nutrients, SUGARS, 'G'), 2),
    saturatedFatG: roundNutrient(pickNutrient(nutrients, SAT_FAT, 'G'), 2),
    sodiumMg: roundNutrient(pickNutrient(nutrients, SODIUM, 'MG'), 1),
  };

  const completeness = nutritionCompleteness(nutrition);
  if (completeness === 'insufficient') return null;

  const dataType = (food.dataType ?? '').toLowerCase();
  const branded = dataType.includes('branded');
  const state = detectFoodStateHint(name);
  const servingUnit = food.servingSizeUnit?.toLowerCase();
  const servingGrams =
    food.servingSize != null && servingUnit === 'g' ? Number(food.servingSize) : null;

  return {
    id: `usda:${food.fdcId}`,
    provider: 'usda',
    providerFoodId: String(food.fdcId),
    barcode: food.gtinUpc?.trim() || null,
    name,
    brand: food.brandOwner?.trim() || food.brandName?.trim() || null,
    description: food.dataType ?? null,
    kind: branded ? 'branded' : 'generic',
    state,
    country: 'US',
    language: 'en',
    imageUrl: null,
    nutritionBasis: 'per100',
    basisUnit: 'g',
    nutrition,
    servings: [
      {
        id: 'usda-100g',
        label: '100 g',
        amount: 100,
        unit: 'g',
        grams: 100,
        isDefault: true,
      },
      ...(servingGrams
        ? [
            {
              id: 'usda-label',
              label: food.householdServingFullText?.trim() || `${servingGrams} g`,
              amount: servingGrams,
              unit: 'g' as const,
              grams: servingGrams,
              isDefault: false,
            },
          ]
        : []),
    ],
    completeness,
    rawOrCookedHint: state === 'unknown' ? null : state,
  };
}
