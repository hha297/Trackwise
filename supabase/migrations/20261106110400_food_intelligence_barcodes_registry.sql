-- Phase 2c: food_barcodes registry, sync triggers, backfill, unique indexes.
-- Unique indexes are transactional (non-CONCURRENTLY): current production scale is tiny.
-- For large future tables, use food-engine/phase2c-draft/ops/*_CONCURRENTLY.sql instead.

create table if not exists public.food_barcodes (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  barcode_raw text,
  barcode_normalized text not null,
  symbology text,
  is_primary boolean not null default false,
  scope text not null check (scope in ('catalog', 'user')),
  owner_user_id uuid references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint food_barcodes_scope_owner_chk check (
    (scope = 'catalog' and owner_user_id is null)
    or (scope = 'user' and owner_user_id is not null)
  ),
  constraint food_barcodes_normalized_nonempty_chk check (
    length(trim(barcode_normalized)) > 0
  )
);

create index if not exists food_barcodes_normalized_active_idx
  on public.food_barcodes (barcode_normalized)
  where is_active;

create index if not exists food_barcodes_food_id_idx
  on public.food_barcodes (food_id);

alter table public.food_barcodes enable row level security;

create or replace function public.food_barcodes_derive_from_food()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_archived_at timestamptz;
  v_catalog_status text;
  v_digits text;
begin
  select f.user_id, f.archived_at, f.catalog_status
    into v_user_id, v_archived_at, v_catalog_status
  from public.foods f
  where f.id = new.food_id;

  if not found then
    raise exception 'food_barcodes: parent food % not found', new.food_id;
  end if;

  if v_user_id is null then
    new.scope := 'catalog';
    new.owner_user_id := null;
  else
    new.scope := 'user';
    new.owner_user_id := v_user_id;
  end if;

  new.is_active := case
    when v_catalog_status = 'archived' then false
    when v_archived_at is not null then false
    else true
  end;

  if new.barcode_raw is not null then
    v_digits := regexp_replace(new.barcode_raw, '[^0-9]', '', 'g');
    if length(v_digits) > 0 then
      new.barcode_normalized := v_digits;
    end if;
  end if;

  if new.barcode_normalized is null or length(trim(new.barcode_normalized)) = 0 then
    raise exception 'food_barcodes: barcode_normalized empty';
  end if;

  return new;
end;
$$;

drop trigger if exists food_barcodes_derive_from_food on public.food_barcodes;
create trigger food_barcodes_derive_from_food
before insert or update of food_id, barcode_raw, barcode_normalized, scope, owner_user_id, is_active
on public.food_barcodes
for each row
execute function public.food_barcodes_derive_from_food();

create or replace function public.foods_sync_barcode_registry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    update public.food_barcodes b
    set
      scope = case when new.user_id is null then 'catalog' else 'user' end,
      owner_user_id = new.user_id,
      is_active = case
        when new.catalog_status = 'archived' then false
        when new.archived_at is not null then false
        else true
      end
    where b.food_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists foods_sync_barcode_registry on public.foods;
create trigger foods_sync_barcode_registry
after update of user_id, archived_at, catalog_status
on public.foods
for each row
execute function public.foods_sync_barcode_registry();

create or replace function public.food_barcodes_enforce_primary()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_food_id uuid;
  v_count integer;
  v_primary integer;
begin
  v_food_id := coalesce(new.food_id, old.food_id);
  select count(*), count(*) filter (where is_primary)
    into v_count, v_primary
  from public.food_barcodes
  where food_id = v_food_id;

  if v_count > 0 and v_primary <> 1 then
    raise exception 'food % must have exactly one primary barcode (have % barcodes, % primary)',
      v_food_id, v_count, v_primary;
  end if;
  return null;
end;
$$;

drop trigger if exists food_barcodes_enforce_primary_aiud on public.food_barcodes;
create constraint trigger food_barcodes_enforce_primary_aiud
after insert or update or delete on public.food_barcodes
deferrable initially deferred
for each row
execute function public.food_barcodes_enforce_primary();

-- Backfill (idempotent)
insert into public.food_barcodes (
  food_id, barcode_raw, barcode_normalized, is_primary, scope, owner_user_id, is_active
)
select
  f.id,
  f.barcode,
  regexp_replace(f.barcode, '[^0-9]', '', 'g'),
  true,
  case when f.user_id is null then 'catalog' else 'user' end,
  f.user_id,
  case
    when f.catalog_status = 'archived' then false
    when f.archived_at is not null then false
    else true
  end
from public.foods f
where f.barcode is not null
  and length(regexp_replace(f.barcode, '[^0-9]', '', 'g')) > 0
  and not exists (select 1 from public.food_barcodes b where b.food_id = f.id);

-- Flush deferred primary-barcode constraint triggers before any CREATE INDEX
-- (PostgreSQL forbids CREATE INDEX while trigger events are pending in the txn).
set constraints all immediate;

-- Abort if duplicates would break unique indexes (indexes created in next migration)
do $$
begin
  if exists (
    select 1
    from public.food_barcodes
    where scope = 'catalog' and is_active
    group by barcode_normalized
    having count(*) > 1
  ) then
    raise exception 'blocking catalog barcode duplicates — resolve before unique indexes';
  end if;

  if exists (
    select 1
    from public.food_barcodes
    where scope = 'user' and is_active
    group by owner_user_id, barcode_normalized
    having count(*) > 1
  ) then
    raise exception 'blocking user barcode duplicates — resolve before unique indexes';
  end if;
end $$;
