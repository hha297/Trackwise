export type ExerciseType = 'strength' | 'bodyweight' | 'cardio' | 'other';

export type WorkoutCategory =
  | 'Strength'
  | 'Cardio'
  | 'Bodyweight'
  | 'Flexibility'
  | 'Sports'
  | 'Other';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type Exercise = {
  id: string;
  name: string;
  category: string;
  primary_muscles: string[];
  secondary_muscles?: string[];
  equipment: string | null;
  exercise_type: ExerciseType;
  movement_pattern?: string | null;
  instructions: string | null;
  description?: string | null;
  tips?: string | null;
  common_mistakes?: string | null;
  safety_notes?: string | null;
  difficulty?: ExerciseDifficulty | null;
  image_key?: string | null;
  image_storage_path?: string | null;
  image_url?: string | null;
  slug?: string | null;
  content_version?: number | null;
  library_paths?: string[];
  met_value: number | null;
  is_system: boolean;
  user_id: string | null;
};

export type WorkoutListItem = {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  estimated_calories: number;
  status?: string;
  active_duration_sec?: number | null;
  set_count?: number;
  volume_kg?: number;
  previews?: {
    name: string;
    image_url?: string | null;
    image_storage_path?: string | null;
    image_key?: string | null;
    slug?: string | null;
  }[];
};

export type WorkoutTemplateGoal =
  | 'hypertrophy'
  | 'strength'
  | 'fat_loss'
  | 'conditioning'
  | 'endurance'
  | 'core'
  | 'mobility'
  | 'general';

export type WorkoutTemplate = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_system: boolean;
  user_id: string | null;
  /** Optional cover key resolved via template-assets local map */
  image_key?: string | null;
  difficulty?: ExerciseDifficulty | null;
  goal?: WorkoutTemplateGoal | string | null;
  estimated_minutes?: number | null;
  equipment_summary?: string | null;
  target_muscles?: string[] | null;
};

/** Preset equipment labels stored in `equipment_summary`. */
export const TEMPLATE_EQUIPMENT_PRESETS = [
  'Full Gym',
  'Home',
  'Bodyweight',
  'Minimal Equipment',
] as const;

export type TemplateEquipmentPreset = (typeof TEMPLATE_EQUIPMENT_PRESETS)[number];

export const TEMPLATE_GOALS: WorkoutTemplateGoal[] = [
  'hypertrophy',
  'strength',
  'fat_loss',
  'conditioning',
  'endurance',
  'core',
  'mobility',
  'general',
];

/** Muscle chips used when building a template (subset of catalog muscles). */
export const TEMPLATE_TARGET_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'quadriceps',
  'hamstrings',
  'glutes',
  'full body',
] as const;

export type WorkoutTemplateExercise = {
  id: string;
  template_id: string;
  variation_id?: string | null;
  exercise_id: string | null;
  position: number;
  exercise_name: string;
  exercise_type: ExerciseType;
  planned_sets: number | null;
  planned_reps: number | null;
  planned_weight_kg: number | null;
  planned_rest_sec?: number | null;
  notes: string | null;
  image_storage_path?: string | null;
  image_url?: string | null;
  image_key?: string | null;
  slug?: string | null;
  primary_muscles?: string[] | null;
  secondary_muscles?: string[] | null;
  equipment?: string | null;
};

export type WorkoutTemplateVariation = {
  id: string;
  template_id: string;
  training_level: ExerciseDifficulty;
  description: string | null;
  estimated_minutes: number | null;
  /** Populated by detail fetch when requested. */
  exercises?: WorkoutTemplateExercise[];
  exercise_count?: number;
  total_sets?: number;
};

export const TEMPLATE_TRAINING_LEVELS: ExerciseDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
];

export type ExerciseEstimateMethod = 'direct' | 'allocated';

export type WorkoutDetail = WorkoutListItem & {
  notes: string | null;
  source_template_id: string | null;
  calorie_calc_version?: number | null;
  calorie_body_weight_kg?: number | null;
  exercises: {
    id: string;
    exercise_id: string | null;
    position: number;
    exercise_name: string;
    exercise_type: ExerciseType;
    notes: string | null;
    estimated_calories?: number | null;
    estimate_method?: ExerciseEstimateMethod | null;
    estimate_calc_version?: number | null;
    estimate_duration_sec?: number | null;
    estimate_activity_key?: string | null;
    estimate_body_weight_kg?: number | null;
    image_url?: string | null;
    image_storage_path?: string | null;
    image_key?: string | null;
    slug?: string | null;
    sets: {
      id: string;
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      duration_sec: number | null;
      distance_m: number | null;
      rest_sec: number | null;
      completed: boolean;
      notes: string | null;
    }[];
  }[];
};

export const WORKOUT_CATEGORIES: {
  id: WorkoutCategory;
  exerciseTypes: ExerciseType[];
  icon: 'dumbbell' | 'heart' | 'person' | 'wind' | 'trophy' | 'more';
}[] = [
  { id: 'Strength', exerciseTypes: ['strength'], icon: 'dumbbell' },
  { id: 'Cardio', exerciseTypes: ['cardio'], icon: 'heart' },
  { id: 'Bodyweight', exerciseTypes: ['bodyweight'], icon: 'person' },
  { id: 'Flexibility', exerciseTypes: ['other'], icon: 'wind' },
  { id: 'Sports', exerciseTypes: ['other', 'cardio'], icon: 'trophy' },
  { id: 'Other', exerciseTypes: ['other', 'strength', 'bodyweight', 'cardio'], icon: 'more' },
];

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'full body',
] as const;
