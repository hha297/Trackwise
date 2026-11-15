import type { MealType } from '@/features/food/types';

export type PlannedMealLogStatus = 'planned' | 'partial' | 'logged';

export type PlannedMeal = {
  id: string;
  plan_date: string;
  meal_type: MealType;
  recipe_id: string | null;
  title: string;
  notes: string | null;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_food_entry_id: string | null;
  logged_servings: number | null;
  logged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlannedMealInput = {
  planDate: string;
  mealType: MealType;
  recipeId?: string | null;
  title: string;
  notes?: string | null;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};
