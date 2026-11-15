import i18n from '@/i18n';
import type { FoodEntry } from '@/features/food/types';
import { mapWorkoutListRows, type WorkoutListJoinRow } from '@/features/workout/api';
import type { WorkoutListItem } from '@/features/workout/hooks';
import { getSupabase } from '@/lib/supabase/client';

const ENTRY_COLUMNS =
  'id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, nutrition_basis, basis_amount, basis_unit, image_url, fiber_g, sugars_g, saturated_fat_g, sodium_mg, food:foods ( image_url )';

const ENTRY_COLUMNS_BASIC =
  'id, logged_on, meal_type, quantity, food_name, brand, serving_label, calories, protein_g, carbs_g, fat_g, amount, amount_unit, image_url';

export type FoodEntryWithAmount = FoodEntry & {
  amount: number | null;
  amount_unit: string | null;
};

type JoinedEntryRow = FoodEntryWithAmount & {
  food?: { image_url?: string | null } | null;
};

function mapFoodEntry(row: JoinedEntryRow): FoodEntryWithAmount {
  const { food, ...entry } = row;
  return {
    ...entry,
    image_url: entry.image_url ?? food?.image_url ?? null,
  };
}

export async function fetchFoodEntriesInRange(
  userId: string,
  startKey: string,
  endKey: string,
): Promise<FoodEntryWithAmount[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  for (const columns of [ENTRY_COLUMNS, ENTRY_COLUMNS_BASIC]) {
    const { data, error } = await supabase
      .from('food_entries')
      .select(columns)
      .eq('user_id', userId)
      .gte('logged_on', startKey)
      .lte('logged_on', endKey)
      .order('logged_on', { ascending: true })
      .order('created_at', { ascending: true });
    if (!error) {
      return ((data ?? []) as unknown as JoinedEntryRow[]).map(mapFoodEntry);
    }
  }

  throw new Error(i18n.t('errors.loadFoodEntries'));
}

export async function fetchWorkoutsInRange(
  userId: string,
  startKey: string,
  endKey: string,
): Promise<WorkoutListItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const start = `${startKey}T00:00:00`;
  const end = `${endKey}T23:59:59`;
  const selects = [
    'id, name, started_at, ended_at, estimated_calories, status, active_duration_sec, workout_exercises(position, exercise_name, exercise:exercises(image_url, image_storage_path, image_key, slug), workout_sets(weight_kg, reps, duration_sec, distance_m))',
    'id, name, started_at, ended_at, estimated_calories, status, active_duration_sec, workout_exercises(position, exercise_name, exercise:exercises(image_url, image_storage_path, image_key, slug))',
    'id, name, started_at, ended_at, estimated_calories, status, active_duration_sec',
  ];

  let lastError: { message: string } | null = null;
  for (const columns of selects) {
    const { data, error } = await supabase
      .from('workouts')
      .select(columns)
      .eq('user_id', userId)
      .neq('status', 'discarded')
      .gte('started_at', start)
      .lte('started_at', end)
      .order('started_at', { ascending: true });
    if (!error) return mapWorkoutListRows((data ?? []) as unknown as WorkoutListJoinRow[]);
    lastError = error;
  }

  throw lastError ?? new Error('Could not load workouts.');
}

export async function fetchDayWorkouts(
  userId: string,
  dateKey: string,
): Promise<WorkoutListItem[]> {
  return fetchWorkoutsInRange(userId, dateKey, dateKey);
}
