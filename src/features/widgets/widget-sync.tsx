import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import { useDayWorkouts } from '@/features/diary/hooks';
import { fetchDailyActivityHistory } from '@/features/engagement/api';
import {
  DAILY_ACTIVITY_QUERY_KEY,
  dailyActivityQueryKey,
  mergeEarnedDayKeys,
} from '@/features/engagement/daily-activity';
import { shiftDiaryDateKey } from '@/features/engagement/dates';
import { useFoodEntries } from '@/features/food/hooks';
import { useActiveGoal, useProfile } from '@/features/goals/hooks';
import { useHydration } from '@/features/hydration/hooks';
import { usePlansInRange } from '@/features/planner/hooks';
import { useAppLanguage } from '@/i18n';
import { useTheme } from '@/theme/theme-provider';
import { toDiaryDateKey } from '@/utils/date';

import { buildDailyWidgetSnapshot } from './daily-snapshot';
import {
  applyHomeScreenWidgetSnapshots,
  clearHomeScreenWidgets,
  homeScreenWidgetsAvailable,
} from './sync';
import { buildWorkoutWidgetSnapshot } from './workout-snapshot';

const STREAK_LOOKBACK_DAYS = 120;
const DEBOUNCE_MS = 400;

export function WidgetSync() {
  const { session, isReady } = useAuth();
  const queryClient = useQueryClient();
  const locale = useAppLanguage();
  const { scheme } = useTheme();
  const userId = session?.user.id;
  const todayKey = toDiaryDateKey();
  const streakStart = shiftDiaryDateKey(todayKey, -(STREAK_LOOKBACK_DAYS - 1));

  const food = useFoodEntries(todayKey);
  const hydration = useHydration(todayKey);
  const goal = useActiveGoal();
  const profile = useProfile();
  const plans = usePlansInRange(todayKey, todayKey);
  const workouts = useDayWorkouts(todayKey);
  const activity = useQuery({
    queryKey: dailyActivityQueryKey(userId, streakStart, todayKey),
    enabled: Boolean(userId),
    queryFn: () => fetchDailyActivityHistory(userId!, streakStart, todayKey),
    staleTime: 30_000,
  });

  const burned = useMemo(
    () =>
      (workouts.data ?? [])
        .filter((row) => (row.status ?? 'completed') === 'completed')
        .reduce((sum, row) => sum + Number(row.estimated_calories ?? 0), 0),
    [workouts.data],
  );

  const lastKey = useRef('');
  const prevUserId = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!homeScreenWidgetsAvailable()) return;
    if (!isReady) return;

    if (prevUserId.current && prevUserId.current !== userId) {
      lastKey.current = '';
      void clearHomeScreenWidgets(scheme);
    }
    prevUserId.current = userId;

    if (!userId) {
      lastKey.current = '';
      void clearHomeScreenWidgets(scheme);
      return;
    }

    const waiting =
      food.isLoading ||
      hydration.isLoading ||
      goal.isLoading ||
      profile.isLoading ||
      plans.isLoading ||
      workouts.isLoading;
    const hasAnyData = Boolean(food.data || hydration.data || plans.data || workouts.data);
    if (waiting && !hasAnyData) return;

    const unavailable =
      food.isError && hydration.isError && plans.isError && workouts.isError && activity.isError;

    const hydrationKeys = mergeEarnedDayKeys(
      activity.data?.hydrationKeys ?? [],
      (hydration.data?.entries ?? []).map((entry) => entry.loggedOn),
    );
    const workoutKeys = mergeEarnedDayKeys(
      activity.data?.workoutKeys ?? [],
      (workouts.data ?? [])
        .filter((row) => (row.status ?? 'completed') === 'completed')
        .map((row) => toDiaryDateKey(new Date(row.started_at))),
    );

    const daily = buildDailyWidgetSnapshot({
      signedIn: true,
      colorScheme: scheme,
      unavailable,
      todayKey,
      locale,
      goal: goal.data ?? null,
      profile: profile.data ?? null,
      foodEntries: food.data ?? [],
      hydrationEntries: hydration.data?.entries ?? [],
      hydrationTargetMl: hydration.data?.targetMl,
      burnedCalories: burned,
      nutritionDayKeys: activity.data?.nutritionKeys ?? [],
      hydrationDayKeys: hydrationKeys,
      workoutDayKeys: workoutKeys,
    });
    const workout = buildWorkoutWidgetSnapshot({
      signedIn: true,
      colorScheme: scheme,
      unavailable,
      todayKey,
      plans: plans.data ?? [],
      workouts: workouts.data ?? [],
    });
    const key = JSON.stringify({ daily, workout });
    if (key === lastKey.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastKey.current = key;
      void applyHomeScreenWidgetSnapshots({ daily, workout });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    isReady,
    userId,
    scheme,
    todayKey,
    locale,
    food.data,
    food.isLoading,
    food.isError,
    hydration.data,
    hydration.isLoading,
    hydration.isError,
    goal.data,
    goal.isLoading,
    profile.data,
    profile.isLoading,
    plans.data,
    plans.isLoading,
    plans.isError,
    workouts.data,
    workouts.isLoading,
    workouts.isError,
    activity.data,
    activity.isError,
    burned,
  ]);

  useEffect(() => {
    if (!homeScreenWidgetsAvailable()) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !userId) return;
      void queryClient.invalidateQueries({ queryKey: ['food-entries', userId] });
      void queryClient.invalidateQueries({ queryKey: ['hydration', userId] });
      void queryClient.invalidateQueries({ queryKey: ['goal', 'active', userId] });
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      void queryClient.invalidateQueries({ queryKey: ['plans', userId] });
      void queryClient.invalidateQueries({ queryKey: ['workouts', userId] });
      void queryClient.invalidateQueries({ queryKey: [DAILY_ACTIVITY_QUERY_KEY, userId] });
    });
    return () => sub.remove();
  }, [queryClient, userId]);

  return null;
}
