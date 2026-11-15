import { describe, expect, it } from 'vitest';

import { recipeToLogFoodInput, scaleRecipeServingsForLog } from './log-to-diary';
import type { RecipeIngredient } from './types';

const ingredients: RecipeIngredient[] = [
  {
    id: 'ing-1',
    recipe_id: 'rec-1',
    position: 0,
    food_id: null,
    food_name: 'Oats',
    brand: null,
    amount: 100,
    amount_unit: 'g',
    nutrition_basis: 'per100',
    basis_amount: 100,
    basis_unit: 'g',
    serving_grams: 100,
    calories: 380,
    protein_g: 13,
    carbs_g: 60,
    fat_g: 7,
  },
];

const recipe = {
  id: 'rec-1',
  name: 'Oat bowl',
  servings: 2,
  ingredients,
};

describe('scaleRecipeServingsForLog', () => {
  it('scales per-serving macros to actual servings', () => {
    const scaled = scaleRecipeServingsForLog(recipe, 1);
    expect(scaled.perServing.calories).toBe(190);
    expect(scaled.totals.calories).toBe(190);
    expect(scaled.servingLabel).toBe('1 servings');
  });

  it('rejects non-positive servings', () => {
    expect(() => scaleRecipeServingsForLog(recipe, 0)).toThrow(/greater than zero/i);
  });
});

describe('recipeToLogFoodInput', () => {
  it('builds a quantity-1 payload with pre-scaled totals', () => {
    const input = recipeToLogFoodInput({
      recipe,
      actualServings: 2,
      dateKey: '2026-11-14',
      mealType: 'breakfast',
    });
    expect(input.quantity).toBe(1);
    expect(input.amount).toBe(2);
    expect(input.amountUnit).toBe('serving');
    expect(input.food.name).toBe('Oat bowl');
    expect(input.food.id).toBeNull();
    expect(input.food.calories).toBe(380);
    expect(input.entrySource).toBe('recipe');
    expect(input.recipeId).toBe('rec-1');
  });
});
