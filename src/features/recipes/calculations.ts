import {
  scaleNutritionForAmount,
  type NullableNutrition,
} from '@/features/food/scan-calculations';
import type { FoodAmountUnit } from '@/features/food/types';

import type {
  RecipeIngredient,
  RecipeIngredientDraft,
  RecipeMacros,
  RecipeNutritionBasis,
} from './types';

export type IngredientNutritionInput = {
  amount: number;
  amountUnit: FoodAmountUnit;
  nutritionBasis: RecipeNutritionBasis;
  basisAmount: number | null;
  basisUnit: FoodAmountUnit | null;
  servingGrams: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function roundMacro(value: number) {
  return Math.round(value * 10) / 10;
}

function toBasis(input: IngredientNutritionInput) {
  if (input.nutritionBasis === 'per100') {
    return {
      kind: 'per100' as const,
      unit: (input.basisUnit === 'ml' ? 'ml' : 'g') as 'g' | 'ml',
    };
  }
  return {
    kind: 'serving' as const,
    label: 'serving',
    amount: input.basisAmount && input.basisAmount > 0 ? input.basisAmount : 1,
    unit: (input.basisUnit === 'g' || input.basisUnit === 'ml' ? input.basisUnit : null) as
      | 'g'
      | 'ml'
      | null,
  };
}

function servingConversion(input: IngredientNutritionInput) {
  if (input.servingGrams != null && input.servingGrams > 0) {
    return {
      amount: input.servingGrams,
      unit: (input.basisUnit === 'ml' ? 'ml' : 'g') as 'g' | 'ml',
    };
  }
  return null;
}

function massUnitFrom(input: Pick<IngredientNutritionInput, 'basisUnit'>): 'g' | 'ml' {
  return input.basisUnit === 'ml' ? 'ml' : 'g';
}

/**
 * Recipe amounts are g/ml only. For per-100 nutrition, g and ml use the same
 * amount/100 factor when density is unknown (matches common food-log UX).
 */
function effectiveAmountUnit(
  input: IngredientNutritionInput,
): 'g' | 'ml' | 'serving' {
  if (input.amountUnit === 'serving') {
    return massUnitFrom(input);
  }
  if (input.nutritionBasis === 'per100' && (input.amountUnit === 'g' || input.amountUnit === 'ml')) {
    return massUnitFrom(input);
  }
  return input.amountUnit;
}

/** Scale one ingredient's basis nutrition to the entered amount. */
export function ingredientContribution(input: IngredientNutritionInput): NullableNutrition {
  if (!(input.amount > 0)) {
    return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }
  try {
    return scaleNutritionForAmount(
      {
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
      },
      toBasis(input),
      input.amount,
      effectiveAmountUnit(input),
      servingConversion(input),
    );
  } catch {
    return {
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    };
  }
}

function fromRow(
  row: Pick<
    RecipeIngredient,
    | 'amount'
    | 'amount_unit'
    | 'nutrition_basis'
    | 'basis_amount'
    | 'basis_unit'
    | 'serving_grams'
    | 'calories'
    | 'protein_g'
    | 'carbs_g'
    | 'fat_g'
  >,
): IngredientNutritionInput {
  return {
    amount: Number(row.amount),
    amountUnit: row.amount_unit,
    nutritionBasis: row.nutrition_basis,
    basisAmount: row.basis_amount,
    basisUnit: row.basis_unit,
    servingGrams: row.serving_grams,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
  };
}

function fromDraft(row: RecipeIngredientDraft): IngredientNutritionInput {
  return {
    amount: row.amount,
    amountUnit: row.amountUnit,
    nutritionBasis: row.nutritionBasis,
    basisAmount: row.basisAmount,
    basisUnit: row.basisUnit,
    servingGrams: row.servingGrams,
    calories: row.calories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
  };
}

export function sumRecipeMacros(
  ingredients: IngredientNutritionInput[],
  servings: number,
): { total: RecipeMacros; perServing: RecipeMacros } {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let complete = ingredients.length > 0;

  if (ingredients.length === 0) {
    complete = true;
  }

  for (const ingredient of ingredients) {
    const part = ingredientContribution(ingredient);
    if (
      part.calories == null ||
      part.proteinG == null ||
      part.carbsG == null ||
      part.fatG == null
    ) {
      complete = false;
      continue;
    }
    calories += part.calories;
    proteinG += part.proteinG;
    carbsG += part.carbsG;
    fatG += part.fatG;
  }

  const total: RecipeMacros = {
    calories: roundMacro(calories),
    proteinG: roundMacro(proteinG),
    carbsG: roundMacro(carbsG),
    fatG: roundMacro(fatG),
    complete,
  };

  const divisor = servings > 0 ? servings : 1;
  const perServing: RecipeMacros = {
    calories: roundMacro(total.calories / divisor),
    proteinG: roundMacro(total.proteinG / divisor),
    carbsG: roundMacro(total.carbsG / divisor),
    fatG: roundMacro(total.fatG / divisor),
    complete: total.complete,
  };

  return { total, perServing };
}

export function sumRecipeMacrosFromRows(ingredients: RecipeIngredient[], servings: number) {
  return sumRecipeMacros(ingredients.map(fromRow), servings);
}

export function sumRecipeMacrosFromDrafts(ingredients: RecipeIngredientDraft[], servings: number) {
  return sumRecipeMacros(ingredients.map(fromDraft), servings);
}

/** Scale planned snapshot macros when servings change. */
export function scalePlannedMacros(
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number },
  previousServings: number,
  nextServings: number,
) {
  if (!(previousServings > 0) || !(nextServings > 0)) {
    throw new Error('Servings must be positive.');
  }
  const factor = nextServings / previousServings;
  return {
    calories: roundMacro(macros.calories * factor),
    proteinG: roundMacro(macros.proteinG * factor),
    carbsG: roundMacro(macros.carbsG * factor),
    fatG: roundMacro(macros.fatG * factor),
  };
}

function resolveMassUnit(input: {
  basisUnit?: FoodAmountUnit | null;
  servingLabel?: string | null;
}): 'g' | 'ml' {
  const label = input.servingLabel?.trim() ?? '';
  if (input.basisUnit === 'ml' || /\b(?:ml|cl|l)\b/i.test(label)) return 'ml';
  return 'g';
}

export function draftFromFood(input: {
  key: string;
  foodId: string;
  name: string;
  brand: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingGrams: number | null;
  imageUrl?: string | null;
  servingLabel?: string | null;
  nutritionBasis?: RecipeNutritionBasis | null;
  basisUnit?: FoodAmountUnit | null;
  basisAmount?: number | null;
}): RecipeIngredientDraft {
  const label = input.servingLabel?.trim() ?? '';
  const per100 =
    input.nutritionBasis === 'per100' || /^100\s*(g|ml)$/i.test(label);
  const massUnit = resolveMassUnit(input);

  if (per100) {
    return {
      key: input.key,
      foodId: input.foodId,
      foodName: input.name,
      brand: input.brand,
      imageUrl: input.imageUrl ?? null,
      amount: 100,
      amountUnit: massUnit,
      nutritionBasis: 'per100',
      basisAmount: 100,
      basisUnit: massUnit,
      servingGrams: input.servingGrams ?? (massUnit === 'g' ? 100 : null),
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
    };
  }

  const servingMass =
    input.basisUnit === massUnit && input.basisAmount && input.basisAmount > 0
      ? input.basisAmount
      : input.servingGrams && input.servingGrams > 0
        ? input.servingGrams
        : 100;

  return {
    key: input.key,
    foodId: input.foodId,
    foodName: input.name,
    brand: input.brand,
    imageUrl: input.imageUrl ?? null,
    amount: servingMass,
    amountUnit: massUnit,
    nutritionBasis: 'serving',
    basisAmount: servingMass,
    basisUnit: massUnit,
    servingGrams: input.servingGrams ?? (massUnit === 'g' ? servingMass : null),
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  };
}

/** Normalize legacy "serving" amounts to g/ml for the editor. */
export function normalizeIngredientAmountUnit(
  row: Pick<RecipeIngredientDraft, 'amount' | 'amountUnit' | 'basisUnit' | 'servingGrams'>,
): Pick<RecipeIngredientDraft, 'amount' | 'amountUnit'> {
  if (row.amountUnit === 'g' || row.amountUnit === 'ml') {
    return { amount: row.amount, amountUnit: row.amountUnit };
  }
  const unit: 'g' | 'ml' = row.basisUnit === 'ml' ? 'ml' : 'g';
  const amount =
    row.servingGrams && row.servingGrams > 0
      ? row.amount * row.servingGrams
      : row.amount > 0
        ? row.amount * 100
        : 100;
  return { amount, amountUnit: unit };
}
