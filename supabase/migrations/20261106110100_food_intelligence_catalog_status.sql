-- Phase 2c: catalog lifecycle on public.foods (canonical root).
-- Does NOT tighten foods_select_visible (keeps existing mobile visibility).

alter table public.foods
  add column if not exists catalog_status text,
  add column if not exists published_at timestamptz,
  add column if not exists projection_locked boolean not null default false;

alter table public.foods drop constraint if exists foods_catalog_status_check;
alter table public.foods
  add constraint foods_catalog_status_check
  check (
    catalog_status is null
    or catalog_status in (
      'draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'
    )
  );

comment on column public.foods.catalog_status is
  'Canonical lifecycle for null-owner catalog foods. Null/ignored for user-owned foods.';
comment on column public.foods.published_at is
  'Set when catalog_status transitions to published.';
comment on column public.foods.projection_locked is
  'When true, automated ingest must not overwrite published projection.';

-- Backfill legacy null-owner rows
update public.foods
set
  catalog_status = case when archived_at is not null then 'archived' else 'published' end,
  published_at = coalesce(
    published_at,
    case when archived_at is null then created_at else null end
  ),
  is_public = case when archived_at is not null then false else true end
where user_id is null
  and catalog_status is null;

-- Mirror sync + Admin archived_at compatibility
create or replace function public.foods_sync_catalog_mirrors()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null then
    return new;
  end if;

  -- New Admin/system inserts without status → published (legacy Admin UX)
  if tg_op = 'INSERT' and new.catalog_status is null then
    new.catalog_status := 'published';
  end if;

  -- Admin soft-archive / restore via archived_at (existing Admin path)
  if tg_op = 'UPDATE' then
    if new.archived_at is not null
       and (old.archived_at is null)
       and new.catalog_status is distinct from 'archived' then
      new.catalog_status := 'archived';
    elsif new.archived_at is null
          and old.archived_at is not null
          and new.catalog_status = 'archived' then
      new.catalog_status := 'approved';
    end if;
  end if;

  if new.catalog_status is null then
    raise exception 'catalog foods require catalog_status';
  end if;

  if new.catalog_status = 'published' then
    new.is_public := true;
    new.archived_at := null;
    if new.published_at is null then
      new.published_at := timezone('utc', now());
    end if;
  elsif new.catalog_status = 'archived' then
    new.is_public := false;
    if new.archived_at is null then
      new.archived_at := timezone('utc', now());
    end if;
  else
    new.is_public := false;
    new.archived_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists foods_sync_catalog_mirrors on public.foods;
create trigger foods_sync_catalog_mirrors
before insert or update of catalog_status, user_id, is_public, archived_at, published_at
on public.foods
for each row
execute function public.foods_sync_catalog_mirrors();

create or replace function public.foods_enforce_catalog_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old text;
  v_new text;
  v_ok boolean := false;
begin
  if current_user = 'food_engine_worker' then
    if new.user_id is not null then
      raise exception 'food_engine_worker cannot mutate user-owned foods';
    end if;
    if tg_op = 'UPDATE' and old.catalog_status in ('approved', 'published', 'archived') then
      raise exception 'food_engine_worker cannot mutate approved/published/archived foods';
    end if;
    if new.catalog_status is distinct from 'draft'
       and new.catalog_status is distinct from 'pending_review' then
      raise exception 'food_engine_worker cannot set catalog_status=%', new.catalog_status;
    end if;
    if tg_op = 'UPDATE' then
      if new.is_public is distinct from old.is_public
         or new.published_at is distinct from old.published_at
         or new.archived_at is distinct from old.archived_at
         or new.projection_locked is distinct from old.projection_locked
         or new.user_id is distinct from old.user_id then
        raise exception 'food_engine_worker cannot change publication-sensitive columns';
      end if;
    end if;
  end if;

  if new.user_id is null and tg_op = 'UPDATE'
     and old.catalog_status is distinct from new.catalog_status then
    v_old := old.catalog_status;
    v_new := new.catalog_status;
    v_ok :=
      (v_old = 'draft' and v_new in ('pending_review', 'rejected', 'archived'))
      or (v_old = 'pending_review' and v_new in ('approved', 'rejected', 'draft', 'archived'))
      or (v_old = 'approved' and v_new in ('published', 'rejected', 'draft', 'archived'))
      or (v_old = 'published' and v_new in ('archived', 'approved'))
      or (v_old = 'rejected' and v_new in ('draft', 'pending_review', 'archived'))
      or (v_old = 'archived' and v_new in ('draft', 'pending_review', 'approved'))
      or (v_new = 'archived');
    if not v_ok then
      raise exception 'invalid catalog_status transition % -> %', v_old, v_new;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists foods_enforce_catalog_lifecycle on public.foods;
create trigger foods_enforce_catalog_lifecycle
before insert or update on public.foods
for each row
execute function public.foods_enforce_catalog_lifecycle();

create index if not exists foods_catalog_status_idx
  on public.foods (catalog_status)
  where user_id is null;
