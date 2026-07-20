alter table public.product_markets
drop constraint if exists product_markets_reorder_quantity_positive;

alter table public.product_markets
alter column reorder_quantity type numeric(12, 3)
using reorder_quantity::numeric,
alter column reorder_quantity set default 1,
alter column reorder_quantity set not null;

alter table public.product_markets
drop constraint if exists product_markets_reorder_quantity_range;

alter table public.product_markets
add constraint product_markets_reorder_quantity_range
check (reorder_quantity > 0 and reorder_quantity <= 99999.999);

alter table public.product_markets
add column if not exists reorder_unit text;

update public.product_markets
set reorder_unit = 'piece'
where reorder_unit is null;

alter table public.product_markets
alter column reorder_unit set default 'piece',
alter column reorder_unit set not null;

alter table public.product_markets
drop constraint if exists product_markets_reorder_unit_allowed;

alter table public.product_markets
add constraint product_markets_reorder_unit_allowed
check (reorder_unit in (
  'piece',
  'kg',
  'g',
  'litre',
  'ml',
  'bocal',
  'bouteille',
  'boite',
  'carton',
  'paquet'
));

alter table public.product_markets
drop constraint if exists product_markets_reorder_quantity_matches_unit;

alter table public.product_markets
add constraint product_markets_reorder_quantity_matches_unit
check (
  reorder_unit in ('kg', 'g', 'litre', 'ml')
  or reorder_quantity = trunc(reorder_quantity)
);
