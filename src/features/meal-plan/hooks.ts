import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { weekDateKeys } from '@/features/diary/aggregations';
import { invalidateDailyActivityQueries } from '@/features/engagement/api';

import {
  createPlannedMeal,
  deletePlannedMeal,
  fetchPlannedMeals,
  updatePlannedMeal,
} from './api';
import { logPlannedMealToDiary } from './log-to-diary';
import type { PlannedMealInput } from './types';

export function usePlannedMealsInRange(fromDate: string, toDate: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['planned-meals', userId, fromDate, toDate],
    enabled: Boolean(userId) && Boolean(fromDate) && Boolean(toDate) && fromDate <= toDate,
    queryFn: () => fetchPlannedMeals(userId!, fromDate, toDate),
    staleTime: 30_000,
  });
}

export function useWeekPlannedMeals(anchorKey: string) {
  const week = weekDateKeys(anchorKey);
  return usePlannedMealsInRange(week[0]!, week[week.length - 1]!);
}

export function usePlannedMealsForDate(dateKey: string) {
  return usePlannedMealsInRange(dateKey, dateKey);
}

export function usePlannedMealMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const invalidatePlans = async () => {
    await queryClient.invalidateQueries({ queryKey: ['planned-meals', userId] });
  };

  const invalidateDiary = async (dateKey?: string) => {
    if (dateKey) {
      await queryClient.invalidateQueries({ queryKey: ['food-entries', userId, dateKey] });
    }
    await queryClient.invalidateQueries({ queryKey: ['food-entries', 'range', userId] });
  };

  const create = useMutation({
    mutationFn: (input: PlannedMealInput) => createPlannedMeal(userId!, input),
    onSuccess: invalidatePlans,
  });

  const update = useMutation({
    mutationFn: (input: { id: string } & PlannedMealInput) =>
      updatePlannedMeal(userId!, input.id, input),
    onSuccess: invalidatePlans,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlannedMeal(userId!, id),
    onSuccess: invalidatePlans,
  });

  const logToDiary = useMutation({
    mutationFn: (input: { plannedMealId: string; actualServings: number; dateKey: string }) =>
      logPlannedMealToDiary({
        plannedMealId: input.plannedMealId,
        actualServings: input.actualServings,
      }),
    onSuccess: async (_id, variables) => {
      await invalidatePlans();
      await invalidateDiary(variables.dateKey);
    },
  });

  return { create, update, remove, logToDiary };
}
