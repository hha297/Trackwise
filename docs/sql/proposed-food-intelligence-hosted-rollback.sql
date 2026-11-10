-- APPLIED on hosted Trackwise (xdslsulhgknbocvbnufl) via forward migration:
--   supabase/migrations/20261110214000_rollback_food_intelligence_objects.sql
-- Kept here as the reviewed operator script / audit copy.
--
-- Goal: remove FE-only roles/tables/functions while preserving Trackwise app data.
--
-- NEVER truncate/drop: food_entries, food_favorites, profiles, auth.*, workouts,
-- measurements, or the pre-existing public.foods catalog rows/table itself.
--
-- Classification notes:
-- - Phase 4 migrations (2026110611*, 2026110712*) remain in migration history.
-- - Phase 5.2–5.6 objects may be absent on hosted (DROP IF EXISTS).
-- - Additive foods.catalog_status / published_at / projection_locked left dormant.
-- - foods_sync_catalog_mirrors / foods_enforce_catalog_lifecycle triggers kept
--   (Admin catalog soft-archive compatibility); worker-role branches are inert.

begin;

drop trigger if exists foods_sync_barcode_registry on public.foods;
drop function if exists public.foods_sync_barcode_registry();

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

-- Roles dropped in migration DO block (reassign + drop owned + drop role).

-- Optional HIGH RISK (not applied): drop foods.catalog_status / published_at /
-- projection_locked after confirming Admin/mobile ignore them.

commit;
