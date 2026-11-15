import type { FoodAmountUnit, MealType } from '@/features/food/types';

export type RecipeNutritionBasis = 'per100' | 'serving';

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  position: number;
  food_id: string | null;
  food_name: string;
  brand: string | null;
  amount: number;
  amount_unit: FoodAmountUnit;
  nutrition_basis: RecipeNutritionBasis;
  basis_amount: number | null;
  basis_unit: FoodAmountUnit | null;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Joined from foods for editor display only; not a recipe_ingredients column. */
  image_url?: string | null;
};

export type Recipe = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeWithIngredients = Recipe & {
  ingredients: RecipeIngredient[];
};

export type RecipeIngredientDraft = {
  key: string;
  foodId: string | null;
  foodName: string;
  brand: string | null;
  /** Display-only; not persisted on recipe_ingredients. */
  imageUrl?: string | null;
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

export type RecipeMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when every ingredient contributed finite macros. */
  complete: boolean;
};

export type { MealType, FoodAmountUnit };
