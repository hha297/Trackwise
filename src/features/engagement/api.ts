import { getSupabase } from '@/lib/supabase/client';

/** Distinct local diary days with ≥1 food entry in [startKey, endKey]. */
export async function fetchFoodLoggedDayKeys(
  userId: string,
  startKey: string,
  endKey: string,
): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('food_entries')
    .select('logged_on')
    .eq('user_id', userId)
    .gte('logged_on', startKey)
    .lte('logged_on', endKey);
  if (error) throw error;
  return [...new Set(((data ?? []) as { logged_on: string }[]).map((row) => row.logged_on))];
}
