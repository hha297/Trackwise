-- DRAFT ONLY — Phase 2c Food Intelligence
-- Purpose: Import jobs, append-only observations, processing, links, nutrition facts.
-- Transactional: YES.
-- B4: no unique (source_system, external_id) on observations.
-- A2: REVOKE UPDATE/DELETE/TRUNCATE on observations from app roles (grants file).

-- ---------- import jobs ----------
create table if not exists public.food_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  checkpoint jsonb not null default '{}'::jsonb,
  error_payload jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger food_import_jobs_set_updated_at
before update on public.food_import_jobs
for each row execute function public.set_updated_at();

create index if not exists food_import_jobs_status_idx
  on public.food_import_jobs (status, created_at desc);

alter table public.food_import_jobs enable row level security;

create table if not exists public.food_import_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.food_import_jobs (id) on delete cascade,
  external_id text,
  content_hash text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  error_payload jsonb,
  observation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_import_job_items_idempotency_present_chk check (
    external_id is not null or content_hash is not null
  )
);

create trigger food_import_job_items_set_updated_at
before update on public.food_import_job_items
for each row execute function public.set_updated_at();

-- Import idempotency (B4): within a job only
create unique index if not exists food_import_job_items_job_external_uidx
  on public.food_import_job_items (job_id, external_id)
  where external_id is not null;

create unique index if not exists food_import_job_items_job_content_hash_uidx
  on public.food_import_job_items (job_id, content_hash)
  where content_hash is not null;

alter table public.food_import_job_items enable row level security;

-- ---------- append-only observations ----------
create table if not exists public.food_source_observations (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  external_id text,
  observation_version integer not null default 1,
  supersedes_observation_id uuid references public.food_source_observations (id) on delete set null,
  content_hash text,
  barcode_raw text,
  barcode_normalized text,
  name_original text,
  brand_original text,
  ingredients_original text,
  nutrition_original jsonb not null default '{}'::jsonb,
  nutrition_basis_original text,
  retrieved_at timestamptz,
  license_tag text,
  attribution_text text,
  redistribution_class text,
  raw_payload_ref text,
  import_job_item_id uuid references public.food_import_job_items (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
  -- intentionally no updated_at
);

-- Non-unique product identity helpers (NOT unique constraints)
create index if not exists food_source_observations_source_external_idx
  on public.food_source_observations (source_system, external_id)
  where external_id is not null;

create index if not exists food_source_observations_barcode_idx
  on public.food_source_observations (barcode_normalized)
  where barcode_normalized is not null;

create index if not exists food_source_observations_created_at_idx
  on public.food_source_observations (created_at desc);

alter table public.food_source_observations enable row level security;

-- Link job item -> observation (optional back-pointer)
alter table public.food_import_job_items
  drop constraint if exists food_import_job_items_observation_id_fkey;

alter table public.food_import_job_items
  add constraint food_import_job_items_observation_id_fkey
  foreign key (observation_id) references public.food_source_observations (id)
  on delete set null;

-- Ingredients / images observation FKs (deferred from prior file)
alter table public.food_ingredients
  drop constraint if exists food_ingredients_source_observation_id_fkey;

alter table public.food_ingredients
  add constraint food_ingredients_source_observation_id_fkey
  foreign key (source_observation_id) references public.food_source_observations (id)
  on delete set null;

alter table public.food_images
  drop constraint if exists food_images_source_observation_id_fkey;

alter table public.food_images
  add constraint food_images_source_observation_id_fkey
  foreign key (source_observation_id) references public.food_source_observations (id)
  on delete set null;

-- ---------- mutable processing ----------
create table if not exists public.food_source_observation_processing (
  observation_id uuid primary key
    references public.food_source_observations (id) on delete cascade,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'accepted', 'rejected', 'needs_info')),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'running', 'succeeded', 'failed', 'conflict')),
  validation_errors jsonb not null default '[]'::jsonb,
  normalization_status text not null default 'pending'
    check (normalization_status in ('pending', 'done', 'failed')),
  duplicate_resolution_status text not null default 'unresolved'
    check (duplicate_resolution_status in ('unresolved', 'linked', 'rejected_duplicate', 'merged')),
  reviewer_id uuid references auth.users (id) on delete set null,
  retry_count integer not null default 0,
  last_error text,
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger food_source_observation_processing_set_updated_at
before update on public.food_source_observation_processing
for each row execute function public.set_updated_at();

alter table public.food_source_observation_processing enable row level security;

-- ---------- observation links ----------
create table if not exists public.food_observation_links (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null
    references public.food_source_observations (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  link_role text not null
    check (link_role in ('candidate', 'accepted', 'rejected_duplicate')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (observation_id, food_id, link_role)
);

create index if not exists food_observation_links_food_id_idx
  on public.food_observation_links (food_id);

alter table public.food_observation_links enable row level security;

-- ---------- canonical nutrition facts (B5) ----------
create table if not exists public.food_nutrition_facts (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  nutrient_code text not null,
  basis text not null
    check (basis in ('per_100g', 'per_100ml', 'per_serving')),
  serving_uid uuid references public.food_servings (id) on delete cascade,
  value numeric(14, 6),
  value_status text not null
    check (value_status in ('missing', 'zero', 'measured')),
  unit text not null,
  source_observation_id uuid
    references public.food_source_observations (id) on delete set null,
  publication_event_id uuid
    references public.food_publication_events (id) on delete set null,
  is_manual_override boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_nutrition_facts_value_status_chk check (
    (value_status = 'missing' and value is null)
    or (value_status = 'zero' and value = 0)
    or (value_status = 'measured' and value is not null)
  ),
  constraint food_nutrition_facts_serving_uid_chk check (
    (basis in ('per_100g', 'per_100ml') and serving_uid is null)
    or (basis = 'per_serving' and serving_uid is not null)
  )
);

create trigger food_nutrition_facts_set_updated_at
before update on public.food_nutrition_facts
for each row execute function public.set_updated_at();

-- Split uniqueness by basis to handle NULL serving_uid correctly
create unique index if not exists food_nutrition_facts_per100_uidx
  on public.food_nutrition_facts (food_id, nutrient_code, basis)
  where basis in ('per_100g', 'per_100ml');

create unique index if not exists food_nutrition_facts_per_serving_uidx
  on public.food_nutrition_facts (food_id, nutrient_code, basis, serving_uid)
  where basis = 'per_serving';

create index if not exists food_nutrition_facts_food_id_idx
  on public.food_nutrition_facts (food_id);

alter table public.food_nutrition_facts enable row level security;
