import { workoutDurationMinutes } from '@/features/diary/aggregations';
import type { PlannedWorkout } from '@/features/planner/api';
import { planStatus } from '@/features/planner/status';
import type { WorkoutListItem } from '@/features/workout/types';
import i18n from '@/i18n';
import { toDiaryDateKey } from '@/utils/date';

import {
  UNSIGNED_WORKOUT_WIDGET_PROPS,
  WORKOUT_WIDGET_OPEN_URL,
  resolveWidgetColorScheme,
  type WidgetColorScheme,
  type WorkoutWidgetProps,
} from './models';

export type WorkoutSnapshotInput = {
  signedIn: boolean;
  colorScheme?: WidgetColorScheme;
  unavailable?: boolean;
  todayKey?: string;
  plans?: PlannedWorkout[];
  workouts?: WorkoutListItem[];
};

function durationLabel(workout: WorkoutListItem | null): string {
  if (!workout) return '';
  const fromActive =
    workout.active_duration_sec != null && workout.active_duration_sec > 0
      ? Math.max(1, Math.round(workout.active_duration_sec / 60))
      : 0;
  const fromRange = workout.ended_at ? workoutDurationMinutes(workout) : 0;
  const minutes = fromActive > 0 ? fromActive : fromRange;
  if (!(minutes > 0)) return '';
  return i18n.t('widgets.durationMin', { count: minutes });
}

export function buildWorkoutWidgetSnapshot(input: WorkoutSnapshotInput): WorkoutWidgetProps {
  const colorScheme = resolveWidgetColorScheme(input.colorScheme);
  if (!input.signedIn) {
    return {
      ...UNSIGNED_WORKOUT_WIDGET_PROPS,
      colorScheme,
      title: i18n.t('widgets.workoutTitle'),
      headline: i18n.t('widgets.workoutName'),
      hint: i18n.t('widgets.signInWorkout'),
    };
  }

  if (input.unavailable) {
    return {
      ...UNSIGNED_WORKOUT_WIDGET_PROPS,
      signedIn: true,
      colorScheme,
      title: i18n.t('widgets.workoutTitle'),
      headline: i18n.t('widgets.workoutName'),
      hint: i18n.t('widgets.unavailable'),
    };
  }

  const todayKey = input.todayKey ?? toDiaryDateKey();
  const todayPlans = (input.plans ?? []).filter((plan) => plan.planDate === todayKey);
  const restPlan = todayPlans.find((plan) => plan.kind === 'rest' || plan.kind === 'recovery');
  const workoutPlans = todayPlans.filter((plan) => plan.kind === 'workout');
  const completedWorkouts = (input.workouts ?? []).filter(
    (row) => (row.status ?? 'completed') === 'completed',
  );
  const leadCompleted = completedWorkouts[0] ?? null;
  const leadPlan =
    workoutPlans.find((plan) => plan.completedWorkoutId) ?? workoutPlans[0] ?? null;

  if (leadCompleted || leadPlan) {
    const completed = Boolean(leadCompleted || leadPlan?.completedWorkoutId);
    const headline =
      leadCompleted?.name?.trim() ||
      leadPlan?.title?.trim() ||
      i18n.t('widgets.workoutName');
    return {
      signedIn: true,
      colorScheme,
      title: i18n.t('widgets.workoutTitle'),
      headline,
      statusLabel: completed ? i18n.t('widgets.completed') : i18n.t('widgets.scheduled'),
      detail: durationLabel(leadCompleted),
      hasSession: true,
      completed,
      hint: '',
      openUrl: leadCompleted
        ? `trackwise:///workout/${leadCompleted.id}`
        : WORKOUT_WIDGET_OPEN_URL,
    };
  }

  if (restPlan) {
    const status = planStatus({
      kind: restPlan.kind,
      planDate: restPlan.planDate,
      todayKey,
      completedWorkoutId: restPlan.completedWorkoutId,
    });
    return {
      signedIn: true,
      colorScheme,
      title: i18n.t('widgets.workoutTitle'),
      headline:
        restPlan.kind === 'recovery' ? i18n.t('widgets.recoveryDay') : i18n.t('widgets.restDay'),
      statusLabel: status === 'rest' ? i18n.t('widgets.restDay') : i18n.t('widgets.scheduled'),
      detail: '',
      hasSession: true,
      completed: false,
      hint: '',
      openUrl: WORKOUT_WIDGET_OPEN_URL,
    };
  }

  return {
    signedIn: true,
    colorScheme,
    title: i18n.t('widgets.workoutTitle'),
    headline: i18n.t('widgets.noWorkout'),
    statusLabel: '',
    detail: '',
    hasSession: false,
    completed: false,
    hint: i18n.t('widgets.noWorkoutHint'),
    openUrl: WORKOUT_WIDGET_OPEN_URL,
  };
}
