import { getSupabase } from '@/lib/supabase/client';

import {
  DEFAULT_HYDRATION_TARGET_ML,
  isValidIntakeMl,
  isValidTargetMl,
  type HydrationEntry,
} from './calculations';

type HydrationRow = {
  id: string;
  logged_on: string;
  amount_ml: number;
};

export async function fetchHydration(userId: string, fromDate: string, toDate: string): Promise<{
  entries: HydrationEntry[];
  targetMl: number;
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const [entriesResult, targetResult] = await Promise.all([
    supabase
      .from('hydration_entries')
      .select('id, logged_on, amount_ml')
      .eq('user_id', userId)
      .gte('logged_on', fromDate)
      .lte('logged_on', toDate)
      .order('created_at', { ascending: true }),
    supabase.from('hydration_targets').select('target_ml').eq('user_id', userId).maybeSingle(),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (targetResult.error) throw targetResult.error;

  return {
    entries: ((entriesResult.data ?? []) as HydrationRow[]).map((row) => ({
      id: row.id,
      loggedOn: row.logged_on,
      amountMl: row.amount_ml,
    })),
    targetMl: targetResult.data?.target_ml ?? DEFAULT_HYDRATION_TARGET_ML,
  };
}

export async function addHydration(userId: string, loggedOn: string, amountMl: number) {
  if (!isValidIntakeMl(amountMl)) throw new Error('INVALID_INTAKE');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('hydration_entries').insert({
    user_id: userId,
    logged_on: loggedOn,
    amount_ml: amountMl,
  });
  if (error) throw error;
}

export async function updateHydration(userId: string, id: string, amountMl: number) {
  if (!isValidIntakeMl(amountMl)) throw new Error('INVALID_INTAKE');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('hydration_entries')
    .update({ amount_ml: amountMl })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteHydration(userId: string, id: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('hydration_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function setHydrationTarget(userId: string, targetMl: number) {
  if (!isValidTargetMl(targetMl)) throw new Error('INVALID_TARGET');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('hydration_targets').upsert({
    user_id: userId,
    target_ml: targetMl,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
