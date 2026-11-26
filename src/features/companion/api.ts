import { getSupabase } from '@/lib/supabase/client';

import { validateOverrideCalories } from './flexible-goals';
import type { DailyOverride } from './types';

type OverrideRow = {
  override_date: string;
  calories: number;
};

export function overrideQueryKey(userId: string | undefined, dateKey: string) {
  return ['daily-nutrition-override', userId, dateKey] as const;
}

export function isMissingOverrideTable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const row = error as { code?: unknown; message?: unknown };
  const code = typeof row.code === 'string' ? row.code : '';
  const message = typeof row.message === 'string' ? row.message.toLowerCase() : '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('daily_nutrition_overrides')
  );
}

export async function fetchDailyOverride(
  userId: string,
  dateKey: string,
): Promise<DailyOverride | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('daily_nutrition_overrides')
      .select('override_date, calories')
      .eq('user_id', userId)
      .eq('override_date', dateKey)
      .maybeSingle();
    if (error) {
      if (isMissingOverrideTable(error)) return null;
      throw error;
    }
    if (!data) return null;
    const row = data as OverrideRow;
    return { overrideDate: row.override_date, calories: row.calories };
  } catch (error) {
    if (isMissingOverrideTable(error)) return null;
    throw error;
  }
}

export async function upsertDailyOverride(input: {
  userId: string;
  dateKey: string;
  originalCalories: number;
  calories: number;
}): Promise<DailyOverride> {
  const validated = validateOverrideCalories({
    original: input.originalCalories,
    raw: input.calories,
  });
  if (!validated.ok) {
    throw new Error(`INVALID_OVERRIDE:${validated.reason}`);
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('daily_nutrition_overrides')
    .upsert(
      {
        user_id: input.userId,
        override_date: input.dateKey,
        calories: validated.calories,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,override_date' },
    )
    .select('override_date, calories')
    .single();
  if (error) {
    if (isMissingOverrideTable(error)) {
      throw new Error('OVERRIDE_TABLE_MISSING');
    }
    throw error;
  }
  const row = data as OverrideRow;
  return { overrideDate: row.override_date, calories: row.calories };
}

export async function deleteDailyOverride(userId: string, dateKey: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('daily_nutrition_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('override_date', dateKey);
  if (error) {
    if (isMissingOverrideTable(error)) return;
    throw error;
  }
}

export async function fetchDailyOverrides(userId: string): Promise<DailyOverride[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('daily_nutrition_overrides')
    .select('override_date, calories')
    .eq('user_id', userId)
    .order('override_date', { ascending: true });
  if (error) {
    if (isMissingOverrideTable(error)) return [];
    throw error;
  }
  return ((data ?? []) as OverrideRow[]).map((row) => ({
    overrideDate: row.override_date,
    calories: row.calories,
  }));
}
