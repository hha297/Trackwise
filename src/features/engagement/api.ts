import type { QueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase/client';

import {
  DAILY_ACTIVITY_QUERY_KEY,
  historyFromDailyActivityRows,
  mergeEarnedDayKeys,
  uniqueActivityDateKeys,
  type DailyActivityHistory,
  type DailyActivityKind,
  type DailyActivityRow,
} from './daily-activity';

type DailyActivityDbRow = {
  activity_date: string;
  nutrition: boolean;
  hydration: boolean;
  workout: boolean;
};

export async function fetchDailyActivityHistory(
  userId: string,
  startKey: string,
  endKey: string,
): Promise<DailyActivityHistory> {
  const supabase = getSupabase();
  if (!supabase) {
    return historyFromDailyActivityRows([]);
  }

  const [activityResult, foodResult] = await Promise.all([
    supabase
      .from('user_daily_activity')
      .select('activity_date, nutrition, hydration, workout')
      .eq('user_id', userId)
      .gte('activity_date', startKey)
      .lte('activity_date', endKey),
    supabase
      .from('food_entries')
      .select('logged_on')
      .eq('user_id', userId)
      .gte('logged_on', startKey)
      .lte('logged_on', endKey),
  ]);
  if (activityResult.error) throw activityResult.error;
  if (foodResult.error) throw foodResult.error;

  const rows: DailyActivityRow[] = ((activityResult.data ?? []) as DailyActivityDbRow[]).map(
    (row) => ({
      activityDate: row.activity_date,
      nutrition: Boolean(row.nutrition),
      hydration: Boolean(row.hydration),
      workout: Boolean(row.workout),
    }),
  );
  const history = historyFromDailyActivityRows(rows);
  const liveNutrition = [
    ...new Set(
      ((foodResult.data ?? []) as { logged_on: string }[]).map((row) => row.logged_on),
    ),
  ];
  return {
    ...history,
    nutritionKeys: mergeEarnedDayKeys(history.nutritionKeys, liveNutrition),
  };
}

export async function recordOwnDailyActivityDays(
  kind: DailyActivityKind,
  dateKeys: Iterable<string>,
): Promise<void> {
  const dates = uniqueActivityDateKeys(dateKeys);
  if (dates.length === 0) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc('record_own_daily_activity', {
    p_kind: kind,
    p_activity_dates: dates,
  });
  if (error) throw error;
}

export function invalidateDailyActivityQueries(
  queryClient: QueryClient,
  userId: string | undefined,
) {
  return queryClient.invalidateQueries({ queryKey: [DAILY_ACTIVITY_QUERY_KEY, userId] });
}
