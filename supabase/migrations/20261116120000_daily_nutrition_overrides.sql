-- Temporary same-day nutrition target adjustments.
-- Does not change goals.daily_calorie_target (long-term settings stay intact).
-- Date is the user's local diary day (yyyy-MM-dd), same as food_entries.logged_on.

create table if not exists public.daily_nutrition_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  override_date date not null,
  calories integer not null check (calories between 1200 and 6000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, override_date)
);

create index if not exists daily_nutrition_overrides_user_date_idx
  on public.daily_nutrition_overrides (user_id, override_date desc);

alter table public.daily_nutrition_overrides enable row level security;

create policy "daily_nutrition_overrides_select_own"
  on public.daily_nutrition_overrides
  for select to authenticated
  using (auth.uid() = user_id);

create policy "daily_nutrition_overrides_insert_own"
  on public.daily_nutrition_overrides
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "daily_nutrition_overrides_update_own"
  on public.daily_nutrition_overrides
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_nutrition_overrides_delete_own"
  on public.daily_nutrition_overrides
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.daily_nutrition_overrides is
  'Same-day calorie target adjustments. Unique per user+date. Removed with the auth user or wipe_own_user_data().';

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

  delete from public.daily_nutrition_overrides where user_id = uid;
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

comment on function public.wipe_own_user_data() is
  'Deletes the caller''s Trackwise rows (auth.uid()). Keeps the Auth user. Includes daily_nutrition_overrides.';
