import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { parseISO } from 'date-fns';

import { useAuth } from '@/features/auth/auth-provider';
import { invalidateDailyActivityQueries } from '@/features/engagement/api';
import { linkPlanToWorkout } from '@/features/planner/api';
import { toDiaryDateKey } from '@/utils/date';
import {
  createCustomExercise,
  createWorkoutTemplate,
  deleteCustomExercise,
  deleteWorkout,
  deleteWorkoutTemplate,
  fetchExercises,
  fetchFavoriteExerciseIds,
  fetchTemplateExercises,
  fetchTemplateVariations,
  fetchWorkoutDetail,
  fetchWorkoutTemplates,
  fetchWorkouts,
  finishWorkoutSession,
  renameWorkout,
  reorderSavedWorkoutSets,
  reviseSavedWorkoutSet,
  toggleExerciseFavorite,
  updateWorkoutTemplate,
  type WorkoutTemplateWriteInput,
} from '@/features/workout/api';
import { totalVolumeKg } from '@/features/workout/calculations';
import { draftSetIsLogged } from '@/features/workout/logged-set';
import { estimateWorkoutCalories } from '@/features/workout/exercise-calorie-engine';
import { fetchCompletedSetHistory } from '@/features/workout/history-sets';
import { detectNewPersonalRecords, type NewPersonalRecord } from '@/features/workout/personal-records';
import type { ExerciseType } from '@/features/workout/types';
import type { DraftExercise } from '@/stores/active-workout-store';

export type { Exercise, WorkoutListItem } from '@/features/workout/types';

export function useExercises(input: {
  search?: string;
  category?: string | null;
  exerciseType?: ExerciseType | null;
  muscle?: string | null;
  libraryPath?: string | null;
  equipment?: string | null;
  difficulty?: string | null;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: [
      'exercises',
      input.search ?? '',
      input.category ?? '',
      input.exerciseType ?? '',
      input.muscle ?? '',
      input.libraryPath ?? '',
      input.equipment ?? '',
      input.difficulty ?? '',
    ],
    enabled: input.enabled ?? true,
    queryFn: () =>
      fetchExercises({
        search: input.search,
        category: input.category,
        exerciseType: input.exerciseType,
        muscle: input.muscle,
        libraryPath: input.libraryPath,
        equipment: input.equipment,
        difficulty: input.difficulty,
      }),
    // API catalog — keep warm while browsing filters / navigating nearby screens.
    staleTime: 5 * 60_000,
    // Keep prior list visible while a different key loads — avoids empty flash.
    placeholderData: keepPreviousData,
  });
}

export function useExerciseDetail(id: string | null) {
  return useQuery({
    queryKey: ['exercises', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { fetchExerciseById } = await import('@/features/workout/api');
      return fetchExerciseById(id!);
    },
  });
}

export function useExerciseFavorites() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['exercise-favorites', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchFavoriteExerciseIds(userId!),
  });
}

export function useToggleExerciseFavorite() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { exerciseId: string; favorite: boolean }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await toggleExerciseFavorite({ userId, ...input });
    },
    onMutate: async (input) => {
      const userId = session?.user.id;
      if (!userId) return;
      const key = ['exercise-favorites', userId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key) ?? [];
      const next = input.favorite
        ? [...new Set([...previous, input.exerciseId])]
        : previous.filter((id) => id !== input.exerciseId);
      queryClient.setQueryData(key, next);
      return { previous, key };
    },
    onError: (_error, _input, context) => {
      if (context?.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercise-favorites'] });
    },
  });
}

export function useCreateCustomExercise() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      category: string;
      exerciseType: ExerciseType;
      primaryMuscles?: string[];
      equipment?: string | null;
      description?: string | null;
      instructions?: string | null;
      imageUrl?: string | null;
    }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      return createCustomExercise({ userId, ...input });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

export function useDeleteCustomExercise() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await deleteCustomExercise(id, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      await queryClient.invalidateQueries({ queryKey: ['exercise-favorites'] });
    },
  });
}

export function useWorkoutTemplates() {
  return useQuery({
    queryKey: ['workout-templates'],
    queryFn: fetchWorkoutTemplates,
  });
}

export function useTemplateExercises(templateId: string | null) {
  return useQuery({
    queryKey: ['workout-templates', templateId, 'exercises'],
    enabled: Boolean(templateId),
    queryFn: () => fetchTemplateExercises(templateId!),
  });
}

export function useTemplateVariations(templateId: string | null) {
  return useQuery({
    queryKey: ['workout-templates', templateId, 'variations'],
    enabled: Boolean(templateId),
    queryFn: () => fetchTemplateVariations(templateId!),
  });
}

type TemplateMutationInput = Omit<WorkoutTemplateWriteInput, 'userId'>;

export function useCreateWorkoutTemplate() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateMutationInput) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      return createWorkoutTemplate({ userId, ...input });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout-templates'] });
    },
  });
}

export function useUpdateWorkoutTemplate() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateMutationInput & { id: string }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      const { id, ...rest } = input;
      await updateWorkoutTemplate(id, { userId, ...rest });
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workout-templates'] });
      await queryClient.invalidateQueries({
        queryKey: ['workout-templates', variables.id, 'exercises'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['workout-templates', variables.id, 'variations'],
      });
    },
  });
}

export function useDeleteWorkoutTemplate() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await deleteWorkoutTemplate(id, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout-templates'] });
    },
  });
}

export function useWorkouts() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['workouts', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchWorkouts(userId!),
  });
}

export function useWorkoutDetail(id: string | null) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['workouts', 'detail', userId, id],
    enabled: Boolean(userId && id),
    queryFn: () => fetchWorkoutDetail(id!, userId!),
  });
}

export function useDayWorkoutCalories(dateKey: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['workouts', 'day-calories', userId, dateKey],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const list = await fetchWorkouts(userId!, 100);
      const start = `${dateKey}T00:00:00`;
      const end = `${dateKey}T23:59:59`;
      return list
        .filter((row) => row.started_at >= start && row.started_at <= end)
        .reduce((sum, row) => sum + Number(row.estimated_calories ?? 0), 0);
    },
  });
}

export function useFinishWorkout() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      startedAt: string;
      activeDurationSec: number;
      notes?: string;
      sourceTemplateId?: string | null;
      exercises: DraftExercise[];
      bodyWeightKg: number;
    }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in to save workouts.');

      const endedAt = new Date().toISOString();
      const durationMin = Math.max(1, Math.round(input.activeDurationSec / 60));
      let personalRecords: NewPersonalRecord[] = [];
      try {
        const history = await fetchCompletedSetHistory(userId);
        const sessionSets = input.exercises.flatMap((exercise) =>
          exercise.sets.map((set) => ({
            exerciseKey: exercise.exerciseId ?? exercise.name,
            exerciseName: exercise.name,
            exerciseType: exercise.exerciseType,
            weightKg: set.weightKg ? Number(set.weightKg) : null,
            reps: set.reps ? Number(set.reps) : null,
            completed: draftSetIsLogged(set),
            sessionId: 'current',
          })),
        );
        personalRecords = detectNewPersonalRecords(history, sessionSets);
      } catch {
        personalRecords = [];
      }

      if (!(input.bodyWeightKg > 0)) {
        throw new Error('BODY_WEIGHT_REQUIRED');
      }

      // Exercise-level estimates → session total = sum (no second full-session pass).
      const workoutEstimate = estimateWorkoutCalories({
        activeDurationSec: input.activeDurationSec,
        bodyWeightKg: input.bodyWeightKg,
        exercises: input.exercises.map((exercise) => ({
          localId: exercise.localId,
          name: exercise.name,
          exerciseType: exercise.exerciseType,
          metValue: exercise.metValue,
          sets: exercise.sets.map((set) => ({
            weightKg: set.weightKg ? Number(set.weightKg) : null,
            reps: set.reps ? Number(set.reps) : null,
            durationSec: set.durationSec ? Number(set.durationSec) : null,
            distanceM: set.distanceM ? Number(set.distanceM) : null,
            restSec: set.restSec ? Number(set.restSec) : null,
            completed: draftSetIsLogged(set),
          })),
        })),
      });
      const byLocalId = new Map(
        workoutEstimate.exercises.map((row) => [row.localId, row] as const),
      );
      const estimated = workoutEstimate.totalEstimatedCalories;

      const { workoutId } = await finishWorkoutSession({
        userId,
        name: input.name,
        startedAt: input.startedAt,
        endedAt,
        activeDurationSec: input.activeDurationSec,
        notes: input.notes,
        sourceTemplateId: input.sourceTemplateId,
        estimatedCalories: estimated,
        calorieCalcVersion: workoutEstimate.calcVersion,
        calorieBodyWeightKg: workoutEstimate.bodyWeightKg,
        exercises: input.exercises.map((exercise) => {
          const row = byLocalId.get(exercise.localId);
          return {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            exerciseType: exercise.exerciseType,
            notes: exercise.notes || null,
            estimatedCalories: row?.estimatedCalories ?? 0,
            estimateMethod: row?.method ?? null,
            estimateCalcVersion: row?.calcVersion ?? null,
            estimateDurationSec: row?.durationSec ?? null,
            estimateActivityKey: row?.activityKey ?? null,
            estimateBodyWeightKg: row?.bodyWeightKg ?? null,
            sets: exercise.sets.filter(draftSetIsLogged).map((set, index) => ({
              setNumber: index + 1,
              weightKg: set.weightKg ? Number(set.weightKg) : null,
              reps: set.reps ? Number(set.reps) : null,
              durationSec: set.durationSec ? Number(set.durationSec) : null,
              distanceM: set.distanceM ? Number(set.distanceM) : null,
              restSec: set.restSec ? Number(set.restSec) : null,
              completed: true,
              notes: set.notes || null,
            })),
          };
        }),
      });

      if (input.sourceTemplateId) {
        try {
          await linkPlanToWorkout({
            userId,
            planDate: toDiaryDateKey(),
            templateId: input.sourceTemplateId,
            workoutId,
          });
        } catch {
          // Saving the session is the source of truth. Plan linking can be retried.
        }
      }

      const volume = totalVolumeKg(
        input.exercises.flatMap((exercise) =>
          exercise.sets
            .filter((set) => draftSetIsLogged(set) && set.weightKg && set.reps)
            .map((set) => ({
              weightKg: Number(set.weightKg),
              reps: Number(set.reps),
            })),
        ),
      );

      return {
        workoutId,
        estimated: Math.round(estimated),
        volume,
        durationMin,
        intensity: workoutEstimate.intensity,
        bodyWeightKg: workoutEstimate.bodyWeightKg,
        exerciseEstimates: workoutEstimate.exercises,
        endedAt,
        startedAt: input.startedAt,
        personalRecords,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      await queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
    },
  });
}

export function useRenameWorkout() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await renameWorkout(input.id, userId, input.name);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

export function useReviseSavedSet() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<Parameters<typeof reviseSavedWorkoutSet>[0], 'userId'>,
    ) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await reviseSavedWorkoutSet({ ...input, userId });
      return input;
    },
    onMutate: async (input) => {
      const userId = session?.user.id;
      if (!userId) return;
      const detailKey = ['workouts', 'detail', userId, input.workoutId] as const;
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);

      const weightKg = input.weightKg != null && Number(input.weightKg) > 0 ? Number(input.weightKg) : null;
      const reps = input.reps != null && Number(input.reps) > 0 ? Number(input.reps) : null;
      const durationSec =
        input.durationSec != null && Number(input.durationSec) > 0 ? Number(input.durationSec) : null;
      const distanceM =
        input.distanceM != null && Number(input.distanceM) > 0 ? Number(input.distanceM) : null;
      const clearing =
        input.mode === 'delete' ||
        (weightKg == null && reps == null && durationSec == null && distanceM == null);

      queryClient.setQueryData(detailKey, (current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        const detail = current as {
          exercises?: {
            id: string;
            sets: {
              id: string;
              set_number: number;
              weight_kg: number | null;
              reps: number | null;
              duration_sec: number | null;
              distance_m: number | null;
              completed: boolean;
            }[];
          }[];
        };
        if (!detail.exercises) return current;
        return {
          ...detail,
          exercises: detail.exercises.map((exercise) => {
            if (!exercise.sets.some((set) => set.id === input.setId)) return exercise;
            const sets = clearing
              ? exercise.sets
                  .filter((set) => set.id !== input.setId)
                  .map((set, index) => ({ ...set, set_number: index + 1 }))
              : exercise.sets.map((set) =>
                  set.id === input.setId
                    ? {
                        ...set,
                        weight_kg: weightKg,
                        reps,
                        duration_sec: durationSec,
                        distance_m: distanceM,
                        completed: true,
                      }
                    : set,
                );
            return { ...exercise, sets };
          }),
        };
      });

      return { previous, detailKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined && context.detailKey) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      await queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
    },
  });
}

function patchWorkoutSetOrder(
  current: unknown,
  input: { exerciseId: string; orderedSetIds: string[] },
): unknown {
  if (!current || typeof current !== 'object') return current;
  const detail = current as {
    exercises?: {
      id: string;
      sets: { id: string; set_number: number }[];
    }[];
  };
  if (!detail.exercises) return current;
  return {
    ...detail,
    exercises: detail.exercises.map((exercise) => {
      if (exercise.id !== input.exerciseId) return exercise;
      const byId = new Map(exercise.sets.map((set) => [set.id, set]));
      const sets = input.orderedSetIds
        .map((id, index) => {
          const row = byId.get(id);
          return row ? { ...row, set_number: index + 1 } : null;
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
      return { ...exercise, sets };
    }),
  };
}

export function useReorderSavedSets() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<Parameters<typeof reorderSavedWorkoutSets>[0], 'userId'>,
    ) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await reorderSavedWorkoutSets({ ...input, userId });
      return input;
    },
    onMutate: async (input) => {
      const userId = session?.user.id;
      if (!userId) return;
      const detailKey = ['workouts', 'detail', userId, input.workoutId] as const;
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);
      // Optimistic: detail order matches the drop immediately (no post-save flash).
      queryClient.setQueryData(detailKey, (current) => patchWorkoutSetOrder(current, input));
      return { previous, detailKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined && context.detailKey) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
    },
    onSuccess: async (input) => {
      const userId = session?.user.id;
      if (!userId) return;
      queryClient.setQueryData(['workouts', 'detail', userId, input.workoutId], (current) =>
        patchWorkoutSetOrder(current, input),
      );
      // List only — do not refetch detail (avoids a stale-order blink).
      await queryClient.invalidateQueries({
        queryKey: ['workouts', userId],
        exact: true,
      });
    },
  });
}

export function useDeleteWorkout() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sign in required.');
      await deleteWorkout(id, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

export function formatElapsed(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function sessionDayKey(iso: string) {
  return parseISO(iso).toISOString().slice(0, 10);
}
