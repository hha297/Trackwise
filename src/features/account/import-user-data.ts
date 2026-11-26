import { getSupabase } from '@/lib/supabase/client';

import type { TrackwiseBackup, TrackwiseBackupData } from './backup';
import { wipeOwnUserData } from './api';

export type ImportMode = 'merge' | 'replace';

export type ImportUserDataResult = {
  mode: ImportMode;
  inserted: Record<string, number>;
  skipped: Record<string, number>;
};

type IdMap = Map<string, string>;

function asRecord(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  return row as Record<string, unknown>;
}

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stripOwnership(row: Record<string, unknown>, userId: string): Record<string, unknown> {
  const next = { ...row };
  if ('user_id' in next) next.user_id = userId;
  if ('id' in next && next.id === userId) {
    // profile primary key is auth user id — never import a foreign profile id as PK
  }
  // Never import secrets / tokens if a stale export included them.
  delete next.access_token;
  delete next.refresh_token;
  delete next.token;
  delete next.password;
  delete next.service_role_key;
  return next;
}

function remapId(field: string, row: Record<string, unknown>, map: IdMap): void {
  const current = asId(row[field]);
  if (!current) return;
  if (map.has(current)) {
    row[field] = map.get(current);
  }
}

async function existingIds(
  table: string,
  ids: string[],
  column = 'id',
): Promise<Set<string>> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return new Set();

  const found = new Set<string>();
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).select(column).in(column, chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const record = row as unknown as Record<string, unknown>;
      const id = asId(record[column]);
      if (id) found.add(id);
    }
  }
  return found;
}

async function insertRows(
  table: string,
  rows: Record<string, unknown>[],
  counters: { inserted: number; skipped: number },
  mode: ImportMode,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (mode === 'merge') {
      const { error } = await supabase.from(table).upsert(chunk, {
        onConflict: 'id',
        ignoreDuplicates: true,
      });
      if (error) {
        // Fallback: try one-by-one so one conflict does not fail the batch.
        for (const row of chunk) {
          const { error: oneError } = await supabase.from(table).insert(row);
          if (oneError) {
            const msg = oneError.message?.toLowerCase() ?? '';
            if (msg.includes('duplicate') || oneError.code === '23505') {
              counters.skipped += 1;
              continue;
            }
            throw oneError;
          }
          counters.inserted += 1;
        }
      } else {
        counters.inserted += chunk.length;
      }
    } else {
      const { error } = await supabase.from(table).insert(chunk);
      if (error) throw error;
      counters.inserted += chunk.length;
    }
  }
}

async function insertCompositeFavorites(
  table: 'food_favorites' | 'exercise_favorites',
  rows: Record<string, unknown>[],
  counters: { inserted: number; skipped: number },
  mode: ImportMode,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  for (const row of rows) {
    const { error } = await supabase.from(table).insert(row);
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (mode === 'merge' && (msg.includes('duplicate') || error.code === '23505')) {
        counters.skipped += 1;
        continue;
      }
      throw error;
    }
    counters.inserted += 1;
  }
}

function prepareOwnedRows(
  rows: Record<string, unknown>[],
  userId: string,
  idMap: IdMap,
): Record<string, unknown>[] {
  const prepared: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = stripOwnership(raw, userId);
    const oldId = asId(row.id);
    if (oldId) {
      idMap.set(oldId, oldId);
    }
    prepared.push(row);
  }
  return prepared;
}

/**
 * Import a validated Trackwise backup for the signed-in user.
 * Ownership is always remapped to `userId`. Backup user ids are ignored.
 * Replace wipes via RPC first; merge skips conflicting primary keys.
 */
export async function importUserData(
  userId: string,
  backup: TrackwiseBackup,
  mode: ImportMode,
): Promise<ImportUserDataResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  if (mode === 'replace') {
    await wipeOwnUserData();
  }

  const data: TrackwiseBackupData = backup.data;
  const inserted: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const bump = (key: string, kind: 'inserted' | 'skipped', n: number) => {
    const bag = kind === 'inserted' ? inserted : skipped;
    bag[key] = (bag[key] ?? 0) + n;
  };

  const foodIdMap: IdMap = new Map();
  const exerciseIdMap: IdMap = new Map();
  const templateIdMap: IdMap = new Map();
  const variationIdMap: IdMap = new Map();
  const workoutIdMap: IdMap = new Map();
  const workoutExerciseIdMap: IdMap = new Map();

  // --- profile (partial update; never change id / units wipe intent for replace already done) ---
  if (data.profile) {
    const profile = stripOwnership(data.profile, userId);
    const patch: Record<string, unknown> = {
      display_name: profile.display_name ?? null,
      height_cm: profile.height_cm ?? null,
      sex: profile.sex ?? null,
      birth_date: profile.birth_date ?? null,
      activity_level: profile.activity_level ?? null,
      avatar_url: profile.avatar_url ?? null,
      onboarding_completed_at: profile.onboarding_completed_at ?? null,
    };
    if (typeof profile.units === 'string') patch.units = profile.units;
    if (profile.preferences && typeof profile.preferences === 'object') {
      patch.preferences = profile.preferences;
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) throw error;
    bump('profile', 'inserted', 1);
  }

  // --- custom foods ---
  {
    const foods = prepareOwnedRows(
      data.foods.map(asRecord).filter((r): r is Record<string, unknown> => Boolean(r)),
      userId,
      foodIdMap,
    ).map((row) => {
      row.is_public = false;
      if (row.source === 'system') row.source = 'manual';
      return row;
    });

    if (mode === 'merge') {
      const ids = foods.map((f) => asId(f.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('foods', ids);
      const toInsert = foods.filter((f) => {
        const id = asId(f.id);
        if (id && existing.has(id)) {
          foodIdMap.set(id, id);
          bump('foods', 'skipped', 1);
          return false;
        }
        return true;
      });
      const counters = { inserted: 0, skipped: 0 };
      await insertRows('foods', toInsert, counters, mode);
      bump('foods', 'inserted', counters.inserted);
      bump('foods', 'skipped', counters.skipped);
    } else {
      const counters = { inserted: 0, skipped: 0 };
      await insertRows('foods', foods, counters, mode);
      bump('foods', 'inserted', counters.inserted);
    }
  }

  // --- custom exercises ---
  {
    const exercises = prepareOwnedRows(
      data.custom_exercises
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r)),
      userId,
      exerciseIdMap,
    ).map((row) => {
      row.is_system = false;
      row.user_id = userId;
      return row;
    });

    if (mode === 'merge') {
      const ids = exercises.map((e) => asId(e.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('exercises', ids);
      const toInsert = exercises.filter((e) => {
        const id = asId(e.id);
        if (id && existing.has(id)) {
          exerciseIdMap.set(id, id);
          bump('custom_exercises', 'skipped', 1);
          return false;
        }
        return true;
      });
      const counters = { inserted: 0, skipped: 0 };
      await insertRows('exercises', toInsert, counters, mode);
      bump('custom_exercises', 'inserted', counters.inserted);
    } else {
      const counters = { inserted: 0, skipped: 0 };
      await insertRows('exercises', exercises, counters, mode);
      bump('custom_exercises', 'inserted', counters.inserted);
    }
  }

  // --- goals ---
  {
    const goals = data.goals
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => stripOwnership(row, userId));
    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = goals.map((g) => asId(g.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('goals', ids);
      const toInsert = goals.filter((g) => {
        const id = asId(g.id);
        if (id && existing.has(id)) {
          bump('goals', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('goals', toInsert, counters, mode);
    } else {
      await insertRows('goals', goals, counters, mode);
    }
    bump('goals', 'inserted', counters.inserted);
  }

  // --- body measurements ---
  {
    const rows = data.body_measurements
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => stripOwnership(row, userId));
    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      // Unique (user_id, measured_on): skip days that already exist for this user.
      const { data: existingDays, error } = await supabase
        .from('body_measurements')
        .select('measured_on')
        .eq('user_id', userId);
      if (error) throw error;
      const daySet = new Set((existingDays ?? []).map((d) => String(d.measured_on)));
      const toInsert: Record<string, unknown>[] = [];
      for (const row of rows) {
        const day = row.measured_on != null ? String(row.measured_on) : null;
        const id = asId(row.id);
        if (day && daySet.has(day)) {
          bump('body_measurements', 'skipped', 1);
          continue;
        }
        if (id) {
          // Also skip if id already owned
        }
        toInsert.push(row);
      }
      await insertRows('body_measurements', toInsert, counters, mode);
    } else {
      await insertRows('body_measurements', rows, counters, mode);
    }
    bump('body_measurements', 'inserted', counters.inserted);
  }

  // --- food entries ---
  {
    const rows = data.food_entries
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        remapId('food_id', next, foodIdMap);
        // Drop client_request_id conflicts on merge by regenerating when present.
        if (mode === 'merge' && typeof next.client_request_id === 'string') {
          next.client_request_id = `import-${next.client_request_id}`;
        }
        return next;
      });
    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = rows.map((r) => asId(r.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('food_entries', ids);
      const toInsert = rows.filter((r) => {
        const id = asId(r.id);
        if (id && existing.has(id)) {
          bump('food_entries', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('food_entries', toInsert, counters, mode);
    } else {
      await insertRows('food_entries', rows, counters, mode);
    }
    bump('food_entries', 'inserted', counters.inserted);
  }

  // --- food favorites ---
  {
    const rows = data.food_favorites
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        remapId('food_id', next, foodIdMap);
        return { user_id: userId, food_id: next.food_id, created_at: next.created_at };
      })
      .filter((row) => typeof row.food_id === 'string');
    const counters = { inserted: 0, skipped: 0 };
    await insertCompositeFavorites('food_favorites', rows, counters, mode);
    bump('food_favorites', 'inserted', counters.inserted);
    bump('food_favorites', 'skipped', counters.skipped);
  }

  // --- workout templates (user) ---
  {
    const templates = data.workout_templates
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        next.is_system = false;
        next.user_id = userId;
        const id = asId(next.id);
        if (id) templateIdMap.set(id, id);
        return next;
      });

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = templates.map((t) => asId(t.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workout_templates', ids);
      const toInsert = templates.filter((t) => {
        const id = asId(t.id);
        if (id && existing.has(id)) {
          bump('workout_templates', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workout_templates', toInsert, counters, mode);
    } else {
      await insertRows('workout_templates', templates, counters, mode);
    }
    bump('workout_templates', 'inserted', counters.inserted);
  }

  // --- template variations ---
  {
    const variations = data.workout_template_variations
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = { ...row };
        remapId('template_id', next, templateIdMap);
        const id = asId(next.id);
        if (id) variationIdMap.set(id, id);
        delete next.user_id;
        return next;
      })
      .filter((row) => typeof row.template_id === 'string' && templateIdMap.has(String(row.template_id)));

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = variations.map((v) => asId(v.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workout_template_variations', ids);
      const toInsert = variations.filter((v) => {
        const id = asId(v.id);
        if (id && existing.has(id)) {
          bump('workout_template_variations', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workout_template_variations', toInsert, counters, mode);
    } else {
      await insertRows('workout_template_variations', variations, counters, mode);
    }
    bump('workout_template_variations', 'inserted', counters.inserted);
  }

  // --- template exercises ---
  {
    const rows = data.workout_template_exercises
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = { ...row };
        remapId('template_id', next, templateIdMap);
        remapId('variation_id', next, variationIdMap);
        remapId('exercise_id', next, exerciseIdMap);
        delete next.user_id;
        return next;
      })
      .filter((row) => typeof row.template_id === 'string' && templateIdMap.has(String(row.template_id)));

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = rows.map((r) => asId(r.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workout_template_exercises', ids);
      const toInsert = rows.filter((r) => {
        const id = asId(r.id);
        if (id && existing.has(id)) {
          bump('workout_template_exercises', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workout_template_exercises', toInsert, counters, mode);
    } else {
      await insertRows('workout_template_exercises', rows, counters, mode);
    }
    bump('workout_template_exercises', 'inserted', counters.inserted);
  }

  // --- workouts ---
  {
    const workouts = data.workouts
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        const source = asId(next.source_template_id);
        if (source && !templateIdMap.has(source)) {
          // May be a system template id — keep as-is; FK allows system templates.
        }
        const id = asId(next.id);
        if (id) workoutIdMap.set(id, id);
        return next;
      });

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = workouts.map((w) => asId(w.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workouts', ids);
      const toInsert = workouts.filter((w) => {
        const id = asId(w.id);
        if (id && existing.has(id)) {
          bump('workouts', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workouts', toInsert, counters, mode);
    } else {
      await insertRows('workouts', workouts, counters, mode);
    }
    bump('workouts', 'inserted', counters.inserted);
  }

  // --- workout exercises ---
  {
    const rows = data.workout_exercises
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = { ...row };
        remapId('workout_id', next, workoutIdMap);
        remapId('exercise_id', next, exerciseIdMap);
        const id = asId(next.id);
        if (id) workoutExerciseIdMap.set(id, id);
        delete next.user_id;
        return next;
      })
      .filter((row) => typeof row.workout_id === 'string' && workoutIdMap.has(String(row.workout_id)));

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = rows.map((r) => asId(r.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workout_exercises', ids);
      const toInsert = rows.filter((r) => {
        const id = asId(r.id);
        if (id && existing.has(id)) {
          bump('workout_exercises', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workout_exercises', toInsert, counters, mode);
    } else {
      await insertRows('workout_exercises', rows, counters, mode);
    }
    bump('workout_exercises', 'inserted', counters.inserted);
  }

  // --- workout sets ---
  {
    const rows = data.workout_sets
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = { ...row };
        remapId('workout_exercise_id', next, workoutExerciseIdMap);
        delete next.user_id;
        return next;
      })
      .filter(
        (row) =>
          typeof row.workout_exercise_id === 'string' &&
          workoutExerciseIdMap.has(String(row.workout_exercise_id)),
      );

    const counters = { inserted: 0, skipped: 0 };
    if (mode === 'merge') {
      const ids = rows.map((r) => asId(r.id)).filter((id): id is string => Boolean(id));
      const existing = await existingIds('workout_sets', ids);
      const toInsert = rows.filter((r) => {
        const id = asId(r.id);
        if (id && existing.has(id)) {
          bump('workout_sets', 'skipped', 1);
          return false;
        }
        return true;
      });
      await insertRows('workout_sets', toInsert, counters, mode);
    } else {
      await insertRows('workout_sets', rows, counters, mode);
    }
    bump('workout_sets', 'inserted', counters.inserted);
  }

  // --- exercise favorites ---
  {
    const rows = data.exercise_favorites
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        remapId('exercise_id', next, exerciseIdMap);
        return {
          user_id: userId,
          exercise_id: next.exercise_id,
          created_at: next.created_at,
        };
      })
      .filter((row) => typeof row.exercise_id === 'string');
    const counters = { inserted: 0, skipped: 0 };
    await insertCompositeFavorites('exercise_favorites', rows, counters, mode);
    bump('exercise_favorites', 'inserted', counters.inserted);
    bump('exercise_favorites', 'skipped', counters.skipped);
  }

  // --- daily nutrition overrides (same-day calorie adjustments; not goals) ---
  {
    const rows = (data.daily_nutrition_overrides ?? [])
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((row) => {
        const next = stripOwnership(row, userId);
        return {
          user_id: userId,
          override_date: next.override_date,
          calories: next.calories,
          created_at: next.created_at,
          updated_at: next.updated_at,
        };
      })
      .filter(
        (row) =>
          typeof row.override_date === 'string' &&
          typeof row.calories === 'number' &&
          Number.isInteger(row.calories),
      );
    const counters = { inserted: 0, skipped: 0 };
    const client = getSupabase();
    if (client && rows.length > 0) {
      for (const row of rows) {
        const { error } = await client.from('daily_nutrition_overrides').upsert(row, {
          onConflict: 'user_id,override_date',
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? '';
          if (mode === 'merge' && (msg.includes('duplicate') || error.code === '23505')) {
            counters.skipped += 1;
            continue;
          }
          throw error;
        }
        counters.inserted += 1;
      }
    }
    bump('daily_nutrition_overrides', 'inserted', counters.inserted);
    bump('daily_nutrition_overrides', 'skipped', counters.skipped);
  }

  // --- onboarding progress ---
  if (data.onboarding_progress) {
    const row = stripOwnership(data.onboarding_progress, userId);
    row.user_id = userId;
    const { error } = await supabase.from('onboarding_progress').upsert(row, {
      onConflict: 'user_id',
    });
    if (error) throw error;
    bump('onboarding_progress', 'inserted', 1);
  }

  return { mode, inserted, skipped };
}
