-- Persistent daily activity for streaks.
-- A calendar day is earned when food, water, or a completed workout is saved.
-- Deleting those logs must not revoke the earned day.

create table if not exists public.user_daily_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  nutrition boolean not null default false,
  hydration boolean not null default false,
  workout boolean not null default false,
  streak_earned boolean generated always as (nutrition or hydration or workout) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, activity_date),
  constraint user_daily_activity_has_category check (nutrition or hydration or workout)
);

drop trigger if exists user_daily_activity_set_updated_at on public.user_daily_activity;
create trigger user_daily_activity_set_updated_at
  before update on public.user_daily_activity
  for each row execute function public.set_updated_at();

alter table public.user_daily_activity enable row level security;

drop policy if exists "user_daily_activity_select_own" on public.user_daily_activity;
create policy "user_daily_activity_select_own" on public.user_daily_activity
  for select to authenticated using (auth.uid() = user_id);

-- No insert/update/delete policies: clients cannot revoke earned days.
-- Writes go through SECURITY DEFINER helpers (and table-owner triggers).

create or replace function public.apply_user_daily_activity(
  p_user_id uuid,
  p_activity_date date,
  p_kind text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_activity_date is null then
    return;
  end if;
  if p_kind not in ('nutrition', 'hydration', 'workout') then
    raise exception 'Invalid daily activity kind';
  end if;

  insert into public.user_daily_activity (
    user_id,
    activity_date,
    nutrition,
    hydration,
    workout
  )
  values (
    p_user_id,
    p_activity_date,
    p_kind = 'nutrition',
    p_kind = 'hydration',
    p_kind = 'workout'
  )
  on conflict (user_id, activity_date) do update
    set
      nutrition = public.user_daily_activity.nutrition or excluded.nutrition,
      hydration = public.user_daily_activity.hydration or excluded.hydration,
      workout = public.user_daily_activity.workout or excluded.workout,
      updated_at = timezone('utc', now());
end;
$$;

comment on function public.apply_user_daily_activity(uuid, date, text) is
  'Idempotent earn of one category on one local calendar day. Never unsets flags.';

create or replace function public.record_own_daily_activity(
  p_kind text,
  p_activity_dates date[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d date;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_activity_dates is null then
    return;
  end if;

  foreach d in array p_activity_dates loop
    perform public.apply_user_daily_activity(uid, d, p_kind);
  end loop;
end;
$$;

comment on function public.record_own_daily_activity(text, date[]) is
  'Authenticated helper to earn daily activity for the caller on local calendar dates.';

revoke all on function public.apply_user_daily_activity(uuid, date, text) from public;
revoke all on function public.apply_user_daily_activity(uuid, date, text) from authenticated;
revoke all on function public.record_own_daily_activity(text, date[]) from public;
grant execute on function public.record_own_daily_activity(text, date[]) to authenticated;

create or replace function public.food_entries_record_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_user_daily_activity(new.user_id, new.logged_on, 'nutrition');
  return new;
end;
$$;

drop trigger if exists food_entries_record_daily_activity on public.food_entries;
create trigger food_entries_record_daily_activity
  after insert or update of logged_on on public.food_entries
  for each row execute function public.food_entries_record_daily_activity();

create or replace function public.hydration_entries_record_daily_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_user_daily_activity(new.user_id, new.logged_on, 'hydration');
  return new;
end;
$$;

drop trigger if exists hydration_entries_record_daily_activity on public.hydration_entries;
create trigger hydration_entries_record_daily_activity
  after insert or update of logged_on on public.hydration_entries
  for each row execute function public.hydration_entries_record_daily_activity();

-- Backfill from remaining logs so current streaks survive deploy.
-- Workout dates are local on the client (started_at timestamptz); those rows are
-- persisted from the app using toDiaryDateKey, not UTC slicing here.
insert into public.user_daily_activity (user_id, activity_date, nutrition, hydration, workout)
select user_id, logged_on, true, false, false
from public.food_entries
group by user_id, logged_on
on conflict (user_id, activity_date) do update
  set nutrition = true;

insert into public.user_daily_activity (user_id, activity_date, nutrition, hydration, workout)
select user_id, logged_on, false, true, false
from public.hydration_entries
group by user_id, logged_on
on conflict (user_id, activity_date) do update
  set hydration = true;

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

  delete from public.user_daily_activity where user_id = uid;
  delete from public.food_favorites where user_id = uid;
  delete from public.exercise_favorites where user_id = uid;
  delete from public.planned_meals where user_id = uid;
  delete from public.recipe_ingredients where user_id = uid;
  delete from public.recipes where user_id = uid;
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

comment on table public.user_daily_activity is
  'Earned local calendar days for streaks. Survives deletion of food, water, and workout logs. Removed with the auth user or wipe_own_user_data().';

comment on function public.wipe_own_user_data() is
  'Deletes the caller''s Trackwise rows (daily activity, food, recipes, meal plans, workouts, plans, hydration, goals, measurements, custom catalog) and resets setup fields. Keeps auth.users, units, and preferences. Uses auth.uid() only.';
