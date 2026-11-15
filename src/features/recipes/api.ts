import { getSupabase } from '@/lib/supabase/client';

import type { Recipe, RecipeIngredient, RecipeIngredientDraft, RecipeWithIngredients } from './types';

const RECIPE_COLUMNS =
  'id, name, description, instructions, servings, image_url, created_at, updated_at';
const INGREDIENT_COLUMNS =
  'id, recipe_id, position, food_id, food_name, brand, amount, amount_unit, nutrition_basis, basis_amount, basis_unit, serving_grams, calories, protein_g, carbs_g, fat_g';

export async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function fetchRecipe(
  userId: string,
  recipeId: string,
): Promise<RecipeWithIngredients | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .eq('user_id', userId)
    .eq('id', recipeId)
    .maybeSingle();
  if (error) throw error;
  if (!recipe) return null;

  const withFoodImage = `${INGREDIENT_COLUMNS}, food:foods ( image_url )`;
  let ingredients: RecipeIngredient[] = [];
  let imageByFoodId = new Map<string, string | null>();

  const joined = await supabase
    .from('recipe_ingredients')
    .select(withFoodImage)
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .order('position', { ascending: true });

  if (joined.error) {
    const basic = await supabase
      .from('recipe_ingredients')
      .select(INGREDIENT_COLUMNS)
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .order('position', { ascending: true });
    if (basic.error) throw basic.error;
    ingredients = (basic.data ?? []) as RecipeIngredient[];
  } else {
    type JoinedRow = RecipeIngredient & {
      food?: { image_url?: string | null } | { image_url?: string | null }[] | null;
    };
    const rows = (joined.data ?? []) as JoinedRow[];
    ingredients = rows.map(({ food: _food, ...row }) => row);
    for (const row of rows) {
      if (!row.food_id) continue;
      const food = Array.isArray(row.food) ? row.food[0] : row.food;
      imageByFoodId.set(row.food_id, food?.image_url ?? null);
    }
  }

  return {
    ...(recipe as Recipe),
    ingredients: ingredients.map((row) => ({
      ...row,
      image_url: row.food_id ? (imageByFoodId.get(row.food_id) ?? null) : null,
    })),
  };
}

function ingredientRows(userId: string, recipeId: string, drafts: RecipeIngredientDraft[]) {
  return drafts.map((draft, index) => ({
    recipe_id: recipeId,
    user_id: userId,
    position: index,
    food_id: draft.foodId,
    food_name: draft.foodName.trim(),
    brand: draft.brand,
    amount: draft.amount,
    amount_unit: draft.amountUnit,
    nutrition_basis: draft.nutritionBasis,
    basis_amount: draft.basisAmount,
    basis_unit: draft.basisUnit,
    serving_grams: draft.servingGrams,
    calories: draft.calories,
    protein_g: draft.proteinG,
    carbs_g: draft.carbsG,
    fat_g: draft.fatG,
  }));
}

export async function createRecipe(input: {
  userId: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  servings: number;
  imageUrl?: string | null;
  ingredients: RecipeIngredientDraft[];
}): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      servings: input.servings,
      image_url: input.imageUrl ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const recipeId = data.id as string;
  if (input.ingredients.length) {
    const { error: ingredientError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientRows(input.userId, recipeId, input.ingredients));
    if (ingredientError) {
      await supabase.from('recipes').delete().eq('id', recipeId).eq('user_id', input.userId);
      throw ingredientError;
    }
  }
  return recipeId;
}

export async function updateRecipe(input: {
  userId: string;
  recipeId: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  servings: number;
  imageUrl?: string | null;
  ingredients: RecipeIngredientDraft[];
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase
    .from('recipes')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      servings: input.servings,
      image_url: input.imageUrl ?? null,
    })
    .eq('id', input.recipeId)
    .eq('user_id', input.userId);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', input.recipeId)
    .eq('user_id', input.userId);
  if (deleteError) throw deleteError;

  if (input.ingredients.length) {
    const { error: ingredientError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientRows(input.userId, input.recipeId, input.ingredients));
    if (ingredientError) throw ingredientError;
  }
}

export async function deleteRecipe(userId: string, recipeId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', userId);
  if (error) throw error;
}
