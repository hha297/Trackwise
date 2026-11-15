import type { QueryClient } from '@tanstack/react-query';

import { fetchFoodEntries } from '@/features/food/api';
import { ensureProfile, fetchActiveGoal } from '@/features/goals/api';
import i18n from '@/i18n';
import { getSupabase } from '@/lib/supabase/client';
import { toDiaryDateKey } from '@/utils/date';

export type PrefetchAuthContext = {
  userId: string;
  email?: string | null;
};

/** Pull a readable message from Error, PostgrestError, or plain auth objects. */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string' && error.message) {
      return error.message;
    }
    if ('error_description' in error && typeof error.error_description === 'string') {
      return error.error_description;
    }
    if ('msg' in error && typeof error.msg === 'string') {
      return error.msg;
    }
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return '';
}

/**
 * Confirms the persisted session still maps to a live Auth user.
 * Deleted accounts leave a stale JWT — getUser() fails server-side.
 */
export async function assertLiveAuthUser(expectedUserId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw Object.assign(new Error('Supabase is not configured.'), { status: 401 });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (!data.user || data.user.id !== expectedUserId) {
    throw Object.assign(new Error('User session is no longer valid.'), {
      status: 401,
      code: 'user_not_found',
    });
  }
}

/** Minimal diary-home data so Main opens without a second waterfall. */
export async function prefetchBootstrapData(
  queryClient: QueryClient,
  ctx: PrefetchAuthContext,
): Promise<void> {
  const { userId, email } = ctx;
  const dateKey = toDiaryDateKey();
  const displayName = email?.includes('@') ? email.split('@')[0] : null;

  await assertLiveAuthUser(userId);
  await ensureProfile(userId, displayName);

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['profile', userId],
      queryFn: () => ensureProfile(userId, displayName),
    }),
    queryClient.prefetchQuery({
      queryKey: ['goal', 'active', userId],
      queryFn: () => fetchActiveGoal(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: ['food-entries', userId, dateKey],
      queryFn: () => fetchFoodEntries(userId, dateKey),
    }),
  ]);
}

export function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    if (typeof error === 'string') {
      return isAuthFailureMessage(error);
    }
    return false;
  }

  const status = 'status' in error ? Number(error.status) : NaN;
  if (status === 401 || status === 403) {
    return true;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (
    code === 'PGRST301' ||
    code === '42501' ||
    code === 'user_not_found' ||
    code === '23503' // FK — e.g. profiles.id → auth.users after account delete
  ) {
    return true;
  }

  return isAuthFailureMessage(extractErrorMessage(error));
}

function isAuthFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('jwt expired') ||
    lower.includes('invalid jwt') ||
    lower.includes('not authenticated') ||
    lower.includes('invalid claim') ||
    lower.includes('user from sub claim') ||
    lower.includes('user not found') ||
    lower.includes('session is no longer valid') ||
    lower.includes('does not exist') ||
    lower.includes('refresh_token_not_found') ||
    lower.includes('invalid refresh token') ||
    lower.includes('session_not_found')
  );
}

/** User-facing message when required tables were never migrated. */
export function toBootstrapErrorMessage(error: unknown): string {
  const message = extractErrorMessage(error);
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';

  if (
    code === 'PGRST205' ||
    message.toLowerCase().includes('could not find the table') ||
    message.toLowerCase().includes('schema cache')
  ) {
    return i18n.t('bootstrap.schemaMissing');
  }

  if (message) {
    return message;
  }

  return i18n.t('bootstrap.loadFailed');
}
