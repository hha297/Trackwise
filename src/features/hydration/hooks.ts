import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { weekDateKeys } from '@/features/diary/aggregations';

import { addHydration, deleteHydration, fetchHydration, setHydrationTarget, updateHydration } from './api';

export function useHydrationInRange(fromDate: string, toDate: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['hydration', userId, fromDate, toDate],
    enabled: Boolean(userId) && Boolean(fromDate) && Boolean(toDate) && fromDate <= toDate,
    queryFn: () => fetchHydration(userId!, fromDate, toDate),
  });
}

export function useHydration(dateKey: string) {
  const week = weekDateKeys(dateKey);
  return useHydrationInRange(week[0]!, week[week.length - 1]!);
}

export function useHydrationMutations(dateKey: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['hydration', userId] });
  };

  const add = useMutation({
    mutationFn: (amountMl: number) => addHydration(userId!, dateKey, amountMl),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; amountMl: number }) =>
      updateHydration(userId!, input.id, input.amountMl),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteHydration(userId!, id),
    onSuccess: invalidate,
  });
  const target = useMutation({
    mutationFn: (targetMl: number) => setHydrationTarget(userId!, targetMl),
    onSuccess: invalidate,
  });

  return { add, update, remove, target };
}
