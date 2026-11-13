import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { weekDateKeys } from '@/features/diary/aggregations';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import { useHydrationInRange } from '@/features/hydration/hooks';
import { usePlansInRange } from '@/features/planner/hooks';
import { toDiaryDateKey } from '@/utils/date';

import { fetchFoodLoggedDayKeys } from './api';
import { shiftDiaryDateKey, streakHistoryRange } from './dates';
import {
  buildWorkoutDayKinds,
  computeLoggingStreak,
  computeWorkoutStreak,
  type LoggingStreakResult,
  type WorkoutStreakResult,
} from './streaks';
import { buildWeeklySummary, type WeeklySummary } from './weekly-summary';

export type EngagementStreaks = {
  nutrition: LoggingStreakResult;
  hydration: LoggingStreakResult;
  workout: WorkoutStreakResult;
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

    const nutrition = computeLoggingStreak(foodDays.data, todayKey);
    const hydrationKeys = hydration.data.entries.map((entry) => entry.loggedOn);
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

    return { nutrition, hydration: hydrationStreak, workout };
  }, [foodDays.data, hydration.data, workouts.data, plans.data, todayKey, range.startKey, range.endKey]);

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

export function useWeeklyEngagementSummary(anchorKey: string) {
  const week = useMemo(() => weekDateKeys(anchorKey), [anchorKey]);
  const startKey = week[0]!;
  const endKey = week[week.length - 1]!;
  const paddedStart = shiftDiaryDateKey(startKey, -1);
  const paddedEnd = shiftDiaryDateKey(endKey, 1);

  const food = useFoodEntriesInRange(startKey, endKey);
  const hydration = useHydrationInRange(startKey, endKey);
  const workouts = useWorkoutsInRange(paddedStart, paddedEnd);

  const data = useMemo((): WeeklySummary | undefined => {
    if (!food.data || !hydration.data || !workouts.data) return undefined;

    const completedInWeek = workouts.data.filter((row) => {
      if ((row.status ?? 'completed') !== 'completed') return false;
      const key = toDiaryDateKey(new Date(row.started_at));
      return key >= startKey && key <= endKey;
    });

    const amountByDay = new Map<string, number>();
    for (const entry of hydration.data.entries) {
      amountByDay.set(entry.loggedOn, (amountByDay.get(entry.loggedOn) ?? 0) + entry.amountMl);
    }

    return buildWeeklySummary({
      anchorKey,
      foodLoggedDayKeys: food.data.map((entry) => entry.logged_on),
      hydrationLoggedDayKeys: hydration.data.entries.map((entry) => entry.loggedOn),
      workoutCompletedDayKeys: completedInWeek.map((row) =>
        toDiaryDateKey(new Date(row.started_at)),
      ),
      completedWorkoutSessions: completedInWeek.length,
      foodEntriesInWeek: food.data,
      hydrationAmountByDay: amountByDay,
      hydrationTargetMl: hydration.data.targetMl,
    });
  }, [food.data, hydration.data, workouts.data, anchorKey, startKey, endKey]);

  const isLoading = food.isLoading || hydration.isLoading || workouts.isLoading;
  const isError = food.isError || hydration.isError || workouts.isError;
  const error = food.error ?? hydration.error ?? workouts.error;

  const refetch = async () => {
    await Promise.all([food.refetch(), hydration.refetch(), workouts.refetch()]);
  };

  return { data, isLoading, isError, error, refetch, weekStartKey: startKey, weekEndKey: endKey };
}
