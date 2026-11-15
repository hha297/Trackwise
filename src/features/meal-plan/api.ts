import { getSupabase } from '@/lib/supabase/client';

import type { PlannedMeal, PlannedMealInput } from './types';

const COLUMNS =
  'id, plan_date, meal_type, recipe_id, title, notes, servings, calories, protein_g, carbs_g, fat_g, logged_food_entry_id, logged_servings, logged_at, created_at, updated_at';

export async function fetchPlannedMeals(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<PlannedMeal[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('planned_meals')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('plan_date', fromDate)
    .lte('plan_date', toDate)
    .order('plan_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlannedMeal[];
}

export async function createPlannedMeal(
  userId: string,
  input: PlannedMealInput,
): Promise<PlannedMeal> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('planned_meals')
    .insert({
      user_id: userId,
      plan_date: input.planDate,
      meal_type: input.mealType,
      recipe_id: input.recipeId ?? null,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      servings: input.servings,
      calories: input.calories,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as PlannedMeal;
}

export async function updatePlannedMeal(
  userId: string,
  id: string,
  input: PlannedMealInput,
): Promise<PlannedMeal> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('planned_meals')
    .update({
      plan_date: input.planDate,
      meal_type: input.mealType,
      recipe_id: input.recipeId ?? null,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      servings: input.servings,
      calories: input.calories,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as PlannedMeal;
}

export async function deletePlannedMeal(userId: string, id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('planned_meals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
