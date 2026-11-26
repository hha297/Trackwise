import { z } from 'zod';

export const TRACKWISE_BACKUP_FORMAT = 'trackwise-backup' as const;
export const TRACKWISE_BACKUP_VERSION = 1 as const;

const recordList = z.array(z.record(z.string(), z.unknown()));

export const trackwiseBackupDataSchema = z.object({
  profile: z.record(z.string(), z.unknown()).nullable().optional(),
  goals: recordList.default([]),
  body_measurements: recordList.default([]),
  food_entries: recordList.default([]),
  foods: recordList.default([]),
  food_favorites: recordList.default([]),
  workouts: recordList.default([]),
  workout_exercises: recordList.default([]),
  workout_sets: recordList.default([]),
  workout_templates: recordList.default([]),
  workout_template_variations: recordList.default([]),
  workout_template_exercises: recordList.default([]),
  custom_exercises: recordList.default([]),
  exercise_favorites: recordList.default([]),
  onboarding_progress: z.record(z.string(), z.unknown()).nullable().optional(),
  daily_nutrition_overrides: recordList.default([]),
});

/** Accept legacy Calio exports so old backup files still import. */
const LEGACY_BACKUP_FORMAT = 'calio-backup' as const;

export const trackwiseBackupSchema = z.object({
  format: z.union([z.literal(TRACKWISE_BACKUP_FORMAT), z.literal(LEGACY_BACKUP_FORMAT)]),
  version: z.literal(TRACKWISE_BACKUP_VERSION),
  exportedAt: z.string().min(1),
  appVersion: z.string().min(1),
  data: trackwiseBackupDataSchema,
});

export type TrackwiseBackupData = z.infer<typeof trackwiseBackupDataSchema>;
export type TrackwiseBackup = z.infer<typeof trackwiseBackupSchema>;

export type BackupSummary = {
  goals: number;
  bodyMeasurements: number;
  foodEntries: number;
  foods: number;
  foodFavorites: number;
  workouts: number;
  workoutExercises: number;
  workoutSets: number;
  workoutTemplates: number;
  workoutTemplateVariations: number;
  workoutTemplateExercises: number;
  customExercises: number;
  exerciseFavorites: number;
  hasProfile: boolean;
  hasOnboardingProgress: boolean;
  dailyNutritionOverrides: number;
};

export type BackupValidationResult =
  | { ok: true; backup: TrackwiseBackup; summary: BackupSummary }
  | { ok: false; error: string };

export function summarizeBackup(data: TrackwiseBackupData): BackupSummary {
  return {
    goals: data.goals.length,
    bodyMeasurements: data.body_measurements.length,
    foodEntries: data.food_entries.length,
    foods: data.foods.length,
    foodFavorites: data.food_favorites.length,
    workouts: data.workouts.length,
    workoutExercises: data.workout_exercises.length,
    workoutSets: data.workout_sets.length,
    workoutTemplates: data.workout_templates.length,
    workoutTemplateVariations: data.workout_template_variations.length,
    workoutTemplateExercises: data.workout_template_exercises.length,
    customExercises: data.custom_exercises.length,
    exerciseFavorites: data.exercise_favorites.length,
    hasProfile: Boolean(data.profile),
    hasOnboardingProgress: Boolean(data.onboarding_progress),
    dailyNutritionOverrides: data.daily_nutrition_overrides.length,
  };
}

export function validateTrackwiseBackup(raw: unknown): BackupValidationResult {
  const parsed = trackwiseBackupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join('.') : 'root';
    return {
      ok: false,
      error: `Invalid backup (${path}): ${issue?.message ?? ' unrecognized format'}`,
    };
  }

  // Soft structural checks for relationship integrity (pragmatic, not exhaustive).
  const data = parsed.data.data;
  const foodIds = new Set(
    data.foods.map((row) => row.id).filter((id): id is string => typeof id === 'string'),
  );
  for (const fav of data.food_favorites) {
    const foodId = fav.food_id;
    if (typeof foodId === 'string' && foodIds.size > 0 && !foodIds.has(foodId)) {
      // Favorites may point at public/system foods not in the backup — allowed.
      continue;
    }
    if (typeof fav.user_id !== 'string' && fav.user_id != null) {
      return { ok: false, error: 'Invalid food_favorites.user_id in backup.' };
    }
  }

  for (const workout of data.workouts) {
    if (workout.id != null && typeof workout.id !== 'string') {
      return { ok: false, error: 'Invalid workouts.id in backup.' };
    }
  }

  return {
    ok: true,
    backup: parsed.data,
    summary: summarizeBackup(data),
  };
}

export function parseTrackwiseBackupJson(text: string): BackupValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  return validateTrackwiseBackup(raw);
}
