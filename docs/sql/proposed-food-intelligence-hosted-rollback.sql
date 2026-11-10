-- PROPOSED hosted rollback for Food Intelligence / Food Engine objects.
-- DO NOT APPLY automatically. Operator-controlled only after backup + review.
-- Goal: remove FE-only roles/tables/functions while preserving Trackwise app data.
--
-- NEVER truncate/drop: food_entries, food_favorites, profiles, auth.*, workouts,
-- measurements, or the pre-existing public.foods catalog rows/table itself.
--
-- Classification notes:
-- - Phase 4 migrations (2026110611*, 2026110712*) were recorded as applied on hosted.
-- - Phase 5.2–5.6 migrations were local-only; objects below may be absent on hosted.
-- - Additive foods.catalog_status (and related) may remain; dropping is optional and riskier.

begin;

-- ---------- FE-only tables (safe if unused by mobile/admin app code) ----------
drop table if exists public.food_nutrition_selection_events cascade;
drop table if exists public.food_nutrition_candidates cascade;
drop table if exists public.food_match_proposals cascade;
drop table if exists public.food_observation_links cascade;
drop table if exists public.food_source_observations cascade;
drop table if exists public.food_import_job_items cascade;
drop table if exists public.food_import_jobs cascade;
drop table if exists public.food_publication_events cascade;
drop table if exists public.food_images cascade;
-- food_names / food_servings / food_ingredients / food_barcodes:
-- inspect live FKs before drop; they were introduced for FI satellites.
-- If the original app never depended on them, drop after review:
-- drop table if exists public.food_ingredients cascade;
-- drop table if exists public.food_servings cascade;
-- drop table if exists public.food_names cascade;
-- drop table if exists public.food_barcodes cascade;

-- ---------- FE service RPCs / helpers ----------
drop function if exists public.publish_food_for_service(uuid, uuid, text);
drop function if exists public.unpublish_food_for_service(uuid, uuid, text);
drop function if exists public.archive_food_for_service(uuid, uuid, text);
drop function if exists public.publish_food_for_session(uuid, text);
drop function if exists public.unpublish_food_for_session(uuid, text);
drop function if exists public.archive_food_for_session(uuid, text);
drop function if exists public._food_apply_catalog_status(uuid, uuid, text, text, text);
drop function if exists public.food_engine_is_active_admin(uuid);

-- ---------- FE roles (after grants revoked / objects dropped) ----------
-- Reassign owned objects first if any remain.
-- reassign owned by food_engine_app to postgres;
-- reassign owned by food_engine_worker to postgres;
-- reassign owned by food_engine_admin to postgres;
-- drop role if exists food_engine_app;
-- drop role if exists food_engine_worker;
-- drop role if exists food_engine_admin;

-- ---------- Optional: reverse additive foods columns (HIGH RISK — review first) ----------
-- alter table public.foods drop constraint if exists foods_catalog_status_check;
-- alter table public.foods drop column if exists catalog_status;
-- alter table public.foods drop column if exists food_kind;
-- alter table public.foods drop column if exists published_at;
-- (confirm exact columns from 20261106110100 / 20261109120000 before running)

commit;
