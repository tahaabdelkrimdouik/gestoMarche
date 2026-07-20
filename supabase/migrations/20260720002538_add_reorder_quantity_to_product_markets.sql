alter table public.product_markets
add column if not exists reorder_quantity integer;

update public.product_markets
set reorder_quantity = 1
where reorder_quantity is null;

alter table public.product_markets
alter column reorder_quantity set default 1,
alter column reorder_quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_markets_reorder_quantity_positive'
      and conrelid = 'public.product_markets'::regclass
  ) then
    alter table public.product_markets
    add constraint product_markets_reorder_quantity_positive
    check (reorder_quantity > 0);
  end if;
end
$$;
