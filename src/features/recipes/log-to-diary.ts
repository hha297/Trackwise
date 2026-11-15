import { sumRecipeMacrosFromRows } from './calculations';
import type { Recipe, RecipeIngredient } from './types';

export type RecipeLogMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Scale recipe per-serving macros to an actual logged serving count. */
export function scaleRecipeServingsForLog(
  recipe: Pick<Recipe, 'servings' | 'name'> & { ingredients: RecipeIngredient[] },
  actualServings: number,
): {
  perServing: RecipeLogMacros;
  totals: RecipeLogMacros;
  servingLabel: string;
} {
  if (!(actualServings > 0)) {
    throw new Error('Servings must be greater than zero.');
  }
  const macros = sumRecipeMacrosFromRows(recipe.ingredients, recipe.servings);
  const totals = {
    calories: Math.round(macros.perServing.calories * actualServings * 10) / 10,
    proteinG: Math.round(macros.perServing.proteinG * actualServings * 10) / 10,
    carbsG: Math.round(macros.perServing.carbsG * actualServings * 10) / 10,
    fatG: Math.round(macros.perServing.fatG * actualServings * 10) / 10,
  };
  return {
    perServing: {
      calories: macros.perServing.calories,
      proteinG: macros.perServing.proteinG,
      carbsG: macros.perServing.carbsG,
      fatG: macros.perServing.fatG,
    },
    totals,
    servingLabel: `${actualServings} servings`,
  };
}

/**
 * Payload for useLogFoodEntry: pass pre-scaled totals with quantity 1
 * so diary macros match the chosen servings exactly.
 */
export function recipeToLogFoodInput(input: {
  recipe: Pick<Recipe, 'id' | 'name' | 'servings'> & { ingredients: RecipeIngredient[] };
  actualServings: number;
  dateKey: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
}) {
  const scaled = scaleRecipeServingsForLog(input.recipe, input.actualServings);
  return {
    dateKey: input.dateKey,
    mealType: input.mealType,
    quantity: 1,
    amount: input.actualServings,
    amountUnit: 'serving' as const,
    nutritionBasis: 'serving' as const,
    basisAmount: 1,
    basisUnit: 'serving' as const,
    entrySource: 'recipe' as const,
    recipeId: input.recipe.id,
    food: {
      id: null,
      name: input.recipe.name,
      brand: null,
      servingLabel: scaled.servingLabel,
      calories: scaled.totals.calories,
      proteinG: scaled.totals.proteinG,
      carbsG: scaled.totals.carbsG,
      fatG: scaled.totals.fatG,
      imageUrl: null,
    },
  };
}
