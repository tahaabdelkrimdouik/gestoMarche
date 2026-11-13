-- Run ONLY in the disposable database named gestomarche_feedback_test.
-- psql -v ON_ERROR_STOP=1 -d <local-test-connection> -f tests/feedback-migration.sql
begin;
do $$ begin
  if current_database() <> 'gestomarche_feedback_test' then
    raise exception 'Use the disposable gestomarche_feedback_test database.';
  end if;
end $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.suppliers (id uuid primary key, name text not null);
create table public.markets (id uuid primary key, name text not null);
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null,
  supplier_id uuid references public.suppliers(id), category_id uuid,
  purchase_price numeric, sale_price numeric
);
create table public.product_markets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  market_id uuid references public.markets(id), status text not null,
  reorder_quantity numeric(12,3) not null default 1 check (reorder_quantity > 0),
  reorder_unit text not null default 'piece',
  created_at timestamptz not null default now(),
  unique (product_id, market_id)
);

insert into public.suppliers values
  ('00000000-0000-0000-0000-000000000001', 'Epsilon'),
  ('00000000-0000-0000-0000-000000000002', 'Socofram'),
  ('00000000-0000-0000-0000-000000000003', 'Autre');
insert into public.markets values
  ('20000000-0000-0000-0000-000000000001', 'Marché A'),
  ('20000000-0000-0000-0000-000000000002', 'Marché B');
insert into public.products (id, name, code, supplier_id, purchase_price, sale_price) values
  ('10000000-0000-0000-0000-000000000001', 'Abricots moelleux', '231', '00000000-0000-0000-0000-000000000001', 3, 6),
  ('10000000-0000-0000-0000-000000000002', 'Abricots moelleux', 'SC231', '00000000-0000-0000-0000-000000000002', 4, 7),
  ('10000000-0000-0000-0000-000000000003', 'Privé', 'P3', '00000000-0000-0000-0000-000000000001', 1, 2);
insert into public.product_markets (product_id, market_id, status, reorder_quantity, reorder_unit) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'low', 5.125, 'kg'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'out', 12, 'bocal');
create temp table stock_before as select * from public.product_markets;

alter table public.products enable row level security;
create policy read_products on public.products for select to anon, authenticated using (name <> 'Privé');
create policy insert_products on public.products for insert to anon, authenticated with check (name <> 'Privé');
create policy update_products on public.products for update to anon, authenticated
  using (name <> 'Privé' and current_setting('test.deny_product_update', true) is distinct from 'yes')
  with check (name <> 'Privé');
alter table public.suppliers enable row level security;
create policy read_suppliers on public.suppliers for select to anon, authenticated using (true);
grant select, insert, update, delete on public.products, public.product_markets to anon, authenticated;
grant select on public.markets, public.suppliers to anon, authenticated;

\ir ../supabase/migrations/20261113203129_add_product_alternative_suppliers.sql

set local role anon;
select public.save_product_details(
  '10000000-0000-0000-0000-000000000001', '{"name":"Abricots moelleux","purchase_price":3.5}',
  array['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002']::uuid[]
);
do $$ begin
  if (select count(*) from public.product_alternative_suppliers) <> 1 then raise exception 'Alternatives must be deduplicated'; end if;
  if (select purchase_price from public.products where id = '10000000-0000-0000-0000-000000000001') <> 3.5 then raise exception 'Details not saved'; end if;
end $$;

-- Reject the usual supplier even through a direct API insert.
do $$ begin
  begin
    insert into public.product_alternative_suppliers values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
    raise exception 'Primary supplier was accepted as an alternative';
  exception when check_violation then null; end;
  begin
    insert into public.product_alternative_suppliers values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
    raise exception 'Duplicate link was accepted';
  exception when unique_violation then null; end;
end $$;

-- Failed replacements must roll back both the details and the old links.
do $$ begin
  begin
    perform public.save_product_details('10000000-0000-0000-0000-000000000001', '{"name":"Must roll back"}',
      array['00000000-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'Invalid replacement succeeded';
  exception when check_violation then null; end;
  begin
    perform public.save_product_details('10000000-0000-0000-0000-000000000001', '{"name":"Must roll back"}',
      array['99999999-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'Unknown supplier succeeded';
  exception when foreign_key_violation or insufficient_privilege then null; end;
  if (select name from public.products where id = '10000000-0000-0000-0000-000000000001') <> 'Abricots moelleux'
    or (select count(*) from public.product_alternative_suppliers) <> 1 then raise exception 'Save was not atomic'; end if;
end $$;

-- A details-only save preserves links; a legacy primary change removes overlap.
select public.save_product_details('10000000-0000-0000-0000-000000000001', '{"sale_price":8}');
do $$ begin
  if (select count(*) from public.product_alternative_suppliers) <> 1 then raise exception 'Omitted alternatives were lost'; end if;
end $$;
update public.products set supplier_id = '00000000-0000-0000-0000-000000000002' where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if exists(select 1 from public.product_alternative_suppliers) then raise exception 'New primary remains an alternative'; end if;
end $$;

select public.save_product_details('10000000-0000-0000-0000-000000000001', '{}', array['00000000-0000-0000-0000-000000000003']::uuid[]);
select public.save_product_details('10000000-0000-0000-0000-000000000001', '{}', '{}'::uuid[]);
select public.save_product_details('10000000-0000-0000-0000-000000000002', '{"code":"SC232"}', '{}'::uuid[]);
do $$ begin
  if exists(select 1 from public.product_alternative_suppliers) then raise exception 'Alternative removal failed'; end if;
  if exists(select 1 from public.product_markets where product_id = '10000000-0000-0000-0000-000000000002') then raise exception 'Empty assignments were populated during edit'; end if;
  if (select count(*) from public.products where name = 'Abricots moelleux') <> 2 then raise exception 'Existing duplicate products were merged'; end if;
end $$;

-- Create with/without alternatives; stock initialization and links are atomic.
do $$ declare new_id uuid; begin
  new_id := public.save_product_details(null, '{"name":"Nouveau","code":"N1","supplier_id":"00000000-0000-0000-0000-000000000001"}', array['00000000-0000-0000-0000-000000000002']::uuid[]);
  if (select count(*) from public.product_markets where product_id = new_id and status = 'available' and reorder_quantity = 1 and reorder_unit = 'piece') <> 2 then raise exception 'New product stock initialization failed'; end if;
  if (select count(*) from public.product_alternative_suppliers where product_id = new_id) <> 1 then raise exception 'New product links missing'; end if;
  perform public.save_product_details(null, '{"name":"Sans alternative","code":"N2"}', '{}'::uuid[]);
  begin
    perform public.save_product_details(null, '{"name":"Invalid creation","code":"BAD","supplier_id":"00000000-0000-0000-0000-000000000001"}', array['00000000-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'Invalid creation succeeded';
  exception when check_violation then null; end;
  if exists(select 1 from public.products where name = 'Invalid creation') then raise exception 'Partial creation survived'; end if;
end $$;

-- The RPC must respect the caller's existing parent RLS policies.
do $$ begin
  begin
    perform public.save_product_details('10000000-0000-0000-0000-000000000003', '{"name":"Leaked"}', '{}'::uuid[]);
    raise exception 'Hidden product was editable';
  exception when no_data_found then null; end;
end $$;
set local test.deny_product_update = 'yes';
do $$ begin
  begin
    perform public.save_product_details('10000000-0000-0000-0000-000000000001', '{"sale_price":999}', '{}'::uuid[]);
    raise exception 'Product UPDATE policy was bypassed';
  exception when no_data_found then null; end;
end $$;
reset role;
insert into public.product_alternative_suppliers values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
insert into public.product_alternative_suppliers values ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003');
set local role anon;
do $$ begin
  if (select count(*) from public.product_alternative_suppliers where product_id = '10000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Read-only callers must still see alternatives'; end if;
  if exists(select 1 from public.product_alternative_suppliers where product_id = '10000000-0000-0000-0000-000000000003') then raise exception 'Hidden product alternatives leaked'; end if;
end $$;
delete from public.product_alternative_suppliers where product_id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  if not exists(select 1 from public.product_alternative_suppliers where product_id = '10000000-0000-0000-0000-000000000001') then raise exception 'Direct DELETE bypassed parent UPDATE policy'; end if;
  begin
    insert into public.product_alternative_suppliers values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
    raise exception 'Direct INSERT bypassed parent UPDATE policy';
  exception when no_data_found or insufficient_privilege then null; end;
end $$;
reset role;

delete from public.suppliers where id = '00000000-0000-0000-0000-000000000003';
do $$ begin
  if exists(select 1 from public.product_alternative_suppliers where supplier_id = '00000000-0000-0000-0000-000000000003') then raise exception 'Deleted supplier left dangling reminders'; end if;
end $$;

do $$ begin
  if exists (
    (select * from public.product_markets where product_id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002') except select * from stock_before)
    union all
    (select * from stock_before except select * from public.product_markets)
  ) then raise exception 'Editing changed stock rows, metadata, quantities, units or assignments'; end if;
end $$;
select 'PASS: migration, atomic create/edit, alternative constraints, RLS, duplicate records and stock preservation' as result;
rollback;
