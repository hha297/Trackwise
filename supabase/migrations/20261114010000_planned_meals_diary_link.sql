-- Link planned_meals ↔ food_entries for explicit "Log to Diary".
-- Planning still never auto-creates diary rows; only log_planned_meal() does.
-- Ownership:
--   food_entries.planned_meal_id  = origin of the diary row (null if plan deleted)
--   planned_meals.logged_*        = denormalized status pointer (cleared if diary row deleted)

alter table public.food_entries
  add column if not exists planned_meal_id uuid references public.planned_meals (id) on delete set null;

alter table public.planned_meals
  add column if not exists logged_food_entry_id uuid references public.food_entries (id) on delete set null,
  add column if not exists logged_servings numeric(8, 2)
    check (logged_servings is null or logged_servings > 0),
  add column if not exists logged_at timestamptz;

create unique index if not exists food_entries_planned_meal_uidx
  on public.food_entries (planned_meal_id)
  where planned_meal_id is not null;

create unique index if not exists planned_meals_logged_entry_uidx
  on public.planned_meals (logged_food_entry_id)
  where logged_food_entry_id is not null;

create index if not exists food_entries_planned_meal_idx
  on public.food_entries (planned_meal_id)
  where planned_meal_id is not null;

comment on column public.food_entries.planned_meal_id is
  'Optional origin planned meal. Preserved as null when the plan is deleted so history stays.';
comment on column public.planned_meals.logged_food_entry_id is
  'Diary entry created by log_planned_meal. Cleared when that diary entry is deleted.';
comment on column public.planned_meals.logged_servings is
  'Actual servings logged to diary (may be less than planned servings).';

-- When a diary entry linked to a plan is deleted, return the plan to Planned.
create or replace function public.clear_planned_meal_log_on_entry_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.planned_meal_id is not null then
    update public.planned_meals
    set
      logged_food_entry_id = null,
      logged_servings = null,
      logged_at = null
    where id = old.planned_meal_id
      and logged_food_entry_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists food_entries_clear_planned_meal_log on public.food_entries;
create trigger food_entries_clear_planned_meal_log
  after delete on public.food_entries
  for each row
  execute function public.clear_planned_meal_log_on_entry_delete();

-- Keep logged_servings in sync when the user edits the diary amount/quantity.
create or replace function public.sync_planned_meal_logged_servings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_servings numeric;
begin
  if new.planned_meal_id is null then
    return new;
  end if;

  if new.amount is not null and new.amount > 0 and coalesce(new.amount_unit, 'serving') = 'serving' then
    next_servings := new.amount;
  elsif new.quantity is not null and new.quantity > 0 then
    next_servings := new.quantity;
  else
    return new;
  end if;

  update public.planned_meals
  set logged_servings = next_servings
  where id = new.planned_meal_id
    and logged_food_entry_id = new.id;

  return new;
end;
$$;

drop trigger if exists food_entries_sync_planned_meal_servings on public.food_entries;
create trigger food_entries_sync_planned_meal_servings
  after update of amount, amount_unit, quantity on public.food_entries
  for each row
  when (new.planned_meal_id is not null)
  execute function public.sync_planned_meal_logged_servings();

-- Atomic log: one food_entry per planned meal; hard-blocks duplicates.
create or replace function public.log_planned_meal(
  p_planned_meal_id uuid,
  p_actual_servings numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meal public.planned_meals%rowtype;
  entry_id uuid;
  factor numeric;
  req_id text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_actual_servings is null or p_actual_servings <= 0 then
    raise exception 'Servings must be positive.';
  end if;

  select * into meal
  from public.planned_meals
  where id = p_planned_meal_id
    and user_id = uid
  for update;

  if not found then
    raise exception 'Planned meal not found.';
  end if;

  if meal.logged_food_entry_id is not null then
    raise exception 'ALREADY_LOGGED';
  end if;

  if meal.servings is null or meal.servings <= 0 then
    raise exception 'Planned servings must be positive.';
  end if;

  factor := p_actual_servings / meal.servings;
  req_id := 'planned_meal:' || meal.id::text;

  begin
    insert into public.food_entries (
      user_id,
      food_id,
      logged_on,
      meal_type,
      quantity,
      food_name,
      brand,
      serving_label,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      amount,
      amount_unit,
      nutrition_basis,
      basis_amount,
      basis_unit,
      client_request_id,
      planned_meal_id
    ) values (
      uid,
      null,
      meal.plan_date,
      meal.meal_type,
      1,
      meal.title,
      null,
      trim(to_char(p_actual_servings, 'FM999999990.######')) || ' servings',
      round((meal.calories * factor)::numeric, 2),
      round((meal.protein_g * factor)::numeric, 2),
      round((meal.carbs_g * factor)::numeric, 2),
      round((meal.fat_g * factor)::numeric, 2),
      p_actual_servings,
      'serving',
      'serving',
      1,
      'serving',
      req_id,
      meal.id
    )
    returning id into entry_id;
  exception
    when unique_violation then
      raise exception 'ALREADY_LOGGED';
  end;

  update public.planned_meals
  set
    logged_food_entry_id = entry_id,
    logged_servings = p_actual_servings,
    logged_at = timezone('utc', now())
  where id = meal.id;

  return entry_id;
end;
$$;

revoke all on function public.log_planned_meal(uuid, numeric) from public;
grant execute on function public.log_planned_meal(uuid, numeric) to authenticated;

comment on function public.log_planned_meal(uuid, numeric) is
  'Creates one food_entry from a planned meal snapshot and marks the plan logged. Hard-blocks duplicates.';
