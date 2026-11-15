import { getSupabase } from '@/lib/supabase/client';
import { toDiaryDateKey } from '@/utils/date';

import type { RecordedSet } from './personal-records';

type HistoryRow = {
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  workout_exercises: {
    exercise_id: string | null;
    exercise_name: string;
    exercise_type: string;
    workouts: { id: string; started_at: string; status: string; user_id: string } | { id: string; started_at: string; status: string; user_id: string }[];
  } | {
    exercise_id: string | null;
    exercise_name: string;
    exercise_type: string;
    workouts: { id: string; started_at: string; status: string; user_id: string } | { id: string; started_at: string; status: string; user_id: string }[];
  }[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function fetchCompletedSetHistory(userId: string): Promise<(RecordedSet & { dateKey: string })[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('workout_sets')
    .select(
      'weight_kg, reps, completed, workout_exercises!inner(exercise_id, exercise_name, exercise_type, workouts!inner(id, started_at, status, user_id))',
    )
    .eq('workout_exercises.workouts.user_id', userId)
    .eq('workout_exercises.workouts.status', 'completed');
  if (error) throw error;

  return ((data ?? []) as HistoryRow[]).flatMap((row) => {
    const exercise = one(row.workout_exercises);
    const workout = exercise ? one(exercise.workouts) : null;
    if (!exercise || !workout || workout.user_id !== userId) return [];
    const key = exercise.exercise_id ?? exercise.exercise_name;
    return [
      {
        exerciseKey: key,
        exerciseName: exercise.exercise_name,
        exerciseType: exercise.exercise_type,
        weightKg: row.weight_kg,
        reps: row.reps,
        completed: row.completed,
        sessionId: workout.id,
        dateKey: toDiaryDateKey(new Date(workout.started_at)),
      },
    ];
  });
}
