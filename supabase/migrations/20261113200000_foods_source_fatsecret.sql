-- Allow persisting FatSecret-sourced foods selected from provider search.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods
  add constraint foods_source_check
  check (source = any (array[
    'manual'::text,
    'open_food_facts'::text,
    'system'::text,
    'fineli'::text,
    'usda'::text,
    'fatsecret'::text
  ]));

comment on constraint foods_source_check on public.foods is
  'Food provenance: manual/system/catalog providers including usda + fatsecret + open_food_facts.';
