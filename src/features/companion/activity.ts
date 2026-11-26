import { unionActiveDayKeys } from '@/features/engagement/activity-days';
import { planStatus, type PlanKind } from '@/features/planner/status';
import { toDiaryDateKey } from '@/utils/date';

import { maxDiaryDateKey } from './dates';
import type { OverduePlanSummary, TodayPlanSummary } from './types';

export function lastMeaningfulActivityKey(input: {
  nutritionKeys: Iterable<string>;
  hydrationKeys: Iterable<string>;
  workoutKeys: Iterable<string>;
}): string | null {
  return maxDiaryDateKey(
    unionActiveDayKeys(input.nutritionKeys, input.hydrationKeys, input.workoutKeys),
  );
}

export function completedWorkoutDateKeys(
  workouts: { started_at: string; status?: string | null }[],
): string[] {
  return workouts
    .filter((row) => (row.status ?? 'completed') === 'completed')
    .map((row) => toDiaryDateKey(new Date(row.started_at)))
    .sort();
}

export function summarizeTodayPlan(
  plans: {
    planDate: string;
    kind: PlanKind;
    title: string | null;
    completedWorkoutId: string | null;
  }[],
  todayKey: string,
): TodayPlanSummary | null {
  const todayPlans = plans.filter((plan) => plan.planDate === todayKey);
  const workout = todayPlans.find((plan) => plan.kind === 'workout');
  if (workout) {
    return {
      kind: 'workout',
      title: workout.title,
      completedWorkoutId: workout.completedWorkoutId,
    };
  }
  const rest = todayPlans.find((plan) => plan.kind === 'rest' || plan.kind === 'recovery');
  if (!rest) return null;
  return {
    kind: rest.kind,
    title: rest.title,
    completedWorkoutId: rest.completedWorkoutId,
  };
}

export function overdueWorkoutPlans(
  plans: {
    planDate: string;
    kind: PlanKind;
    title: string | null;
    completedWorkoutId: string | null;
  }[],
  todayKey: string,
): OverduePlanSummary[] {
  return plans
    .filter((plan) => plan.kind === 'workout')
    .filter(
      (plan) =>
        planStatus({
          kind: plan.kind,
          planDate: plan.planDate,
          todayKey,
          completedWorkoutId: plan.completedWorkoutId,
        }) === 'missed',
    )
    .map((plan) => ({ planDate: plan.planDate, title: plan.title }))
    .sort((a, b) => a.planDate.localeCompare(b.planDate));
}
