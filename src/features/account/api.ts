import i18n from '@/i18n';

import { getAppVersion } from '@/lib/app-version';
import { getSupabase } from '@/lib/supabase/client';

import type { Profile } from '@/features/goals/types';

import {
  TRACKWISE_BACKUP_FORMAT,
  TRACKWISE_BACKUP_VERSION,
  type TrackwiseBackup,
} from './backup';

const PROFILE_COLUMNS =
  'id, display_name, height_cm, sex, birth_date, units, activity_level, onboarding_completed_at, avatar_url';

export type ProfileUpdate = {
  display_name?: string | null;
  height_cm?: number | null;
  sex?: Profile['sex'];
  birth_date?: string | null;
  units?: Profile['units'];
  activity_level?: Profile['activity_level'];
  avatar_url?: string | null;
};

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (!error) {
    return data as Profile;
  }

  const message = error.message?.toLowerCase() ?? '';
  if (
    patch.avatar_url !== undefined &&
    message.includes('avatar_url') &&
    (message.includes('column') || message.includes('does not exist'))
  ) {
    throw new Error(
      'Avatar column is missing in the database. Apply migration 20261029210000_profile_avatar.sql (supabase db push).',
    );
  }

  throw error;
}

/** @deprecated Prefer TrackwiseBackup from exportUserData. Kept for type consumers during transition. */
export type UserDataExport = TrackwiseBackup;

function appVersion(): string {
  return getAppVersion();
}

/**
 * Export the authenticated user's own rows (RLS-scoped) as a Trackwise backup.
 * Excludes auth secrets/tokens. System catalog foods/exercises/templates are not copied
 * except via favorites / FK references the user already owns.
 */
export async function exportUserData(userId: string, _email?: string | null): Promise<TrackwiseBackup> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const [
    profile,
    goals,
    measurements,
    foodEntries,
    foods,
    foodFavorites,
    workouts,
    customExercises,
    exerciseFavorites,
    templates,
    onboarding,
    nutritionOverrides,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_on', { ascending: false }),
    supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .order('logged_on', { ascending: false })
      .limit(10000),
    supabase.from('foods').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('food_favorites').select('*').eq('user_id', userId),
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(2000),
    supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('created_at', { ascending: false }),
    supabase.from('exercise_favorites').select('*').eq('user_id', userId),
    supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('updated_at', { ascending: false }),
    supabase.from('onboarding_progress').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('daily_nutrition_overrides')
      .select('*')
      .eq('user_id', userId)
      .order('override_date', { ascending: true }),
  ]);

  for (const result of [
    profile,
    goals,
    measurements,
    foodEntries,
    foods,
    foodFavorites,
    workouts,
    customExercises,
    exerciseFavorites,
    templates,
    onboarding,
  ]) {
    if (result.error) throw result.error;
  }

  let overrideRows: Record<string, unknown>[] = [];
  if (nutritionOverrides.error) {
    const message = nutritionOverrides.error.message?.toLowerCase() ?? '';
    const missingTable =
      nutritionOverrides.error.code === '42P01' ||
      nutritionOverrides.error.code === 'PGRST205' ||
      message.includes('does not exist') ||
      message.includes('schema cache');
    if (!missingTable) throw nutritionOverrides.error;
  } else {
    overrideRows = (nutritionOverrides.data ?? []) as Record<string, unknown>[];
  }

  const workoutIds = (workouts.data ?? []).map((w) => w.id as string).filter(Boolean);
  const templateIds = (templates.data ?? []).map((t) => t.id as string).filter(Boolean);

  let workoutExercises: Record<string, unknown>[] = [];
  let workoutSets: Record<string, unknown>[] = [];
  let templateVariations: Record<string, unknown>[] = [];
  let templateExercises: Record<string, unknown>[] = [];

  if (workoutIds.length > 0) {
    const we = await supabase.from('workout_exercises').select('*').in('workout_id', workoutIds);
    if (we.error) throw we.error;
    workoutExercises = (we.data ?? []) as Record<string, unknown>[];

    const weIds = workoutExercises.map((row) => row.id as string).filter(Boolean);
    if (weIds.length > 0) {
      const ws = await supabase.from('workout_sets').select('*').in('workout_exercise_id', weIds);
      if (ws.error) throw ws.error;
      workoutSets = (ws.data ?? []) as Record<string, unknown>[];
    }
  }

  if (templateIds.length > 0) {
    const tv = await supabase
      .from('workout_template_variations')
      .select('*')
      .in('template_id', templateIds);
    if (tv.error) throw tv.error;
    templateVariations = (tv.data ?? []) as Record<string, unknown>[];

    const te = await supabase
      .from('workout_template_exercises')
      .select('*')
      .in('template_id', templateIds);
    if (te.error) throw te.error;
    templateExercises = (te.data ?? []) as Record<string, unknown>[];
  }

  // Strip anything that could look like a secret if a future column appears.
  const safeProfile = profile.data
    ? (() => {
        const copy = { ...(profile.data as Record<string, unknown>) };
        delete copy.access_token;
        delete copy.refresh_token;
        delete copy.password;
        return copy;
      })()
    : null;

  return {
    format: TRACKWISE_BACKUP_FORMAT,
    version: TRACKWISE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion(),
    data: {
      profile: safeProfile,
      goals: (goals.data ?? []) as Record<string, unknown>[],
      body_measurements: (measurements.data ?? []) as Record<string, unknown>[],
      food_entries: (foodEntries.data ?? []) as Record<string, unknown>[],
      foods: (foods.data ?? []) as Record<string, unknown>[],
      food_favorites: (foodFavorites.data ?? []) as Record<string, unknown>[],
      workouts: (workouts.data ?? []) as Record<string, unknown>[],
      workout_exercises: workoutExercises,
      workout_sets: workoutSets,
      workout_templates: (templates.data ?? []) as Record<string, unknown>[],
      workout_template_variations: templateVariations,
      workout_template_exercises: templateExercises,
      custom_exercises: (customExercises.data ?? []) as Record<string, unknown>[],
      exercise_favorites: (exerciseFavorites.data ?? []) as Record<string, unknown>[],
      onboarding_progress: (onboarding.data as Record<string, unknown> | null) ?? null,
      daily_nutrition_overrides: overrideRows,
    },
  };
}

/** Wipe all Trackwise data for the signed-in user; keep Auth session. Uses auth.uid() server-side. */
export async function wipeOwnUserData(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.rpc('wipe_own_user_data');
  if (error) {
    throw new Error(error.message || i18n.t('errors.deleteAccountData'));
  }
}

/** Prefer the Edge Function JSON `{ error }` body over the generic FunctionsHttpError text. */
async function edgeFunctionErrorMessage(
  error: { message?: string; context?: Response } | null,
  data: unknown,
  fallback: string,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return String(data.error);
  }

  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try {
      const body = (await response.clone().json()) as { error?: unknown };
      if (body?.error) return String(body.error);
    } catch {
      // ignore non-JSON bodies
    }
  }

  return error?.message || fallback;
}

/** Calls the delete-account Edge Function with the user JWT. */
export async function deleteOwnAccount(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    throw new Error(
      await edgeFunctionErrorMessage(error, data, i18n.t('errors.deleteAccount')),
    );
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
}
