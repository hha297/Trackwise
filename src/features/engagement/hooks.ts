import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import {
  fetchDailyActivityHistory,
  invalidateDailyActivityQueries,
  recordOwnDailyActivityDays,
} from './api';
import {
  dailyActivityQueryKey,
  keysNeedingPersist,
  mergeEarnedDayKeys,
} from './daily-activity';
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
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const range = useMemo(() => streakHistoryRange(todayKey), [todayKey]);
  // Pad workout/plan fetch by ±1 day so local-midnight edge timestamps are not missed,
  // then classify with toDiaryDateKey (local calendar).
  const paddedStart = shiftDiaryDateKey(range.startKey, -1);
  const paddedEnd = shiftDiaryDateKey(range.endKey, 1);

  const activity = useQuery({
    queryKey: dailyActivityQueryKey(userId, range.startKey, range.endKey),
    enabled: Boolean(userId),
    queryFn: () => fetchDailyActivityHistory(userId!, range.startKey, range.endKey),
  });
  const hydration = useHydrationInRange(range.startKey, range.endKey);
  const workouts = useWorkoutsInRange(paddedStart, paddedEnd);
  const plans = usePlansInRange(range.startKey, range.endKey);

  const liveHydrationKeys = useMemo(
    () => (hydration.data?.entries ?? []).map((entry) => entry.loggedOn),
    [hydration.data],
  );
  const liveWorkoutKeys = useMemo(() => {
    if (!workouts.data) return [];
    return workouts.data
      .filter((row) => (row.status ?? 'completed') === 'completed')
      .map((row) => toDiaryDateKey(new Date(row.started_at)))
      .filter((key) => key >= range.startKey && key <= range.endKey);
  }, [workouts.data, range.startKey, range.endKey]);

  const data = useMemo((): EngagementStreaks | undefined => {
    if (!activity.data || !hydration.data || !workouts.data || !plans.data) return undefined;

    const nutritionKeys = activity.data.nutritionKeys;
    const hydrationKeys = mergeEarnedDayKeys(activity.data.hydrationKeys, liveHydrationKeys);
    const completedKeys = mergeEarnedDayKeys(activity.data.workoutKeys, liveWorkoutKeys);
    const nutrition = computeLoggingStreak(nutritionKeys, todayKey);
    const hydrationStreak = computeLoggingStreak(hydrationKeys, todayKey);

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
  }, [
    activity.data,
    hydration.data,
    workouts.data,
    plans.data,
    liveHydrationKeys,
    liveWorkoutKeys,
    todayKey,
    range,
  ]);

  useEffect(() => {
    if (!userId || !activity.data) return;
    const missingHydration = keysNeedingPersist(liveHydrationKeys, activity.data.hydrationKeys);
    const missingWorkout = keysNeedingPersist(liveWorkoutKeys, activity.data.workoutKeys);
    if (missingHydration.length === 0 && missingWorkout.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        if (missingHydration.length > 0) {
          await recordOwnDailyActivityDays('hydration', missingHydration);
        }
        if (missingWorkout.length > 0) {
          await recordOwnDailyActivityDays('workout', missingWorkout);
        }
        if (!cancelled) {
          await invalidateDailyActivityQueries(queryClient, userId);
        }
      } catch {
        // Live logs still cover the day until persist succeeds.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, activity.data, liveHydrationKeys, liveWorkoutKeys, queryClient]);

  const isLoading =
    activity.isLoading || hydration.isLoading || workouts.isLoading || plans.isLoading;
  const isError = activity.isError || hydration.isError || workouts.isError || plans.isError;
  const error = activity.error ?? hydration.error ?? workouts.error ?? plans.error;

  const refetch = async () => {
    await Promise.all([
      activity.refetch(),
      hydration.refetch(),
      workouts.refetch(),
      plans.refetch(),
    ]);
  };

  return { data, isLoading, isError, error, refetch };
}
