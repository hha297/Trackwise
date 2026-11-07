-- Phase 2c: unique barcode indexes (separate migration so prior txn is committed).
-- Non-CONCURRENTLY is acceptable at current scale; see phase2c-draft/ops for CONCURRENTLY variant.

do $$
begin
  if exists (
    select 1
    from public.food_barcodes
    where scope = 'catalog' and is_active
    group by barcode_normalized
    having count(*) > 1
  ) then
    raise exception 'blocking catalog barcode duplicates — resolve before unique indexes';
  end if;

  if exists (
    select 1
    from public.food_barcodes
    where scope = 'user' and is_active
    group by owner_user_id, barcode_normalized
    having count(*) > 1
  ) then
    raise exception 'blocking user barcode duplicates — resolve before unique indexes';
  end if;
end $$;

create unique index if not exists food_barcodes_catalog_active_uidx
  on public.food_barcodes (barcode_normalized)
  where scope = 'catalog' and is_active;

create unique index if not exists food_barcodes_user_active_uidx
  on public.food_barcodes (owner_user_id, barcode_normalized)
  where scope = 'user' and is_active;

create unique index if not exists food_barcodes_one_primary_uidx
  on public.food_barcodes (food_id)
  where is_primary;
