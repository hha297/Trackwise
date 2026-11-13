-- Phase 1: weekly workout plans and hydration logs.
-- Existing workout, food, and measurement rows are not rewritten.

create table if not exists public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  kind text not null check (kind in ('workout', 'rest', 'recovery')),
  template_id uuid references public.workout_templates (id) on delete set null,
  title text,
  completed_workout_id uuid references public.workouts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (kind = 'workout' and template_id is not null)
    or (kind in ('rest', 'recovery') and template_id is null and completed_workout_id is null)
  )
);

create index if not exists planned_workouts_user_date_idx
  on public.planned_workouts (user_id, plan_date);

create unique index if not exists planned_workouts_one_rest_per_day
  on public.planned_workouts (user_id, plan_date)
  where kind in ('rest', 'recovery');

alter table public.planned_workouts enable row level security;

create policy "planned_workouts_select_own" on public.planned_workouts
  for select to authenticated using (auth.uid() = user_id);
create policy "planned_workouts_insert_own" on public.planned_workouts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "planned_workouts_update_own" on public.planned_workouts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planned_workouts_delete_own" on public.planned_workouts
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.hydration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists hydration_entries_user_day_idx
  on public.hydration_entries (user_id, logged_on);

alter table public.hydration_entries enable row level security;

create policy "hydration_entries_select_own" on public.hydration_entries
  for select to authenticated using (auth.uid() = user_id);
create policy "hydration_entries_insert_own" on public.hydration_entries
  for insert to authenticated with check (auth.uid() = user_id);
create policy "hydration_entries_update_own" on public.hydration_entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hydration_entries_delete_own" on public.hydration_entries
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.hydration_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_ml integer not null check (target_ml between 250 and 10000),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.hydration_targets enable row level security;

create policy "hydration_targets_select_own" on public.hydration_targets
  for select to authenticated using (auth.uid() = user_id);
create policy "hydration_targets_insert_own" on public.hydration_targets
  for insert to authenticated with check (auth.uid() = user_id);
create policy "hydration_targets_update_own" on public.hydration_targets
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "hydration_targets_delete_own" on public.hydration_targets
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.wipe_own_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.food_favorites where user_id = uid;
  delete from public.exercise_favorites where user_id = uid;
  delete from public.food_entries where user_id = uid;
  delete from public.foods where user_id = uid;
  delete from public.planned_workouts where user_id = uid;
  delete from public.hydration_entries where user_id = uid;
  delete from public.hydration_targets where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.workout_templates
  where user_id = uid and is_system = false;
  delete from public.exercises
  where user_id = uid and is_system = false;
  delete from public.body_measurements where user_id = uid;
  delete from public.goals where user_id = uid;
  delete from public.onboarding_progress where user_id = uid;

  update public.profiles
  set
    display_name = split_part(coalesce((select email from auth.users where id = uid), 'Trackwise'), '@', 1),
    height_cm = null,
    sex = null,
    birth_date = null,
    activity_level = null,
    onboarding_completed_at = null,
    avatar_url = null
  where id = uid;
end;
$$;

comment on function public.wipe_own_user_data() is
  'Deletes the caller''s Trackwise rows (food, workouts, plans, hydration, goals, measurements, custom catalog) and resets setup fields. Keeps auth.users, units, and preferences. Uses auth.uid() only.';

revoke all on function public.wipe_own_user_data() from public;
grant execute on function public.wipe_own_user_data() to authenticated;
