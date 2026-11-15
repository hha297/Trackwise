import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { useWorkoutsInRange } from '@/features/diary/hooks';
import { useHydrationInRange } from '@/features/hydration/hooks';
import { usePlansInRange } from '@/features/planner/hooks';
import { toDiaryDateKey } from '@/utils/date';

import {
  buildCategoryFlagsByDay,
  buildConsistencySnapshot,
  type ConsistencySnapshot,
  type CategoryDayFlags,
} from './activity-days';
import { fetchFoodLoggedDayKeys } from './api';
import { shiftDiaryDateKey, streakHistoryRange } from './dates';
import {
  buildWorkoutDayKinds,
  computeLoggingStreak,
  computeWorkoutStreak,
  type LoggingStreakResult,
  type WorkoutStreakResult,
} from './streaks';

export type EngagementStreaks = {
  nutrition: LoggingStreakResult;
  hydration: LoggingStreakResult;
  workout: WorkoutStreakResult;
  /** Shared Consistency preview + detail snapshot (union overall + categories). */
  consistency: ConsistencySnapshot;
  nutritionKeys: string[];
  hydrationKeys: string[];
  workoutCompletedKeys: string[];
  flagsByDay: Map<string, CategoryDayFlags>;
  range: { startKey: string; endKey: string };
};

export function useEngagementStreaks(todayKey: string = toDiaryDateKey()) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const range = useMemo(() => streakHistoryRange(todayKey), [todayKey]);
  // Pad workout/plan fetch by ±1 day so local-midnight edge timestamps are not missed,
  // then classify with toDiaryDateKey (local calendar).
  const paddedStart = shiftDiaryDateKey(range.startKey, -1);
  const paddedEnd = shiftDiaryDateKey(range.endKey, 1);

  const foodDays = useQuery({
    queryKey: ['food-entries', 'logged-days', userId, range.startKey, range.endKey],
    enabled: Boolean(userId),
    queryFn: () => fetchFoodLoggedDayKeys(userId!, range.startKey, range.endKey),
  });
  const hydration = useHydrationInRange(range.startKey, range.endKey);
  const workouts = useWorkoutsInRange(paddedStart, paddedEnd);
  const plans = usePlansInRange(range.startKey, range.endKey);

  const data = useMemo((): EngagementStreaks | undefined => {
    if (!foodDays.data || !hydration.data || !workouts.data || !plans.data) return undefined;

    const nutritionKeys = [...foodDays.data];
    const hydrationKeys = hydration.data.entries.map((entry) => entry.loggedOn);
    const nutrition = computeLoggingStreak(nutritionKeys, todayKey);
    const hydrationStreak = computeLoggingStreak(hydrationKeys, todayKey);

    const completedKeys = workouts.data
      .filter((row) => (row.status ?? 'completed') === 'completed')
      .map((row) => toDiaryDateKey(new Date(row.started_at)))
      .filter((key) => key >= range.startKey && key <= range.endKey);

    const restKeys = plans.data
      .filter((plan) => plan.kind === 'rest' || plan.kind === 'recovery')
      .map((plan) => plan.planDate);

    const kinds = buildWorkoutDayKinds({
      completedWorkoutDayKeys: completedKeys,
      restOrRecoveryDayKeys: restKeys,
    });
    const workout = computeWorkoutStreak(kinds, todayKey);
    const flagsByDay = buildCategoryFlagsByDay({
      nutritionKeys,
      hydrationKeys,
      workoutCompletedKeys: completedKeys,
    });
    const consistency = buildConsistencySnapshot({
      todayKey,
      nutritionKeys,
      hydrationKeys,
      workoutCompletedKeys: completedKeys,
      workoutCompletedCurrent: workout.currentCompletedDays,
      workoutLongestCompleted: workout.longestCompletedDays,
      workoutAlive: workout.alive,
      nutrition,
      hydration: hydrationStreak,
    });

    return {
      nutrition,
      hydration: hydrationStreak,
      workout,
      consistency,
      nutritionKeys,
      hydrationKeys,
      workoutCompletedKeys: completedKeys,
      flagsByDay,
      range,
    };
  }, [foodDays.data, hydration.data, workouts.data, plans.data, todayKey, range]);

  const isLoading =
    foodDays.isLoading || hydration.isLoading || workouts.isLoading || plans.isLoading;
  const isError = foodDays.isError || hydration.isError || workouts.isError || plans.isError;
  const error = foodDays.error ?? hydration.error ?? workouts.error ?? plans.error;

  const refetch = async () => {
    await Promise.all([
      foodDays.refetch(),
      hydration.refetch(),
      workouts.refetch(),
      plans.refetch(),
    ]);
  };

  return { data, isLoading, isError, error, refetch };
}
