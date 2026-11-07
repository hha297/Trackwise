-- DRAFT ONLY — Phase 2c Food Intelligence
-- Purpose: RLS policies for authenticated / admin on new satellites.
-- Does NOT weaken existing foods/food_entries/food_favorites policies.
-- Does NOT tighten foods_select_visible to published-only (see OPTIONAL draft).
-- Engine-role policies: 20261106106000 (requires Phase 2b roles).

-- Helper predicate reuse via security invoker SQL inline.

-- food_servings
drop policy if exists "food_servings_select_visible" on public.food_servings;
create policy "food_servings_select_visible"
  on public.food_servings
  for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id
        and f.archived_at is null
        and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
    )
    or public.is_admin()
  );

drop policy if exists "food_servings_admin_write" on public.food_servings;
create policy "food_servings_admin_write"
  on public.food_servings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- food_names
drop policy if exists "food_names_select_visible" on public.food_names;
create policy "food_names_select_visible"
  on public.food_names
  for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id
        and f.archived_at is null
        and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
    )
    or public.is_admin()
  );

drop policy if exists "food_names_admin_write" on public.food_names;
create policy "food_names_admin_write"
  on public.food_names
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- food_ingredients
drop policy if exists "food_ingredients_select_visible" on public.food_ingredients;
create policy "food_ingredients_select_visible"
  on public.food_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id
        and f.archived_at is null
        and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
    )
    or public.is_admin()
  );

drop policy if exists "food_ingredients_admin_write" on public.food_ingredients;
create policy "food_ingredients_admin_write"
  on public.food_ingredients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- food_images
drop policy if exists "food_images_select_visible" on public.food_images;
create policy "food_images_select_visible"
  on public.food_images
  for select to authenticated
  using (
    (
      status = 'approved'
      and exists (
        select 1 from public.foods f
        where f.id = food_id
          and f.archived_at is null
          and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
      )
    )
    or public.is_admin()
  );

drop policy if exists "food_images_admin_write" on public.food_images;
create policy "food_images_admin_write"
  on public.food_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- food_barcodes
drop policy if exists "food_barcodes_select_visible" on public.food_barcodes;
create policy "food_barcodes_select_visible"
  on public.food_barcodes
  for select to authenticated
  using (
    is_active
    and exists (
      select 1 from public.foods f
      where f.id = food_id
        and f.archived_at is null
        and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
    )
    or public.is_admin()
  );

drop policy if exists "food_barcodes_admin_write" on public.food_barcodes;
create policy "food_barcodes_admin_write"
  on public.food_barcodes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Own user barcode maintenance (optional dual-write path for mobile later)
drop policy if exists "food_barcodes_insert_own" on public.food_barcodes;
create policy "food_barcodes_insert_own"
  on public.food_barcodes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "food_barcodes_update_own" on public.food_barcodes;
create policy "food_barcodes_update_own"
  on public.food_barcodes
  for update to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = auth.uid()
    )
  );

-- food_nutrition_facts
drop policy if exists "food_nutrition_facts_select_visible" on public.food_nutrition_facts;
create policy "food_nutrition_facts_select_visible"
  on public.food_nutrition_facts
  for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_id
        and f.archived_at is null
        and (f.is_public = true or f.user_id = auth.uid() or f.user_id is null)
    )
    or public.is_admin()
  );

drop policy if exists "food_nutrition_facts_admin_write" on public.food_nutrition_facts;
create policy "food_nutrition_facts_admin_write"
  on public.food_nutrition_facts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- food_publication_events — admin read; no client writes (RPC only)
drop policy if exists "food_publication_events_select_admin" on public.food_publication_events;
create policy "food_publication_events_select_admin"
  on public.food_publication_events
  for select to authenticated
  using (public.is_admin());

-- Observations / processing / links / import jobs — no authenticated access (engine/admin only)
-- (intentionally no policies for authenticated => deny under RLS)

drop policy if exists "food_obs_select_admin" on public.food_source_observations;
create policy "food_obs_select_admin"
  on public.food_source_observations
  for select to authenticated
  using (public.is_admin());

drop policy if exists "food_obs_insert_admin" on public.food_source_observations;
create policy "food_obs_insert_admin"
  on public.food_source_observations
  for insert to authenticated
  with check (public.is_admin());
-- no update/delete policies for authenticated

drop policy if exists "food_obs_proc_admin_all" on public.food_source_observation_processing;
create policy "food_obs_proc_admin_all"
  on public.food_source_observation_processing
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "food_obs_links_admin_all" on public.food_observation_links;
create policy "food_obs_links_admin_all"
  on public.food_observation_links
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "food_import_jobs_admin_all" on public.food_import_jobs;
create policy "food_import_jobs_admin_all"
  on public.food_import_jobs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "food_import_job_items_admin_all" on public.food_import_job_items;
create policy "food_import_job_items_admin_all"
  on public.food_import_job_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- anon: no policies on new tables (deny)
