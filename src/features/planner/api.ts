import { getSupabase } from '@/lib/supabase/client';

import { canMarkPlanComplete, restDayConflict, type PlanKind } from './status';

export type PlannedWorkout = {
  id: string;
  planDate: string;
  kind: PlanKind;
  templateId: string | null;
  title: string | null;
  completedWorkoutId: string | null;
};

type PlanRow = {
  id: string;
  plan_date: string;
  kind: PlanKind;
  template_id: string | null;
  title: string | null;
  completed_workout_id: string | null;
};

function mapRow(row: PlanRow): PlannedWorkout {
  return {
    id: row.id,
    planDate: row.plan_date,
    kind: row.kind,
    templateId: row.template_id,
    title: row.title,
    completedWorkoutId: row.completed_workout_id,
  };
}

export async function fetchPlans(userId: string, fromDate: string, toDate: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('planned_workouts')
    .select('id, plan_date, kind, template_id, title, completed_workout_id')
    .eq('user_id', userId)
    .gte('plan_date', fromDate)
    .lte('plan_date', toDate)
    .order('plan_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PlanRow[]).map(mapRow);
}

export async function createPlan(input: {
  userId: string;
  planDate: string;
  kind: PlanKind;
  templateId?: string | null;
  title?: string | null;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const existing = await fetchPlans(input.userId, input.planDate, input.planDate);
  if (
    restDayConflict(
      existing.map((row) => ({ planDate: row.planDate, kind: row.kind })),
      { planDate: input.planDate, kind: input.kind },
    )
  ) {
    throw new Error('REST_DAY_EXISTS');
  }
  const { error } = await supabase.from('planned_workouts').insert({
    user_id: input.userId,
    plan_date: input.planDate,
    kind: input.kind,
    template_id: input.kind === 'workout' ? input.templateId ?? null : null,
    title: input.title ?? null,
  });
  if (error) throw error;
}

export async function updatePlan(input: {
  userId: string;
  id: string;
  planDate: string;
  kind: PlanKind;
  templateId?: string | null;
  title?: string | null;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('planned_workouts')
    .update({
      plan_date: input.planDate,
      kind: input.kind,
      template_id: input.kind === 'workout' ? input.templateId ?? null : null,
      title: input.title ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .eq('user_id', input.userId)
    .is('completed_workout_id', null);
  if (error) throw error;
}

export async function deletePlan(userId: string, id: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('planned_workouts').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function linkPlanToWorkout(input: {
  userId: string;
  planDate: string;
  templateId: string;
  workoutId: string;
}) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from('planned_workouts')
    .select('id, completed_workout_id')
    .eq('user_id', input.userId)
    .eq('plan_date', input.planDate)
    .eq('template_id', input.templateId)
    .eq('kind', 'workout')
    .is('completed_workout_id', null)
    .limit(1);
  if (error || !data?.length) return;
  const row = data[0] as { id: string; completed_workout_id: string | null };
  if (!canMarkPlanComplete(row.completed_workout_id)) return;
  await supabase
    .from('planned_workouts')
    .update({
      completed_workout_id: input.workoutId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('user_id', input.userId)
    .is('completed_workout_id', null);
}
