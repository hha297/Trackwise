import i18n from '@/i18n';
import { expandLibraryPaths } from '@/features/workout/catalog/library-path-aliases';
import { dedupeMuscleList } from '@/features/workout/exercise-display';
import { getSupabase } from '@/lib/supabase/client';

import type {
  Exercise,
  ExerciseDifficulty,
  ExerciseType,
  WorkoutDetail,
  WorkoutListItem,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutTemplateVariation,
} from './types';
import { TEMPLATE_TRAINING_LEVELS } from './types';

const EXERCISE_SELECT =
  'id, name, category, primary_muscles, secondary_muscles, equipment, exercise_type, movement_pattern, instructions, description, tips, common_mistakes, safety_notes, difficulty, image_key, image_storage_path, image_url, slug, content_version, library_paths, met_value, is_system, user_id';

function normalizeExerciseFields(exercise: Exercise): Exercise {
  const primary = dedupeMuscleList(exercise.primary_muscles);
  const secondary = dedupeMuscleList(exercise.secondary_muscles).filter(
    (m) => !primary.includes(m),
  );
  return {
    ...exercise,
    primary_muscles: primary,
    secondary_muscles: secondary,
    library_paths: [...new Set(exercise.library_paths ?? [])],
  };
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** Exercise catalog is API-only — no bundled local seed merge. */
export async function fetchExercises(input: {
  search?: string;
  category?: string | null;
  exerciseType?: ExerciseType | null;
  muscle?: string | null;
  libraryPath?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  limit?: number;
}): Promise<Exercise[]> {
  const supabase = requireSupabase();

  let query = supabase
    .from('exercises')
    .select(EXERCISE_SELECT)
    .order('name')
    .limit(input.limit ?? 500);
  if (input.search?.trim()) {
    query = query.ilike('name', `%${input.search.trim()}%`);
  }
  if (input.category) {
    query = query.eq('category', input.category);
  }
  if (input.exerciseType) {
    query = query.eq('exercise_type', input.exerciseType);
  }
  if (input.muscle) {
    query = query.contains('primary_muscles', [input.muscle]);
  }
  const libraryPathAliases = expandLibraryPaths(input.libraryPath);
  if (libraryPathAliases.length === 1) {
    query = query.contains('library_paths', [libraryPathAliases[0]!]);
  } else if (libraryPathAliases.length > 1) {
    query = query.or(
      libraryPathAliases.map((path) => `library_paths.cs.{"${path}"}`).join(','),
    );
  }
  if (input.equipment) {
    query = query.eq('equipment', input.equipment);
  }
  if (input.difficulty) {
    query = query.eq('difficulty', input.difficulty);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Exercise[]).map(normalizeExerciseFields);
}

export async function fetchExerciseById(id: string): Promise<Exercise | null> {
  if (!id || id.startsWith('local:')) return null;
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeExerciseFields(data as Exercise) : null;
}

export async function createCustomExercise(input: {
  userId: string;
  name: string;
  category: string;
  exerciseType: ExerciseType;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string | null;
  description?: string | null;
  instructions?: string | null;
  metValue?: number | null;
  imageUrl?: string | null;
}): Promise<Exercise> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      category: input.category,
      exercise_type: input.exerciseType,
      primary_muscles: input.primaryMuscles ?? [],
      secondary_muscles: input.secondaryMuscles ?? [],
      equipment: input.equipment ?? null,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      met_value: input.metValue ?? null,
      image_url: input.imageUrl ?? null,
      is_system: false,
    })
    .select(EXERCISE_SELECT)
    .single();
  if (error) throw error;
  return data as Exercise;
}

export async function updateCustomExercise(input: {
  id: string;
  userId: string;
  patch: Partial<{
    name: string;
    category: string;
    exercise_type: ExerciseType;
    primary_muscles: string[];
    secondary_muscles: string[];
    equipment: string | null;
    description: string | null;
    instructions: string | null;
    met_value: number | null;
  }>;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('exercises')
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('user_id', input.userId)
    .eq('is_system', false);
  if (error) throw error;
}

export async function deleteCustomExercise(id: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_system', false);
  if (error) throw error;
}

export async function fetchFavoriteExerciseIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('exercise_favorites')
    .select('exercise_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.exercise_id as string);
}

export async function toggleExerciseFavorite(input: {
  userId: string;
  exerciseId: string;
  favorite: boolean;
}): Promise<void> {
  if (!input.exerciseId || input.exerciseId.startsWith('local:')) {
    throw new Error('Favorites require a server exercise id.');
  }
  const supabase = requireSupabase();
  if (input.favorite) {
    const { error } = await supabase.from('exercise_favorites').upsert({
      user_id: input.userId,
      exercise_id: input.exerciseId,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('exercise_favorites')
    .delete()
    .eq('user_id', input.userId)
    .eq('exercise_id', input.exerciseId);
  if (error) throw error;
}

const TEMPLATE_SELECT_FULL =
  'id, name, category, description, is_system, user_id, image_key, difficulty, goal, estimated_minutes, equipment_summary, target_muscles';
const TEMPLATE_SELECT_META =
  'id, name, category, description, is_system, user_id, image_key, difficulty, goal, estimated_minutes, equipment_summary';
const TEMPLATE_SELECT_MID = 'id, name, category, description, is_system, user_id, image_key';
const TEMPLATE_SELECT_LEGACY = 'id, name, category, description, is_system, user_id';

export async function fetchWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  for (const columns of [
    TEMPLATE_SELECT_FULL,
    TEMPLATE_SELECT_META,
    TEMPLATE_SELECT_MID,
    TEMPLATE_SELECT_LEGACY,
  ]) {
    const result = await supabase
      .from('workout_templates')
      .select(columns)
      .order('is_system', { ascending: false })
      .order('name');
    if (!result.error) return (result.data ?? []) as unknown as WorkoutTemplate[];
  }
  throw new Error(i18n.t('errors.loadTemplates'));
}

export type WorkoutTemplateExerciseInput = {
  exerciseId: string | null;
  exerciseName: string;
  exerciseType: ExerciseType;
  plannedSets?: number | null;
  plannedReps?: number | null;
  plannedRestSec?: number | null;
  notes?: string | null;
};

export type WorkoutTemplateVariationInput = {
  trainingLevel: ExerciseDifficulty;
  description?: string | null;
  estimatedMinutes?: number | null;
  exercises: WorkoutTemplateExerciseInput[];
};

export type WorkoutTemplateWriteInput = {
  userId: string;
  name: string;
  category: string;
  description?: string | null;
  /** Recommended / default level for cards (usually first configured variation). */
  difficulty?: string | null;
  goal?: string | null;
  estimatedMinutes?: number | null;
  equipmentSummary?: string | null;
  targetMuscles?: string[] | null;
  /** Independent level variations. Prefer this over legacy `exercises`. */
  variations?: WorkoutTemplateVariationInput[];
  /** @deprecated Prefer `variations`. Kept for older callers. */
  exercises?: WorkoutTemplateExerciseInput[];
};

type JoinedExerciseRow = WorkoutTemplateExercise & {
  exercise?: {
    image_storage_path?: string | null;
    image_url?: string | null;
    image_key?: string | null;
    slug?: string | null;
    primary_muscles?: string[] | null;
    secondary_muscles?: string[] | null;
    equipment?: string | null;
  } | null;
};

function mapJoinedExercise(row: JoinedExerciseRow): WorkoutTemplateExercise {
  const joined = row.exercise;
  const { exercise: _exercise, ...rest } = row;
  return {
    ...rest,
    image_storage_path: joined?.image_storage_path ?? null,
    image_url: joined?.image_url ?? null,
    image_key: joined?.image_key ?? null,
    slug: joined?.slug ?? null,
    primary_muscles: joined?.primary_muscles ?? null,
    secondary_muscles: joined?.secondary_muscles ?? null,
    equipment: joined?.equipment ?? null,
  };
}

const EXERCISE_SELECT_RICH = `id, template_id, variation_id, exercise_id, position, exercise_name, exercise_type, planned_sets, planned_reps, planned_weight_kg, planned_rest_sec, notes,
       exercise:exercises ( image_storage_path, image_url, image_key, slug, primary_muscles, secondary_muscles, equipment )`;
const EXERCISE_SELECT_BASIC = `id, template_id, variation_id, exercise_id, position, exercise_name, exercise_type, planned_sets, planned_reps, planned_weight_kg, notes,
       exercise:exercises ( image_storage_path, image_url, image_key, slug, primary_muscles, secondary_muscles, equipment )`;
const EXERCISE_SELECT_LEGACY = `id, template_id, exercise_id, position, exercise_name, exercise_type, planned_sets, planned_reps, planned_weight_kg, notes,
       exercise:exercises ( image_storage_path, image_url, image_key, slug, primary_muscles, secondary_muscles, equipment )`;

async function queryTemplateExercises(filter: {
  templateId?: string;
  variationId?: string;
}): Promise<WorkoutTemplateExercise[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  for (const columns of [EXERCISE_SELECT_RICH, EXERCISE_SELECT_BASIC, EXERCISE_SELECT_LEGACY]) {
    let query = supabase.from('workout_template_exercises').select(columns).order('position');
    if (filter.variationId) query = query.eq('variation_id', filter.variationId);
    if (filter.templateId) query = query.eq('template_id', filter.templateId);
    const result = await query;
    if (!result.error) {
      return ((result.data ?? []) as unknown as JoinedExerciseRow[]).map(mapJoinedExercise);
    }
  }
  throw new Error(i18n.t('errors.loadTemplateExercises'));
}

export async function fetchTemplateVariations(
  templateId: string,
): Promise<WorkoutTemplateVariation[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('workout_template_variations')
    .select('id, template_id, training_level, description, estimated_minutes')
    .eq('template_id', templateId)
    .order('training_level');

  if (error) {
    // Pre-variation DBs: synthesize a single level from legacy template exercises.
    const legacy = await queryTemplateExercises({ templateId });
    if (!legacy.length) return [];
    return [
      {
        id: `legacy:${templateId}`,
        template_id: templateId,
        training_level: 'intermediate',
        description: null,
        estimated_minutes: null,
        exercises: legacy,
        exercise_count: legacy.length,
        total_sets: legacy.reduce((sum, row) => sum + (row.planned_sets ?? 0), 0),
      },
    ];
  }

  const variations = (data ?? []) as WorkoutTemplateVariation[];
  const withExercises = await Promise.all(
    variations.map(async (variation) => {
      const exercises = await queryTemplateExercises({ variationId: variation.id });
      return {
        ...variation,
        exercises,
        exercise_count: exercises.length,
        total_sets: exercises.reduce((sum, row) => sum + (row.planned_sets ?? 0), 0),
      };
    }),
  );

  // If variations table exists but is empty, fall back to legacy template-scoped rows.
  if (!withExercises.length) {
    const legacy = await queryTemplateExercises({ templateId });
    if (!legacy.length) return [];
    return [
      {
        id: `legacy:${templateId}`,
        template_id: templateId,
        training_level: 'intermediate',
        description: null,
        estimated_minutes: null,
        exercises: legacy,
        exercise_count: legacy.length,
        total_sets: legacy.reduce((sum, row) => sum + (row.planned_sets ?? 0), 0),
      },
    ];
  }

  // Beginner → Intermediate → Advanced (not alphabetical).
  const levelRank = new Map(
    TEMPLATE_TRAINING_LEVELS.map((level, index) => [level, index]),
  );
  return withExercises.sort(
    (a, b) =>
      (levelRank.get(a.training_level) ?? 99) - (levelRank.get(b.training_level) ?? 99),
  );
}

/** @deprecated Prefer fetchTemplateVariations — returns first/only variation exercises. */
export async function fetchTemplateExercises(
  templateId: string,
): Promise<WorkoutTemplateExercise[]> {
  const variations = await fetchTemplateVariations(templateId);
  return variations[0]?.exercises ?? [];
}

function templateMetaPayload(input: WorkoutTemplateWriteInput) {
  const variations = normalizeWriteVariations(input);
  const primary = variations[0] ?? null;
  return {
    name: input.name.trim(),
    category: input.category,
    description: input.description ?? null,
    difficulty: input.difficulty ?? primary?.trainingLevel ?? null,
    goal: input.goal ?? null,
    estimated_minutes: input.estimatedMinutes ?? primary?.estimatedMinutes ?? null,
    equipment_summary: input.equipmentSummary ?? null,
    target_muscles: input.targetMuscles ?? [],
  };
}

function normalizeWriteVariations(
  input: WorkoutTemplateWriteInput,
): WorkoutTemplateVariationInput[] {
  if (input.variations?.length) {
    return input.variations.filter((item) => item.exercises.length > 0);
  }
  if (input.exercises?.length) {
    return [
      {
        trainingLevel: (input.difficulty as ExerciseDifficulty) || 'intermediate',
        description: input.description ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        exercises: input.exercises,
      },
    ];
  }
  return [];
}

async function replaceTemplateVariations(
  templateId: string,
  variations: WorkoutTemplateVariationInput[],
) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  // Wipe previous exercises + variations for this template, then rewrite.
  const { error: deleteExercisesError } = await supabase
    .from('workout_template_exercises')
    .delete()
    .eq('template_id', templateId);
  if (deleteExercisesError) throw deleteExercisesError;

  const { error: deleteVariationsError } = await supabase
    .from('workout_template_variations')
    .delete()
    .eq('template_id', templateId);
  // Older DBs without variations table: fall back to template-scoped exercise insert.
  if (deleteVariationsError) {
    const flat = variations.flatMap((item) => item.exercises);
    if (!flat.length) return;
    const rows = flat.map((exercise, index) => ({
      template_id: templateId,
      exercise_id: exercise.exerciseId,
      position: index,
      exercise_name: exercise.exerciseName,
      exercise_type: exercise.exerciseType,
      planned_sets: exercise.plannedSets ?? null,
      planned_reps: exercise.plannedReps ?? null,
      planned_rest_sec: exercise.plannedRestSec ?? null,
      notes: exercise.notes ?? null,
    }));
    const withRest = await supabase.from('workout_template_exercises').insert(rows);
    if (!withRest.error) return;
    const stripped = rows.map(({ planned_rest_sec: _rest, ...rest }) => rest);
    const { error } = await supabase.from('workout_template_exercises').insert(stripped);
    if (error) throw error;
    return;
  }

  for (const variation of variations) {
    const { data: created, error: variationError } = await supabase
      .from('workout_template_variations')
      .insert({
        template_id: templateId,
        training_level: variation.trainingLevel,
        description: variation.description ?? null,
        estimated_minutes: variation.estimatedMinutes ?? null,
      })
      .select('id')
      .single();
    if (variationError) throw variationError;

    const rows = variation.exercises.map((exercise, index) => ({
      template_id: templateId,
      variation_id: created.id,
      exercise_id: exercise.exerciseId,
      position: index,
      exercise_name: exercise.exerciseName,
      exercise_type: exercise.exerciseType,
      planned_sets: exercise.plannedSets ?? null,
      planned_reps: exercise.plannedReps ?? null,
      planned_rest_sec: exercise.plannedRestSec ?? null,
      notes: exercise.notes ?? null,
    }));
    if (!rows.length) continue;
    const withRest = await supabase.from('workout_template_exercises').insert(rows);
    if (!withRest.error) continue;
    const stripped = rows.map(({ planned_rest_sec: _rest, ...rest }) => rest);
    const { error } = await supabase.from('workout_template_exercises').insert(stripped);
    if (error) throw error;
  }
}

export async function createWorkoutTemplate(input: WorkoutTemplateWriteInput): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const meta = templateMetaPayload(input);
  const variations = normalizeWriteVariations(input);
  if (!variations.length) {
    throw new Error('Add at least one exercise to a training level.');
  }

  let template: { id: string } | null = null;
  const full = await supabase
    .from('workout_templates')
    .insert({
      user_id: input.userId,
      is_system: false,
      ...meta,
    })
    .select('id')
    .single();

  if (!full.error && full.data) {
    template = full.data;
  } else {
    const { target_muscles: _muscles, ...withoutMuscles } = meta;
    const fallback = await supabase
      .from('workout_templates')
      .insert({
        user_id: input.userId,
        is_system: false,
        ...withoutMuscles,
      })
      .select('id')
      .single();
    if (fallback.error) throw fallback.error;
    template = fallback.data;
  }

  await replaceTemplateVariations(template.id, variations);
  return template.id as string;
}

export async function updateWorkoutTemplate(
  id: string,
  input: WorkoutTemplateWriteInput,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const meta = templateMetaPayload(input);
  const variations = normalizeWriteVariations(input);
  if (!variations.length) {
    throw new Error('Add at least one exercise to a training level.');
  }

  const full = await supabase
    .from('workout_templates')
    .update(meta)
    .eq('id', id)
    .eq('user_id', input.userId)
    .eq('is_system', false);
  if (full.error) {
    const { target_muscles: _muscles, ...withoutMuscles } = meta;
    const { error } = await supabase
      .from('workout_templates')
      .update(withoutMuscles)
      .eq('id', id)
      .eq('user_id', input.userId)
      .eq('is_system', false);
    if (error) throw error;
  }

  await replaceTemplateVariations(id, variations);
}

export async function deleteWorkoutTemplate(id: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_system', false);
  if (error) throw error;
}

export async function fetchWorkouts(userId: string, limit = 40): Promise<WorkoutListItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, started_at, ended_at, estimated_calories, status, active_duration_sec')
    .eq('user_id', userId)
    .neq('status', 'discarded')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WorkoutListItem[];
}

export async function fetchWorkoutDetail(id: string, userId: string): Promise<WorkoutDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: workout, error } = await supabase
    .from('workouts')
    .select(
      'id, name, started_at, ended_at, estimated_calories, status, active_duration_sec, notes, source_template_id, calorie_calc_version, calorie_body_weight_kg',
    )
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!workout) return null;

  type DetailExerciseRow = {
    id: string;
    exercise_id: string | null;
    position: number;
    exercise_name: string;
    exercise_type: ExerciseType;
    notes: string | null;
    estimated_calories?: number | null;
    estimate_method?: string | null;
    estimate_calc_version?: number | null;
    estimate_duration_sec?: number | null;
    estimate_activity_key?: string | null;
    estimate_body_weight_kg?: number | null;
    exercise?: {
      image_storage_path?: string | null;
      image_url?: string | null;
      image_key?: string | null;
      slug?: string | null;
    } | null;
  };

  const detailSelectWithImages =
    'id, exercise_id, position, exercise_name, exercise_type, notes, estimated_calories, estimate_method, estimate_calc_version, estimate_duration_sec, estimate_activity_key, estimate_body_weight_kg, exercise:exercises ( image_storage_path, image_url, image_key, slug )';
  const detailSelectBasic =
    'id, exercise_id, position, exercise_name, exercise_type, notes, estimated_calories, estimate_method, estimate_calc_version, estimate_duration_sec, estimate_activity_key, estimate_body_weight_kg';

  let exercises: DetailExerciseRow[] | null = null;
  let exercisesError: { message: string } | null = null;
  {
    const rich = await supabase
      .from('workout_exercises')
      .select(detailSelectWithImages)
      .eq('workout_id', id)
      .order('position');
    if (!rich.error) {
      exercises = (rich.data ?? []) as unknown as DetailExerciseRow[];
    } else {
      const basic = await supabase
        .from('workout_exercises')
        .select(detailSelectBasic)
        .eq('workout_id', id)
        .order('position');
      exercises = (basic.data ?? []) as unknown as DetailExerciseRow[];
      exercisesError = basic.error;
    }
  }
  if (exercisesError) throw exercisesError;

  const exerciseIds = (exercises ?? []).map((row) => row.id);
  const setsByExercise = new Map<string, WorkoutDetail['exercises'][number]['sets']>();
  if (exerciseIds.length) {
    const { data: setRows, error: setsError } = await supabase
      .from('workout_sets')
      .select(
        'id, workout_exercise_id, set_number, weight_kg, reps, duration_sec, distance_m, rest_sec, completed, notes',
      )
      .in('workout_exercise_id', exerciseIds)
      .order('set_number');
    if (setsError) throw setsError;
    for (const row of setRows ?? []) {
      const list = setsByExercise.get(row.workout_exercise_id) ?? [];
      list.push({
        id: row.id,
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
        duration_sec: row.duration_sec,
        distance_m: row.distance_m,
        rest_sec: row.rest_sec,
        completed: Boolean(row.completed),
        notes: row.notes,
      });
      setsByExercise.set(row.workout_exercise_id, list);
    }
  }

  return {
    ...(workout as WorkoutDetail),
    exercises: (exercises ?? []).map((exercise) => {
      const joined = exercise.exercise;
      return {
        id: exercise.id,
        exercise_id: exercise.exercise_id,
        position: exercise.position,
        exercise_name: exercise.exercise_name,
        exercise_type: exercise.exercise_type,
        notes: exercise.notes,
        estimated_calories: Number(exercise.estimated_calories ?? 0),
        estimate_method: (exercise.estimate_method as WorkoutDetail['exercises'][number]['estimate_method']) ?? null,
        estimate_calc_version: exercise.estimate_calc_version ?? null,
        estimate_duration_sec: exercise.estimate_duration_sec ?? null,
        estimate_activity_key: exercise.estimate_activity_key ?? null,
        estimate_body_weight_kg: exercise.estimate_body_weight_kg ?? null,
        image_url: joined?.image_url ?? null,
        image_storage_path: joined?.image_storage_path ?? null,
        image_key: joined?.image_key ?? null,
        slug: joined?.slug ?? null,
        sets: setsByExercise.get(exercise.id) ?? [],
      };
    }),
  };
}

export type FinishWorkoutPayload = {
  userId: string;
  name: string;
  startedAt: string;
  endedAt: string;
  activeDurationSec: number;
  notes?: string | null;
  sourceTemplateId?: string | null;
  estimatedCalories: number;
  calorieCalcVersion?: number;
  calorieBodyWeightKg?: number;
  exercises: {
    exerciseId: string | null;
    name: string;
    exerciseType: ExerciseType;
    notes?: string | null;
    estimatedCalories?: number;
    estimateMethod?: 'direct' | 'allocated' | null;
    estimateCalcVersion?: number | null;
    estimateDurationSec?: number | null;
    estimateActivityKey?: string | null;
    estimateBodyWeightKg?: number | null;
    sets: {
      setNumber: number;
      weightKg: number | null;
      reps: number | null;
      durationSec: number | null;
      distanceM: number | null;
      restSec: number | null;
      completed: boolean;
      notes?: string | null;
    }[];
  }[];
};

export async function finishWorkoutSession(
  input: FinishWorkoutPayload,
): Promise<{ workoutId: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      user_id: input.userId,
      name: input.name,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      estimated_calories: input.estimatedCalories,
      notes: input.notes ?? null,
      source_template_id: input.sourceTemplateId ?? null,
      status: 'completed',
      active_duration_sec: input.activeDurationSec,
      calorie_calc_version: input.calorieCalcVersion ?? null,
      calorie_body_weight_kg: input.calorieBodyWeightKg ?? null,
    })
    .select('id')
    .single();
  if (workoutError) throw workoutError;

  for (const [index, exercise] of input.exercises.entries()) {
    const { data: workoutExercise, error: exerciseError } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workout.id,
        exercise_id: exercise.exerciseId,
        position: index,
        exercise_name: exercise.name,
        exercise_type: exercise.exerciseType,
        notes: exercise.notes ?? null,
        estimated_calories: exercise.estimatedCalories ?? 0,
        estimate_method: exercise.estimateMethod ?? null,
        estimate_calc_version: exercise.estimateCalcVersion ?? null,
        estimate_duration_sec: exercise.estimateDurationSec ?? null,
        estimate_activity_key: exercise.estimateActivityKey ?? null,
        estimate_body_weight_kg: exercise.estimateBodyWeightKg ?? null,
      })
      .select('id')
      .single();
    if (exerciseError) throw exerciseError;

    const rows = exercise.sets.map((set) => ({
      workout_exercise_id: workoutExercise.id,
      set_number: set.setNumber,
      weight_kg: set.weightKg,
      reps: set.reps,
      duration_sec: set.durationSec,
      distance_m: set.distanceM,
      rest_sec: set.restSec,
      completed: set.completed,
      notes: set.notes ?? null,
    }));
    if (rows.length) {
      const { error: setsError } = await supabase.from('workout_sets').insert(rows);
      if (setsError) throw setsError;
    }
  }

  return { workoutId: workout.id as string };
}

export async function deleteWorkout(id: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
