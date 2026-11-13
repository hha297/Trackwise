import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { weekDateKeys } from '@/features/diary/aggregations';

import { createPlan, deletePlan, fetchPlans, updatePlan, type PlannedWorkout } from './api';
import type { PlanKind } from './status';

export function usePlansInRange(fromDate: string, toDate: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['plans', userId, fromDate, toDate],
    enabled: Boolean(userId) && Boolean(fromDate) && Boolean(toDate) && fromDate <= toDate,
    queryFn: () => fetchPlans(userId!, fromDate, toDate),
  });
}

export function useWeekPlans(anchorKey: string) {
  const week = weekDateKeys(anchorKey);
  return usePlansInRange(week[0]!, week[week.length - 1]!);
}

export function usePlanMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['plans', userId] });
  };

  const create = useMutation({
    mutationFn: (input: {
      planDate: string;
      kind: PlanKind;
      templateId?: string | null;
      title?: string | null;
    }) => createPlan({ userId: userId!, ...input }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: {
      id: string;
      planDate: string;
      kind: PlanKind;
      templateId?: string | null;
      title?: string | null;
    }) => updatePlan({ userId: userId!, ...input }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePlan(userId!, id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export type { PlannedWorkout };
