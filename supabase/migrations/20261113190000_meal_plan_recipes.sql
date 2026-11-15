-- Phase 2 Group 3: user recipes + planned meals (separate from planned_workouts).
-- Planned meals snapshot recipe name/macros so later recipe edits do not rewrite plans.
-- Planning never writes food_entries.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  instructions text,
  servings numeric(8, 2) not null default 1 check (servings > 0),
  image_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists recipes_user_updated_idx
  on public.recipes (user_id, updated_at desc);

create index if not exists recipes_user_name_idx
  on public.recipes (user_id, lower(name));

alter table public.recipes enable row level security;

create policy "recipes_select_own" on public.recipes
  for select to authenticated using (auth.uid() = user_id);
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "recipes_update_own" on public.recipes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null check (char_length(trim(food_name)) between 1 and 160),
  brand text,
  amount numeric(12, 3) not null check (amount > 0),
  amount_unit text not null check (amount_unit in ('g', 'ml', 'serving')),
  nutrition_basis text not null check (nutrition_basis in ('per100', 'serving')),
  basis_amount numeric(12, 3),
  basis_unit text check (basis_unit is null or basis_unit in ('g', 'ml', 'serving')),
  serving_grams numeric(12, 3),
  -- Nutrition for the declared basis (per 100 g/ml or per 1 serving), snapshotted at add/edit.
  calories numeric(12, 3) not null default 0,
  protein_g numeric(12, 3) not null default 0,
  carbs_g numeric(12, 3) not null default 0,
  fat_g numeric(12, 3) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists recipe_ingredients_recipe_position_idx
  on public.recipe_ingredients (recipe_id, position);

create index if not exists recipe_ingredients_user_idx
  on public.recipe_ingredients (user_id);

alter table public.recipe_ingredients enable row level security;

create policy "recipe_ingredients_select_own" on public.recipe_ingredients
  for select to authenticated using (auth.uid() = user_id);
create policy "recipe_ingredients_insert_own" on public.recipe_ingredients
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  );
create policy "recipe_ingredients_update_own" on public.recipe_ingredients
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = auth.uid()
    )
  );
create policy "recipe_ingredients_delete_own" on public.recipe_ingredients
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists recipe_ingredients_set_updated_at on public.recipe_ingredients;
create trigger recipe_ingredients_set_updated_at
  before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

create table if not exists public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snacks')),
  recipe_id uuid references public.recipes (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  notes text,
  servings numeric(8, 2) not null default 1 check (servings > 0),
  -- Snapshot macros for the planned servings total (not diary consumption).
  calories numeric(12, 3) not null default 0,
  protein_g numeric(12, 3) not null default 0,
  carbs_g numeric(12, 3) not null default 0,
  fat_g numeric(12, 3) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists planned_meals_user_date_idx
  on public.planned_meals (user_id, plan_date);

create index if not exists planned_meals_user_recipe_idx
  on public.planned_meals (user_id, recipe_id);

alter table public.planned_meals enable row level security;

create policy "planned_meals_select_own" on public.planned_meals
  for select to authenticated using (auth.uid() = user_id);
create policy "planned_meals_insert_own" on public.planned_meals
  for insert to authenticated with check (auth.uid() = user_id);
create policy "planned_meals_update_own" on public.planned_meals
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planned_meals_delete_own" on public.planned_meals
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists planned_meals_set_updated_at on public.planned_meals;
create trigger planned_meals_set_updated_at
  before update on public.planned_meals
  for each row execute function public.set_updated_at();

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
  'Deletes the caller''s Trackwise rows (food, recipes, meal plans, workouts, plans, hydration, goals, measurements, custom catalog) and resets setup fields. Keeps auth.users, units, and preferences. Uses auth.uid() only.';

comment on table public.recipes is
  'User-owned recipe templates. Live ingredient rows; nutrition is derived in the app.';
comment on table public.planned_meals is
  'User meal plans by local calendar date. Snapshots title/macros; does not create food_entries.';
