import i18n from '@/i18n';
import { getSupabase } from '@/lib/supabase/client';

import type { FoodEntry } from './types';

const ENTRY_COLUMNS =
  'id, food_id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, nutrition_basis, basis_amount, basis_unit, image_url, fiber_g, sugars_g, saturated_fat_g, sodium_mg, planned_meal_id, recipe_id, entry_source, food:foods ( image_url )';

const ENTRY_COLUMNS_BASIC =
  'id, food_id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, nutrition_basis, basis_amount, image_url, planned_meal_id, recipe_id, entry_source';

type JoinedEntryRow = FoodEntry & {
  food?: { image_url?: string | null } | null;
};

function mapFoodEntry(row: JoinedEntryRow): FoodEntry {
  const { food, ...entry } = row;
  return {
    ...entry,
    image_url: entry.image_url ?? food?.image_url ?? null,
  };
}

export async function fetchFoodEntries(userId: string, dateKey: string): Promise<FoodEntry[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  for (const columns of [ENTRY_COLUMNS, ENTRY_COLUMNS_BASIC]) {
    const { data, error } = await supabase
      .from('food_entries')
      .select(columns)
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('created_at', { ascending: true });
    if (!error) {
      return ((data ?? []) as unknown as JoinedEntryRow[]).map(mapFoodEntry);
    }
  }

  throw new Error(i18n.t('errors.loadFoodEntries'));
}
