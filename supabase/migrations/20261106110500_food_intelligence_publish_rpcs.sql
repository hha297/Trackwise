-- DRAFT ONLY — Phase 2c Food Intelligence
-- Purpose: Narrow admin check + session/service publish/unpublish/archive RPCs (B1/B2).
-- Transactional: YES.
-- EXECUTE grants for engine roles: see 20261106106000_fi_engine_grants.sql (requires 2b roles).
-- Session EXECUTE granted to authenticated here.

-- ---------- narrow admin check (no table SELECT grant to engine) ----------
create or replace function public.food_engine_is_active_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = p_uid
      and ur.role = 'admin'
      and p.account_status = 'active'
  );
$$;

revoke all on function public.food_engine_is_active_admin(uuid) from public;
-- Engine role grants deferred to grants migration; authenticated may use for diagnostics optional:
-- (prefer not expose widely — leave revoked from authenticated unless needed)
grant execute on function public.food_engine_is_active_admin(uuid) to service_role;

-- ---------- shared helper: write publication event + set status ----------
create or replace function public._food_apply_catalog_status(
  p_food_id uuid,
  p_actor uuid,
  p_actor_via text,
  p_to_status text,
  p_reason text default null
)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_food public.foods%rowtype;
  v_event public.food_publication_events%rowtype;
  v_before jsonb;
begin
  select * into v_food from public.foods where id = p_food_id for update;
  if not found then
    raise exception 'food not found';
  end if;
  if v_food.user_id is not null then
    raise exception 'refusing to change catalog_status on user-owned food';
  end if;

  v_before := jsonb_build_object(
    'catalog_status', v_food.catalog_status,
    'is_public', v_food.is_public,
    'archived_at', v_food.archived_at,
    'published_at', v_food.published_at,
    'image_url', v_food.image_url
  );

  update public.foods
  set catalog_status = p_to_status,
      -- A1: clear projection image on unpublish/archive
      image_url = case
        when p_to_status in ('approved', 'archived') and v_food.catalog_status = 'published'
          then null
        when p_to_status = 'archived' then null
        else image_url
      end,
      updated_at = timezone('utc', now())
  where id = p_food_id;

  insert into public.food_publication_events (
    food_id, actor_id, actor_via, from_status, to_status, reason, before_data, after_data
  ) values (
    p_food_id,
    p_actor,
    p_actor_via,
    v_food.catalog_status,
    p_to_status,
    p_reason,
    v_before,
    jsonb_build_object('catalog_status', p_to_status)
  )
  returning * into v_event;

  -- Mirror into admin_audit_logs when possible
  begin
    insert into public.admin_audit_logs (
      actor_id, action, target_type, target_id, reason, before_data, after_data
    ) values (
      p_actor,
      'food.catalog_status',
      'foods',
      p_food_id::text,
      p_reason,
      v_before,
      jsonb_build_object('catalog_status', p_to_status)
    );
  exception when others then
    -- do not fail publish if audit insert blocked
    null;
  end;

  return v_event;
end;
$$;

revoke all on function public._food_apply_catalog_status(uuid, uuid, text, text, text) from public;
-- Internal helper: no execute to authenticated/worker/app

-- ---------- session trust model ----------
create or replace function public.publish_food_for_session(p_food_id uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not public.food_engine_is_active_admin(v_actor) then
    raise exception 'admin inactive or missing';
  end if;
  return public._food_apply_catalog_status(p_food_id, v_actor, 'session', 'published', p_reason);
end;
$$;

create or replace function public.unpublish_food_for_session(p_food_id uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not public.food_engine_is_active_admin(v_actor) then
    raise exception 'admin inactive or missing';
  end if;
  -- D11: unpublish -> approved
  return public._food_apply_catalog_status(p_food_id, v_actor, 'session', 'approved', p_reason);
end;
$$;

create or replace function public.archive_food_for_session(p_food_id uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not public.food_engine_is_active_admin(v_actor) then
    raise exception 'admin inactive or missing';
  end if;
  return public._food_apply_catalog_status(p_food_id, v_actor, 'session', 'archived', p_reason);
end;
$$;

revoke all on function public.publish_food_for_session(uuid, text) from public;
revoke all on function public.unpublish_food_for_session(uuid, text) from public;
revoke all on function public.archive_food_for_session(uuid, text) from public;

grant execute on function public.publish_food_for_session(uuid, text) to authenticated;
grant execute on function public.unpublish_food_for_session(uuid, text) to authenticated;
grant execute on function public.archive_food_for_session(uuid, text) to authenticated;

-- ---------- service trust model (EXECUTE only for food_engine_admin — grants file) ----------
create or replace function public.publish_food_for_service(p_food_id uuid, p_actor uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user is distinct from 'food_engine_admin' then
    raise exception 'publish_food_for_service requires food_engine_admin role';
  end if;
  if p_actor is null then
    raise exception 'p_actor required';
  end if;
  if not public.food_engine_is_active_admin(p_actor) then
    raise exception 'p_actor is not an active admin';
  end if;
  return public._food_apply_catalog_status(p_food_id, p_actor, 'service', 'published', p_reason);
end;
$$;

create or replace function public.unpublish_food_for_service(p_food_id uuid, p_actor uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user is distinct from 'food_engine_admin' then
    raise exception 'unpublish_food_for_service requires food_engine_admin role';
  end if;
  if p_actor is null or not public.food_engine_is_active_admin(p_actor) then
    raise exception 'p_actor is not an active admin';
  end if;
  return public._food_apply_catalog_status(p_food_id, p_actor, 'service', 'approved', p_reason);
end;
$$;

create or replace function public.archive_food_for_service(p_food_id uuid, p_actor uuid, p_reason text default null)
returns public.food_publication_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user is distinct from 'food_engine_admin' then
    raise exception 'archive_food_for_service requires food_engine_admin role';
  end if;
  if p_actor is null or not public.food_engine_is_active_admin(p_actor) then
    raise exception 'p_actor is not an active admin';
  end if;
  return public._food_apply_catalog_status(p_food_id, p_actor, 'service', 'archived', p_reason);
end;
$$;

revoke all on function public.publish_food_for_service(uuid, uuid, text) from public;
revoke all on function public.unpublish_food_for_service(uuid, uuid, text) from public;
revoke all on function public.archive_food_for_service(uuid, uuid, text) from public;
-- GRANT EXECUTE to food_engine_admin in grants migration only.
