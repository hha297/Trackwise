import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { entriesToMacros, groupEntriesByDate } from '@/features/diary/aggregations';
import { useFoodEntriesInRange, useWorkoutsInRange } from '@/features/diary/hooks';
import type { FoodEntry } from '@/features/food/types';
import { unionActiveDayKeys } from '@/features/engagement/activity-days';
import { shiftDiaryDateKey, streakHistoryRange } from '@/features/engagement/dates';
import { useEngagementStreaks } from '@/features/engagement/hooks';
import { useActiveGoal } from '@/features/goals/hooks';
import { usePlansInRange } from '@/features/planner/hooks';
import { toDiaryDateKey } from '@/utils/date';

import {
  completedWorkoutDateKeys,
  lastMeaningfulActivityKey,
  overdueWorkoutPlans,
  summarizeTodayPlan,
} from './activity';
import {
  deleteDailyOverride,
  fetchDailyOverride,
  overrideQueryKey,
  upsertDailyOverride,
} from './api';
import { evaluateComeback } from './comeback';
import { resolveEffectiveCalorieTarget } from './flexible-goals';
import { deriveJourneyMilestones } from './milestones';
import {
  dismissedIdSet,
  loadCompanionPrefs,
  markComebackShown,
  markDismissed,
  markTipShown,
  saveCompanionPrefs,
} from './prefs';
import { proteinTargetFromGoal } from './protein-target';
import { companionDismissKey, selectCompanionSuggestion } from './select-companion';
import { matchContextualTips } from './tips';
import type { CompanionPrefs, CompanionSuggestion, DailyOverride } from './types';

export function useDailyOverride(dateKey: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: overrideQueryKey(userId, dateKey),
    enabled: Boolean(userId) && Boolean(dateKey),
    queryFn: () => fetchDailyOverride(userId!, dateKey),
  });
}

export function useDailyOverrideMutations(dateKey: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const upsert = useMutation({
    mutationFn: (input: { originalCalories: number; calories: number }) => {
      if (!userId) throw new Error('Sign in required.');
      return upsertDailyOverride({
        userId,
        dateKey,
        originalCalories: input.originalCalories,
        calories: input.calories,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daily-nutrition-override', userId] });
    },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Sign in required.');
      return deleteDailyOverride(userId, dateKey);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['daily-nutrition-override', userId] });
    },
  });

  return { upsert, remove };
}

export function useCompanionPrefs() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: ['companion-prefs', userId],
    enabled: Boolean(userId),
    queryFn: () => loadCompanionPrefs(userId!),
  });
  const queryClient = useQueryClient();

  const persist = useCallback(
    async (next: CompanionPrefs) => {
      if (!userId) return;
      await saveCompanionPrefs(userId, next);
      queryClient.setQueryData(['companion-prefs', userId], next);
    },
    [queryClient, userId],
  );

  return { ...query, persist, userId };
}

export function useTodayGuidance(input: {
  dateKey: string;
  todayKey?: string;
  entries: Pick<FoodEntry, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>[];
  workouts: { started_at: string; status?: string | null }[];
}) {
  const todayKey = input.todayKey ?? toDiaryDateKey();
  const goal = useActiveGoal();
  const prefs = useCompanionPrefs();
  const engagement = useEngagementStreaks(todayKey);
  const weekStart = shiftDiaryDateKey(todayKey, -6);
  const plans = usePlansInRange(weekStart, todayKey);
  const recentFood = useFoodEntriesInRange(shiftDiaryDateKey(todayKey, -13), todayKey);
  const calorieTarget = goal.data?.daily_calorie_target ?? null;

  const macros = useMemo(() => entriesToMacros(input.entries), [input.entries]);
  const completedToday = useMemo(
    () =>
      input.workouts.filter(
        (row) =>
          (row.status ?? 'completed') === 'completed' &&
          toDiaryDateKey(new Date(row.started_at)) === input.dateKey,
      ).length,
    [input.workouts, input.dateKey],
  );

  const lastActivity = useMemo(() => {
    if (!engagement.data) return null;
    return lastMeaningfulActivityKey({
      nutritionKeys: engagement.data.nutritionKeys,
      hydrationKeys: engagement.data.hydrationKeys,
      workoutKeys: engagement.data.workoutCompletedKeys,
    });
  }, [engagement.data]);

  const comeback = useMemo(
    () =>
      evaluateComeback({
        todayKey,
        lastMeaningfulActivityKey: lastActivity,
        previous: prefs.data?.comeback ?? null,
      }),
    [todayKey, lastActivity, prefs.data?.comeback],
  );

  const tips = useMemo(() => {
    if (!engagement.data) return [];
    const grouped = groupEntriesByDate(recentFood.data ?? []);
    const recentProteinDays = [...grouped.entries()].map(([dateKey, rows]) => {
      const macros = entriesToMacros(rows);
      return { dateKey, proteinG: macros.proteinG, calories: macros.calories };
    });
    return matchContextualTips({
      todayKey,
      proteinTargetG: proteinTargetFromGoal(goal.data),
      calorieTarget,
      recentProteinDays,
      nutritionKeys: engagement.data.nutritionKeys,
      workoutKeys: engagement.data.workoutCompletedKeys,
      unionKeys: unionActiveDayKeys(
        engagement.data.nutritionKeys,
        engagement.data.hydrationKeys,
        engagement.data.workoutCompletedKeys,
      ),
      overdueInWeek: overdueWorkoutPlans(plans.data ?? [], todayKey),
      tipsShown: prefs.data?.tipsShown ?? {},
    });
  }, [
    engagement.data,
    todayKey,
    goal.data,
    calorieTarget,
    plans.data,
    prefs.data?.tipsShown,
    recentFood.data,
  ]);

  const suggestion = useMemo(() => {
    if (input.dateKey !== todayKey) return null;
    if (comeback.eligible) return null;
    return selectCompanionSuggestion({
      todayKey,
      dateKey: input.dateKey,
      hasGoal: Boolean(goal.data),
      calorieTarget,
      originalCalorieTarget: calorieTarget,
      proteinTargetG: proteinTargetFromGoal(goal.data),
      consumedCalories: macros.calories,
      consumedProteinG: macros.proteinG,
      hasFoodLogsToday: input.entries.length > 0,
      completedWorkoutsToday: completedToday,
      todayPlan: summarizeTodayPlan(plans.data ?? [], todayKey),
      overduePlans: overdueWorkoutPlans(plans.data ?? [], todayKey),
      hasWorkoutHistory: (engagement.data?.workoutCompletedKeys.length ?? 0) > 0,
      lastMeaningfulActivityKey: lastActivity,
      dismissedIds: dismissedIdSet(prefs.data ?? { version: 1, dismissed: {}, comeback: null, tipsShown: {} }),
      tips,
    });
  }, [
    input.dateKey,
    input.entries.length,
    todayKey,
    comeback.eligible,
    goal.data,
    calorieTarget,
    macros,
    completedToday,
    plans.data,
    engagement.data,
    lastActivity,
    prefs.data,
    tips,
  ]);

  useEffect(() => {
    if (!suggestion || !prefs.userId || !prefs.data) return;
    if (!suggestion.id.includes('_') && suggestion.category !== 'tip') return;
    const tipIds = new Set([
      'protein_trend_low',
      'missed_sessions',
      'logging_gap',
      'restart_simple',
      'habit_streak',
    ]);
    if (!tipIds.has(suggestion.id)) return;
    if (prefs.data.tipsShown[suggestion.id] === todayKey) return;
    void prefs.persist(markTipShown(prefs.data, suggestion.id, todayKey));
  }, [suggestion, prefs, todayKey]);

  const dismiss = useCallback(
    async (item: CompanionSuggestion) => {
      if (!prefs.data) return;
      const key = companionDismissKey(item.id, todayKey);
      let next = markDismissed(prefs.data, key, todayKey);
      if (item.category === 'tip') next = markTipShown(next, item.id, todayKey);
      await prefs.persist(next);
    },
    [prefs, todayKey],
  );

  const dismissComeback = useCallback(async () => {
    if (!prefs.data || !comeback.lastActivityKey) return;
    await prefs.persist(markComebackShown(prefs.data, comeback.lastActivityKey, todayKey));
  }, [prefs, comeback.lastActivityKey, todayKey]);

  const loading =
    (goal.isLoading && !goal.data) ||
    (prefs.isLoading && !prefs.data) ||
    (engagement.isLoading && !engagement.data) ||
    (plans.isLoading && !plans.data);

  const error = goal.error ?? prefs.error ?? engagement.error ?? plans.error;

  return {
    todayKey,
    loading,
    error,
    suggestion,
    comeback,
    dismiss,
    dismissComeback,
    refetch: () => {
      void goal.refetch();
      void prefs.refetch();
      void plans.refetch();
    },
  };
}

export function useJourneyMilestones(todayKey: string = toDiaryDateKey()) {
  const goal = useActiveGoal();
  const range = useMemo(() => streakHistoryRange(todayKey), [todayKey]);
  const engagement = useEngagementStreaks(todayKey);
  const food = useFoodEntriesInRange(range.startKey, range.endKey);
  const workouts = useWorkoutsInRange(range.startKey, range.endKey);

  const milestones = useMemo(() => {
    if (!engagement.data) return [];
    const grouped = groupEntriesByDate(food.data ?? []);
    const nutritionDays = [...grouped.entries()].map(([dateKey, rows]) => {
      const macros = entriesToMacros(rows);
      return { dateKey, calories: macros.calories, hasFood: rows.length > 0 };
    });
    return deriveJourneyMilestones({
      todayKey,
      completedWorkoutKeys: completedWorkoutDateKeys(workouts.data ?? []),
      nutritionKeys: engagement.data.nutritionKeys,
      unionKeys: unionActiveDayKeys(
        engagement.data.nutritionKeys,
        engagement.data.hydrationKeys,
        engagement.data.workoutCompletedKeys,
      ),
      calorieTarget: goal.data?.daily_calorie_target ?? null,
      nutritionDays,
    });
  }, [engagement.data, food.data, workouts.data, goal.data, todayKey]);

  const loading =
    (engagement.isLoading && !engagement.data) ||
    (food.isLoading && !food.data) ||
    (workouts.isLoading && !workouts.data);

  const error = engagement.error ?? food.error ?? workouts.error ?? goal.error;

  return {
    milestones,
    loading,
    error,
    refetch: () => {
      void food.refetch();
      void workouts.refetch();
      void goal.refetch();
    },
  };
}

export function effectiveCaloriesForWidget(
  original: number | null | undefined,
  dateKey: string,
  override: DailyOverride | null | undefined,
): number | null {
  return resolveEffectiveCalorieTarget({ original, dateKey, override })?.effective ?? original ?? null;
}
