-- Forward rollback: remove Food Intelligence / Food Engine schema objects.
-- Preserves: public.foods rows, food_entries, food_favorites, profiles, auth,
-- workouts, measurements, and other pre-FI Trackwise data.
-- Leaves additive foods.catalog_status / published_at / projection_locked columns
-- in place (dormant); dropping them is a separate high-risk decision.

-- Barcode sync trigger depends on food_barcodes; drop before satellite tables.
drop trigger if exists foods_sync_barcode_registry on public.foods;
drop function if exists public.foods_sync_barcode_registry();

-- FE-only / satellite tables (order respects FKs; IF EXISTS for partial deploys)
drop table if exists public.food_nutrition_selection_events cascade;
drop table if exists public.food_nutrition_candidates cascade;
drop table if exists public.food_match_proposals cascade;
drop table if exists public.food_observation_links cascade;
drop table if exists public.food_source_observation_processing cascade;
drop table if exists public.food_import_job_items cascade;
drop table if exists public.food_import_jobs cascade;
drop table if exists public.food_publication_events cascade;
drop table if exists public.food_images cascade;
drop table if exists public.food_nutrition_facts cascade;
drop table if exists public.food_ingredients cascade;
drop table if exists public.food_servings cascade;
drop table if exists public.food_names cascade;
drop table if exists public.food_barcodes cascade;
drop table if exists public.food_source_observations cascade;

-- FE service / session RPCs and helpers
drop function if exists public.publish_food_for_service(uuid, uuid, text);
drop function if exists public.unpublish_food_for_service(uuid, uuid, text);
drop function if exists public.archive_food_for_service(uuid, uuid, text);
drop function if exists public.publish_food_for_session(uuid, text);
drop function if exists public.unpublish_food_for_session(uuid, text);
drop function if exists public.archive_food_for_session(uuid, text);
drop function if exists public._food_apply_catalog_status(uuid, uuid, text, text, text);
drop function if exists public.food_engine_is_active_admin(uuid);
drop function if exists public.food_barcodes_derive_from_food();
drop function if exists public.food_barcodes_enforce_primary();

-- FE DB roles (Railway/service pool users). Safe after object drops.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'food_engine_app') then
    execute 'reassign owned by food_engine_app to postgres';
    execute 'drop owned by food_engine_app';
    execute 'drop role food_engine_app';
  end if;
  if exists (select 1 from pg_roles where rolname = 'food_engine_worker') then
    execute 'reassign owned by food_engine_worker to postgres';
    execute 'drop owned by food_engine_worker';
    execute 'drop role food_engine_worker';
  end if;
  if exists (select 1 from pg_roles where rolname = 'food_engine_admin') then
    execute 'reassign owned by food_engine_admin to postgres';
    execute 'drop owned by food_engine_admin';
    execute 'drop role food_engine_admin';
  end if;
end
$$;
