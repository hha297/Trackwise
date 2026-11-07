-- DRAFT ONLY — Phase 2c Food Intelligence
-- Purpose: Engine role policies + GRANT/REVOKE matrix (B1/B3).
-- PREREQUISITE: Phase 2b roles must exist:
--   food_engine_app, food_engine_worker, food_engine_admin
--   (see ../ops/20261106100000_fi_create_engine_roles.sql)
-- UNVERIFIED vs production: current GRANT ACLs (Phase 2a.1 gap). Run \dp before apply.
-- This file does NOT create roles (ops script does). It fails closed if roles missing.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'food_engine_app')
     or not exists (select 1 from pg_roles where rolname = 'food_engine_worker')
     or not exists (select 1 from pg_roles where rolname = 'food_engine_admin') then
    raise exception 'Phase 2b roles missing — create food_engine_* before applying grants';
  end if;
end $$;

-- ---------- schema usage ----------
grant usage on schema public to food_engine_app, food_engine_worker, food_engine_admin;

-- ---------- hard deny diary ----------
revoke all on table public.food_entries from food_engine_app, food_engine_worker, food_engine_admin;
revoke all on table public.food_favorites from food_engine_app, food_engine_worker, food_engine_admin;

-- ---------- no direct user_roles / profiles table access for engine ----------
revoke all on table public.user_roles from food_engine_app, food_engine_worker, food_engine_admin;
revoke all on table public.profiles from food_engine_app, food_engine_worker, food_engine_admin;

grant execute on function public.food_engine_is_active_admin(uuid)
  to food_engine_app, food_engine_admin;
revoke execute on function public.food_engine_is_active_admin(uuid)
  from food_engine_worker;

-- ---------- foods: app = published select only (enforced also by RLS) ----------
revoke all on table public.foods from food_engine_app, food_engine_worker, food_engine_admin;

grant select on table public.foods to food_engine_app;
grant select, insert on table public.foods to food_engine_worker;
grant select, insert, update on table public.foods to food_engine_admin;

-- Column privileges for worker (B3) — publication-sensitive excluded
revoke update on table public.foods from food_engine_worker;
grant update (
  name, brand, barcode, serving_label, serving_grams,
  calories, protein_g, carbs_g, fat_g, source, image_url,
  nutrition_basis, basis_unit, basis_amount, nutrition_user_edited,
  catalog_status
) on table public.foods to food_engine_worker;

-- Worker insert columns (cannot set user_id to non-null usefully; trigger blocks user-owned)
-- Note: INSERT column lists are advisory with GRANT INSERT; trigger enforces lifecycle.

-- ---------- satellites: SELECT for app (published via RLS); worker draft write ----------
grant select on table public.food_barcodes to food_engine_app;
grant select, insert, update on table public.food_barcodes to food_engine_worker;
grant select, insert, update, delete on table public.food_barcodes to food_engine_admin;

grant select on table public.food_names to food_engine_app;
grant select, insert, update on table public.food_names to food_engine_worker;
grant select, insert, update, delete on table public.food_names to food_engine_admin;

grant select on table public.food_servings to food_engine_app;
grant select, insert, update on table public.food_servings to food_engine_worker;
grant select, insert, update, delete on table public.food_servings to food_engine_admin;

grant select on table public.food_ingredients to food_engine_app;
grant select, insert, update on table public.food_ingredients to food_engine_worker;
grant select, insert, update, delete on table public.food_ingredients to food_engine_admin;

grant select on table public.food_images to food_engine_app;
grant select, insert, update on table public.food_images to food_engine_worker;
grant select, insert, update, delete on table public.food_images to food_engine_admin;

grant select on table public.food_nutrition_facts to food_engine_app;
grant select, insert, update on table public.food_nutrition_facts to food_engine_worker;
grant select, insert, update, delete on table public.food_nutrition_facts to food_engine_admin;

-- ---------- observations append-only ----------
grant select, insert on table public.food_source_observations
  to food_engine_app, food_engine_worker, food_engine_admin;
revoke update, delete, truncate on table public.food_source_observations
  from food_engine_app, food_engine_worker, food_engine_admin;
revoke update, delete, truncate on table public.food_source_observations
  from authenticated, anon;

grant select, insert, update on table public.food_source_observation_processing
  to food_engine_worker, food_engine_admin;
grant select on table public.food_source_observation_processing to food_engine_app;

grant select, insert, update on table public.food_observation_links
  to food_engine_worker, food_engine_admin;
grant select on table public.food_observation_links to food_engine_app;

grant select, insert, update on table public.food_import_jobs
  to food_engine_worker, food_engine_admin;
grant select on table public.food_import_jobs to food_engine_app;

grant select, insert, update on table public.food_import_job_items
  to food_engine_worker, food_engine_admin;
grant select on table public.food_import_job_items to food_engine_app;

-- ---------- publication events: engine admin insert via SECURITY DEFINER only ----------
-- No direct DML for worker/app; admin role select for review; inserts happen as definer owner.
revoke all on table public.food_publication_events
  from food_engine_app, food_engine_worker, food_engine_admin;
grant select on table public.food_publication_events to food_engine_admin;
revoke insert, update, delete, truncate on table public.food_publication_events
  from food_engine_app, food_engine_worker, food_engine_admin, authenticated, anon;

-- ---------- publish RPCs EXECUTE ----------
grant execute on function public.publish_food_for_service(uuid, uuid, text) to food_engine_admin;
grant execute on function public.unpublish_food_for_service(uuid, uuid, text) to food_engine_admin;
grant execute on function public.archive_food_for_service(uuid, uuid, text) to food_engine_admin;

revoke execute on function public.publish_food_for_service(uuid, uuid, text)
  from public, food_engine_app, food_engine_worker, authenticated, anon;
revoke execute on function public.unpublish_food_for_service(uuid, uuid, text)
  from public, food_engine_app, food_engine_worker, authenticated, anon;
revoke execute on function public.archive_food_for_service(uuid, uuid, text)
  from public, food_engine_app, food_engine_worker, authenticated, anon;

revoke execute on function public.publish_food_for_session(uuid, text)
  from food_engine_app, food_engine_worker, food_engine_admin;
revoke execute on function public.unpublish_food_for_session(uuid, text)
  from food_engine_app, food_engine_worker, food_engine_admin;
revoke execute on function public.archive_food_for_session(uuid, text)
  from food_engine_app, food_engine_worker, food_engine_admin;

-- ---------- RLS policies for engine roles ----------
-- food_engine_app: published catalog only
drop policy if exists "foods_engine_app_select_published" on public.foods;
create policy "foods_engine_app_select_published"
  on public.foods
  for select to food_engine_app
  using (user_id is null and catalog_status = 'published' and archived_at is null);

drop policy if exists "food_barcodes_engine_app_select" on public.food_barcodes;
create policy "food_barcodes_engine_app_select"
  on public.food_barcodes
  for select to food_engine_app
  using (
    is_active and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_names_engine_app_select" on public.food_names;
create policy "food_names_engine_app_select"
  on public.food_names
  for select to food_engine_app
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_servings_engine_app_select" on public.food_servings;
create policy "food_servings_engine_app_select"
  on public.food_servings
  for select to food_engine_app
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_ingredients_engine_app_select" on public.food_ingredients;
create policy "food_ingredients_engine_app_select"
  on public.food_ingredients
  for select to food_engine_app
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_images_engine_app_select" on public.food_images;
create policy "food_images_engine_app_select"
  on public.food_images
  for select to food_engine_app
  using (
    status = 'approved' and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_nutrition_facts_engine_app_select" on public.food_nutrition_facts;
create policy "food_nutrition_facts_engine_app_select"
  on public.food_nutrition_facts
  for select to food_engine_app
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null and f.catalog_status = 'published'
    )
  );

drop policy if exists "food_obs_engine_app_select_insert" on public.food_source_observations;
create policy "food_obs_engine_app_select_insert"
  on public.food_source_observations
  for select to food_engine_app
  using (true);

drop policy if exists "food_obs_engine_app_insert" on public.food_source_observations;
create policy "food_obs_engine_app_insert"
  on public.food_source_observations
  for insert to food_engine_app
  with check (true);

-- food_engine_worker: catalog match + draft/pending write
drop policy if exists "foods_engine_worker_select" on public.foods;
create policy "foods_engine_worker_select"
  on public.foods
  for select to food_engine_worker
  using (user_id is null);

drop policy if exists "foods_engine_worker_insert" on public.foods;
create policy "foods_engine_worker_insert"
  on public.foods
  for insert to food_engine_worker
  with check (user_id is null and catalog_status in ('draft', 'pending_review'));

drop policy if exists "foods_engine_worker_update" on public.foods;
create policy "foods_engine_worker_update"
  on public.foods
  for update to food_engine_worker
  using (user_id is null and catalog_status in ('draft', 'pending_review'))
  with check (user_id is null and catalog_status in ('draft', 'pending_review'));

drop policy if exists "food_barcodes_engine_worker_all" on public.food_barcodes;
create policy "food_barcodes_engine_worker_all"
  on public.food_barcodes
  for all to food_engine_worker
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null
        and f.catalog_status in ('draft', 'pending_review', 'published', 'approved')
    )
  )
  with check (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id is null
        and f.catalog_status in ('draft', 'pending_review')
    )
  );

-- Broader worker policies for other satellites (draft parent) — abbreviated pattern
drop policy if exists "food_names_engine_worker_write" on public.food_names;
create policy "food_names_engine_worker_write"
  on public.food_names for all to food_engine_worker
  using (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null and f.catalog_status in ('draft','pending_review')));

drop policy if exists "food_servings_engine_worker_write" on public.food_servings;
create policy "food_servings_engine_worker_write"
  on public.food_servings for all to food_engine_worker
  using (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null and f.catalog_status in ('draft','pending_review')));

drop policy if exists "food_ingredients_engine_worker_write" on public.food_ingredients;
create policy "food_ingredients_engine_worker_write"
  on public.food_ingredients for all to food_engine_worker
  using (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null and f.catalog_status in ('draft','pending_review')));

drop policy if exists "food_images_engine_worker_write" on public.food_images;
create policy "food_images_engine_worker_write"
  on public.food_images for all to food_engine_worker
  using (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null and f.catalog_status in ('draft','pending_review')));

drop policy if exists "food_nutrition_facts_engine_worker_write" on public.food_nutrition_facts;
create policy "food_nutrition_facts_engine_worker_write"
  on public.food_nutrition_facts for all to food_engine_worker
  using (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.user_id is null and f.catalog_status in ('draft','pending_review')));

drop policy if exists "food_obs_engine_worker_select" on public.food_source_observations;
create policy "food_obs_engine_worker_select"
  on public.food_source_observations for select to food_engine_worker using (true);

drop policy if exists "food_obs_engine_worker_insert" on public.food_source_observations;
create policy "food_obs_engine_worker_insert"
  on public.food_source_observations for insert to food_engine_worker with check (true);

drop policy if exists "food_obs_proc_engine_worker" on public.food_source_observation_processing;
create policy "food_obs_proc_engine_worker"
  on public.food_source_observation_processing for all to food_engine_worker
  using (true) with check (true);

drop policy if exists "food_obs_links_engine_worker" on public.food_observation_links;
create policy "food_obs_links_engine_worker"
  on public.food_observation_links for all to food_engine_worker
  using (true) with check (true);

drop policy if exists "food_import_jobs_engine_worker" on public.food_import_jobs;
create policy "food_import_jobs_engine_worker"
  on public.food_import_jobs for all to food_engine_worker
  using (true) with check (true);

drop policy if exists "food_import_job_items_engine_worker" on public.food_import_job_items;
create policy "food_import_job_items_engine_worker"
  on public.food_import_job_items for all to food_engine_worker
  using (true) with check (true);

-- food_engine_admin: broad catalog review (still no diary; no BYPASSRLS)
drop policy if exists "foods_engine_admin_all" on public.foods;
create policy "foods_engine_admin_all"
  on public.foods for all to food_engine_admin
  using (user_id is null) with check (user_id is null);

drop policy if exists "food_pub_events_engine_admin_select" on public.food_publication_events;
create policy "food_pub_events_engine_admin_select"
  on public.food_publication_events for select to food_engine_admin using (true);

-- Admin read/write satellites (catalog)
drop policy if exists "food_barcodes_engine_admin" on public.food_barcodes;
create policy "food_barcodes_engine_admin"
  on public.food_barcodes for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_names_engine_admin" on public.food_names;
create policy "food_names_engine_admin"
  on public.food_names for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_servings_engine_admin" on public.food_servings;
create policy "food_servings_engine_admin"
  on public.food_servings for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_ingredients_engine_admin" on public.food_ingredients;
create policy "food_ingredients_engine_admin"
  on public.food_ingredients for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_images_engine_admin" on public.food_images;
create policy "food_images_engine_admin"
  on public.food_images for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_nutrition_facts_engine_admin" on public.food_nutrition_facts;
create policy "food_nutrition_facts_engine_admin"
  on public.food_nutrition_facts for all to food_engine_admin using (true) with check (true);

drop policy if exists "food_obs_engine_admin_select" on public.food_source_observations;
create policy "food_obs_engine_admin_select"
  on public.food_source_observations for select to food_engine_admin using (true);

drop policy if exists "food_obs_engine_admin_insert" on public.food_source_observations;
create policy "food_obs_engine_admin_insert"
  on public.food_source_observations for insert to food_engine_admin with check (true);

drop policy if exists "food_obs_proc_engine_admin" on public.food_source_observation_processing;
create policy "food_obs_proc_engine_admin"
  on public.food_source_observation_processing for all to food_engine_admin
  using (true) with check (true);

drop policy if exists "food_obs_links_engine_admin" on public.food_observation_links;
create policy "food_obs_links_engine_admin"
  on public.food_observation_links for all to food_engine_admin
  using (true) with check (true);

drop policy if exists "food_import_jobs_engine_admin" on public.food_import_jobs;
create policy "food_import_jobs_engine_admin"
  on public.food_import_jobs for all to food_engine_admin
  using (true) with check (true);

drop policy if exists "food_import_job_items_engine_admin" on public.food_import_job_items;
create policy "food_import_job_items_engine_admin"
  on public.food_import_job_items for all to food_engine_admin
  using (true) with check (true);
