-- Explicit diary entry origin for UI classification (recipe vs scan vs plan vs food).
-- Do not infer kind from image_url or nutrition_basis.

alter table public.food_entries
  add column if not exists entry_source text
    check (
      entry_source is null
      or entry_source in (
        'planned_meal',
        'recipe',
        'scanned_product',
        'catalog',
        'manual'
      )
    ),
  add column if not exists recipe_id uuid
    references public.recipes (id) on delete set null;

create index if not exists food_entries_entry_source_idx
  on public.food_entries (user_id, entry_source)
  where entry_source is not null;

create index if not exists food_entries_recipe_id_idx
  on public.food_entries (recipe_id)
  where recipe_id is not null;

comment on column public.food_entries.entry_source is
  'Canonical origin: planned_meal | recipe | scanned_product | catalog | manual. Null = legacy/unknown.';
comment on column public.food_entries.recipe_id is
  'Optional recipe lineage for direct recipe logs. Cleared if recipe is deleted; diary macros stay.';

-- Backfill only when relationship is unambiguous.
update public.food_entries
set entry_source = 'planned_meal'
where planned_meal_id is not null
  and entry_source is null;

-- Keep log_planned_meal writing entry_source explicitly.
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
      planned_meal_id,
      entry_source,
      recipe_id
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
      meal.id,
      'planned_meal',
      meal.recipe_id
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

comment on function public.log_planned_meal(uuid, numeric) is
  'Creates one food_entry from a planned meal snapshot and marks the plan logged. Sets entry_source=planned_meal.';
