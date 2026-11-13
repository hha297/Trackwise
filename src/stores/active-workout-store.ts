import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { draftSetIsLogged } from '@/features/workout/logged-set';
import type { ExerciseType } from '@/features/workout/types';

export type DraftSet = {
  localId: string;
  setNumber: number;
  weightKg: string;
  reps: string;
  durationSec: string;
  distanceM: string;
  restSec: string;
  notes: string;
  completed: boolean;
};

export type DraftExercise = {
  localId: string;
  exerciseId: string | null;
  name: string;
  exerciseType: ExerciseType;
  metValue: number | null;
  primaryMuscles?: string[];
  /** Image fields mirrored from the exercise catalog for active-session thumbnails. */
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  imageKey?: string | null;
  slug?: string | null;
  /** Template target, shown as a placeholder. It is not a logged set. */
  plannedReps?: number | null;
  notes: string;
  sets: DraftSet[];
};

type ActiveWorkoutState = {
  startedAt: string | null;
  name: string;
  sourceTemplateId: string | null;
  notes: string;
  paused: boolean;
  /** Accumulated active ms excluding pauses. */
  accumulatedActiveMs: number;
  /** Wall clock when current running segment started (null when paused). */
  runningSince: string | null;
  restEndsAt: string | null;
  defaultRestSec: number;
  exercises: DraftExercise[];
  start: (input?: {
    name?: string;
    sourceTemplateId?: string | null;
    exercises?: (Omit<DraftExercise, 'localId' | 'sets' | 'notes'> & {
      plannedSets?: number | null;
      plannedReps?: number | null;
    })[];
  }) => void;
  reset: () => void;
  setName: (name: string) => void;
  setNotes: (notes: string) => void;
  pause: () => void;
  resume: () => void;
  getActiveDurationSec: () => number;
  addExercise: (
    exercise: Omit<DraftExercise, 'localId' | 'sets' | 'notes'> & { notes?: string },
  ) => void;
  removeExercise: (localId: string) => void;
  reorderExercise: (localId: string, direction: 'up' | 'down') => void;
  addSet: (exerciseLocalId: string) => void;
  updateSet: (
    exerciseLocalId: string,
    setLocalId: string,
    patch: Partial<Omit<DraftSet, 'localId' | 'setNumber'>>,
  ) => void;
  removeSet: (exerciseLocalId: string, setLocalId: string) => void;
  startRest: (seconds?: number) => void;
  clearRest: () => void;
  adjustRest: (deltaSec: number) => void;
};

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySet(setNumber: number): DraftSet {
  return {
    localId: id(),
    setNumber,
    weightKg: '',
    reps: '',
    durationSec: '',
    distanceM: '',
    restSec: '',
    notes: '',
    completed: false,
  };
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      startedAt: null,
      name: 'Workout',
      sourceTemplateId: null,
      notes: '',
      paused: false,
      accumulatedActiveMs: 0,
      runningSince: null,
      restEndsAt: null,
      defaultRestSec: 90,
      exercises: [],
      start: (input) => {
        const now = new Date().toISOString();
        const seeded = (input?.exercises ?? []).map((exercise) => {
          const { plannedSets, plannedReps, ...rest } = exercise;
          const count = Math.max(1, Math.min(12, plannedSets ?? 3));
          return {
            ...rest,
            localId: id(),
            notes: '',
            plannedReps: plannedReps ?? null,
            sets: Array.from({ length: count }, (_, index) => emptySet(index + 1)),
          };
        });
        set({
          startedAt: now,
          name: input?.name ?? 'Workout',
          sourceTemplateId: input?.sourceTemplateId ?? null,
          notes: '',
          paused: false,
          accumulatedActiveMs: 0,
          runningSince: now,
          restEndsAt: null,
          exercises: seeded,
        });
      },
      reset: () =>
        set({
          startedAt: null,
          name: 'Workout',
          sourceTemplateId: null,
          notes: '',
          paused: false,
          accumulatedActiveMs: 0,
          runningSince: null,
          restEndsAt: null,
          exercises: [],
        }),
      setName: (name) => set({ name }),
      setNotes: (notes) => set({ notes }),
      pause: () => {
        const state = get();
        if (!state.startedAt || state.paused || !state.runningSince) return;
        const elapsed = Date.now() - new Date(state.runningSince).getTime();
        set({
          paused: true,
          accumulatedActiveMs: state.accumulatedActiveMs + Math.max(0, elapsed),
          runningSince: null,
        });
      },
      resume: () => {
        const state = get();
        if (!state.startedAt || !state.paused) return;
        set({ paused: false, runningSince: new Date().toISOString() });
      },
      getActiveDurationSec: () => {
        const state = get();
        let ms = state.accumulatedActiveMs;
        if (state.runningSince && !state.paused) {
          ms += Math.max(0, Date.now() - new Date(state.runningSince).getTime());
        }
        return Math.max(0, Math.floor(ms / 1000));
      },
      addExercise: (exercise) =>
        set({
          exercises: [
            ...get().exercises,
            {
              ...exercise,
              notes: exercise.notes ?? '',
              localId: id(),
              sets: [emptySet(1)],
            },
          ],
        }),
      removeExercise: (localId) =>
        set({ exercises: get().exercises.filter((item) => item.localId !== localId) }),
      reorderExercise: (localId, direction) => {
        const list = [...get().exercises];
        const index = list.findIndex((item) => item.localId === localId);
        if (index < 0) return;
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= list.length) return;
        const [item] = list.splice(index, 1);
        list.splice(target, 0, item!);
        set({ exercises: list });
      },
      addSet: (exerciseLocalId) => {
        const exercise = get().exercises.find((item) => item.localId === exerciseLocalId);
        const last = exercise?.sets[exercise.sets.length - 1];
        set({
          exercises: get().exercises.map((item) => {
            if (item.localId !== exerciseLocalId) return item;
            return {
              ...item,
              sets: [
                ...item.sets,
                {
                  ...emptySet(item.sets.length + 1),
                  weightKg: last?.weightKg ?? '',
                  reps: last?.reps ?? '',
                  durationSec: last?.durationSec ?? '',
                  distanceM: last?.distanceM ?? '',
                },
              ],
            };
          }),
        });
        if (last && draftSetIsLogged(last)) get().startRest();
      },
      updateSet: (exerciseLocalId, setLocalId, patch) =>
        set((state) => ({
          exercises: state.exercises.map((exercise) => {
            if (exercise.localId !== exerciseLocalId) return exercise;
            return {
              ...exercise,
              sets: exercise.sets.map((draftSet) =>
                draftSet.localId === setLocalId ? { ...draftSet, ...patch } : draftSet,
              ),
            };
          }),
        })),
      removeSet: (exerciseLocalId, setLocalId) =>
        set({
          exercises: get().exercises.map((exercise) => {
            if (exercise.localId !== exerciseLocalId) return exercise;
            const next = exercise.sets
              .filter((draftSet) => draftSet.localId !== setLocalId)
              .map((draftSet, index) => ({ ...draftSet, setNumber: index + 1 }));
            return { ...exercise, sets: next };
          }),
        }),
      startRest: (seconds) => {
        const sec = seconds ?? get().defaultRestSec;
        set({ restEndsAt: new Date(Date.now() + sec * 1000).toISOString() });
      },
      clearRest: () => set({ restEndsAt: null }),
      adjustRest: (deltaSec) => {
        const ends = get().restEndsAt;
        if (!ends) return;
        const next = new Date(ends).getTime() + deltaSec * 1000;
        if (next <= Date.now()) {
          set({ restEndsAt: null });
          return;
        }
        set({ restEndsAt: new Date(next).toISOString() });
      },
    }),
    {
      name: 'trackwise-active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        startedAt: state.startedAt,
        name: state.name,
        sourceTemplateId: state.sourceTemplateId,
        notes: state.notes,
        paused: state.paused,
        accumulatedActiveMs: state.accumulatedActiveMs,
        runningSince: state.runningSince,
        restEndsAt: state.restEndsAt,
        defaultRestSec: state.defaultRestSec,
        exercises: state.exercises,
      }),
    },
  ),
);
