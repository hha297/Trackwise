-- DRAFT ONLY — Phase 2c Food Intelligence
-- Purpose: Core satellite tables (servings, names, ingredients, images, publication events).
-- Transactional: YES.
-- Does not create food_engine_* roles.

-- ---------- food_servings ----------
create table if not exists public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null,
  grams numeric(12, 4),
  ml numeric(12, 4),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint food_servings_measure_chk check (grams is not null or ml is not null)
);

create index if not exists food_servings_food_id_idx
  on public.food_servings (food_id);

create unique index if not exists food_servings_one_default_uidx
  on public.food_servings (food_id)
  where is_default;

alter table public.food_servings enable row level security;

-- ---------- food_names ----------
create table if not exists public.food_names (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  locale text not null default 'und',
  name_original text not null,
  name_normalized text not null,
  is_primary boolean not null default false,
  name_kind text not null default 'alternate'
    check (name_kind in ('primary', 'alternate', 'branded', 'search_alias')),
  confidence numeric(5, 4),
  method_version text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint food_names_normalized_nonempty_chk check (length(trim(name_normalized)) > 0)
);

create unique index if not exists food_names_food_locale_norm_uidx
  on public.food_names (food_id, locale, name_normalized);

create unique index if not exists food_names_one_primary_per_locale_uidx
  on public.food_names (food_id, locale)
  where is_primary;

create index if not exists food_names_normalized_idx
  on public.food_names (name_normalized);

alter table public.food_names enable row level security;

-- ---------- food_ingredients ----------
create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  position integer not null default 0,
  ingredient_text text not null,
  source_observation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  constraint food_ingredients_text_nonempty_chk check (length(trim(ingredient_text)) > 0)
);

create index if not exists food_ingredients_food_id_idx
  on public.food_ingredients (food_id, position);

alter table public.food_ingredients enable row level security;

-- ---------- food_publication_events (append-oriented) ----------
create table if not exists public.food_publication_events (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_via text not null
    check (actor_via in ('session', 'service')),
  from_status text,
  to_status text not null,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists food_publication_events_food_id_idx
  on public.food_publication_events (food_id, created_at desc);

create index if not exists food_publication_events_created_at_idx
  on public.food_publication_events (created_at desc);

alter table public.food_publication_events enable row level security;

-- ---------- food_images (metadata only; no blobs) ----------
create table if not exists public.food_images (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  status text not null default 'candidate'
    check (status in ('candidate', 'approved', 'rejected')),
  private_r2_bucket text,
  private_object_key text,
  public_object_key text,
  public_url text,
  content_hash text,
  quality_score numeric(5, 4),
  license_tag text,
  attribution_text text,
  source_observation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists food_images_food_id_idx
  on public.food_images (food_id, status);

create trigger food_images_set_updated_at
before update on public.food_images
for each row execute function public.set_updated_at();

alter table public.food_images enable row level security;
