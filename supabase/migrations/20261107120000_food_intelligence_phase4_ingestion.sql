-- Phase 4 / 4.1 / 4.2 — additive Food Intelligence ingestion support
-- - Expand foods.source for fineli / usda
-- - Allow food_import_jobs.status = partial
-- - Persist full observation raw_payload + source_url for reprocessing
-- - Unique content-hash idempotency (prevents concurrent duplicate observations)
--
-- SAFE APPLICATION NOTES (hosted Supabase):
-- 1. Additive only — no DROP TABLE / no data wipe.
-- 2. foods_source_check replacement keeps all prior allowed values
--    (manual, open_food_facts, system) + fineli/usda.
--    Prior definition (20260929170000): check (source in ('manual','open_food_facts','system')).
-- 3. food_import_jobs status prior values (20261106110300):
--    queued|running|succeeded|failed|cancelled — partial is additive.
-- 4. food_source_observations.source_system is NOT NULL (20261106110300).
--    Unique index therefore always includes a concrete source_system value.
--    Partial unique applies only when external_id AND content_hash are both present.
-- 5. Before unique index: if Phase 3 pilot left duplicate (source, external_id, content_hash)
--    rows, CREATE UNIQUE INDEX fails. Pre-check:
--      select source_system, external_id, content_hash, count(*)
--      from public.food_source_observations
--      where external_id is not null and content_hash is not null
--      group by 1,2,3 having count(*) > 1;
--    Duplicate cleanup (manual, after review — NOT part of this migration):
--    Prefer keeping the oldest observation per group. Before deleting newer duplicates,
--    check FKs that reference food_source_observations.id:
--      food_import_job_items.observation_id
--      food_observation_links.observation_id
--      food_nutrition_facts.source_observation_id
--      food_images.source_observation_id
--      food_ingredients.source_observation_id
--      food_source_observations.supersedes_observation_id
--      food_source_observation_processing.observation_id (PK cascade)
--    Re-point or clear those FKs first; never orphan production review data casually.
-- 6. Transaction safety: this file uses standard DDL (no CREATE INDEX CONCURRENTLY).
--    Supabase CLI applies migrations in a transaction — either all statements commit
--    or the migration fails and rolls back as a unit.
-- 7. Rollback (manual, only if no rows depend on new values/columns):
--      drop index if exists public.food_source_observations_content_hash_uidx;
--      alter table public.food_source_observations
--        drop column if exists raw_payload,
--        drop column if exists source_url,
--        drop column if exists provider_data_version;
--      alter table public.foods drop constraint if exists foods_source_check;
--      alter table public.foods add constraint foods_source_check
--        check (source = any (array['manual','open_food_facts','system']));
--      alter table public.food_import_jobs drop constraint if exists food_import_jobs_status_check;
--      alter table public.food_import_jobs add constraint food_import_jobs_status_check
--        check (status = any (array['queued','running','succeeded','failed','cancelled']));

-- foods.source (preserve prior enums + Phase 4 providers)
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods
  add constraint foods_source_check
  check (source = any (array[
    'manual'::text,
    'open_food_facts'::text,
    'system'::text,
    'fineli'::text,
    'usda'::text
  ]));

-- import job status: partial = some items succeeded and some failed
alter table public.food_import_jobs drop constraint if exists food_import_jobs_status_check;
alter table public.food_import_jobs
  add constraint food_import_jobs_status_check
  check (status = any (array[
    'queued'::text,
    'running'::text,
    'succeeded'::text,
    'failed'::text,
    'cancelled'::text,
    'partial'::text
  ]));

-- observation provenance extensions
alter table public.food_source_observations
  add column if not exists raw_payload jsonb;

alter table public.food_source_observations
  add column if not exists source_url text;

alter table public.food_source_observations
  add column if not exists provider_data_version text;

-- Single unique index serves both idempotency enforcement and lookup performance.
-- A separate non-unique index on the same keyset is redundant and was removed in Phase 4.2.
create unique index if not exists food_source_observations_content_hash_uidx
  on public.food_source_observations (source_system, external_id, content_hash)
  where external_id is not null and content_hash is not null;

comment on column public.food_source_observations.raw_payload is
  'Full provider payload retained for Phase 4+ reprocessing; append-only.';
comment on column public.food_source_observations.source_url is
  'Canonical or documentation URL for the provider record when known.';
