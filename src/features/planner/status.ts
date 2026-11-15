export type PlanKind = 'workout' | 'rest' | 'recovery';

export type PlanStatus = 'completed' | 'upcoming' | 'missed' | 'today' | 'rest';

export function planStatus(input: {
  kind: PlanKind;
  planDate: string;
  todayKey: string;
  completedWorkoutId: string | null;
}): PlanStatus {
  if (input.completedWorkoutId) return 'completed';
  if (input.kind === 'rest' || input.kind === 'recovery') return 'rest';
  if (input.planDate > input.todayKey) return 'upcoming';
  if (input.planDate < input.todayKey) return 'missed';
  return 'today';
}

export function canMarkPlanComplete(completedWorkoutId: string | null): boolean {
  return completedWorkoutId == null;
}

/** A day may have several workouts, but only one rest or recovery row. */
export function restDayConflict(
  existing: { planDate: string; kind: PlanKind }[],
  next: { planDate: string; kind: PlanKind },
): boolean {
  if (next.kind === 'workout') return false;
  return existing.some((row) => row.planDate === next.planDate && row.kind !== 'workout');
}
