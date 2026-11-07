-- Phase 2b: Food Engine least-privilege roles (idempotent).
-- No BYPASSRLS. LOGIN without password — set password via Dashboard/secret store before app DSN use.
-- SET ROLE works for verification without LOGIN password.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'food_engine_app') then
    create role food_engine_app nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'food_engine_worker') then
    create role food_engine_worker nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'food_engine_admin') then
    create role food_engine_admin nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;

alter role food_engine_app nobypassrls;
alter role food_engine_worker nobypassrls;
alter role food_engine_admin nobypassrls;

comment on role food_engine_app is 'Trackwise Food Engine HTTP API — published catalog + observation insert';
comment on role food_engine_worker is 'Trackwise Food Engine ingest — draft/pending only';
comment on role food_engine_admin is 'Trackwise Food Engine admin path — service publish RPCs';
