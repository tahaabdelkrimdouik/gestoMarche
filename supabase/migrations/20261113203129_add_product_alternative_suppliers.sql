-- Additive only: existing products (including duplicate catalogue names),
-- suppliers, stock rows and customer orders are not merged or backfilled.
create table public.product_alternative_suppliers (
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  primary key (product_id, supplier_id)
);

create index product_alternative_suppliers_supplier_id_idx
  on public.product_alternative_suppliers (supplier_id);

alter table public.product_alternative_suppliers enable row level security;

-- Association writes require the parent's existing UPDATE permissions and RLS,
-- including for direct Data API calls. No SECURITY DEFINER bypass is used.
create function public.can_edit_product_alternatives(p_product_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.products p where p.id = p_product_id for update;
  return found;
end;
$$;
revoke all on function public.can_edit_product_alternatives(uuid) from public;
grant execute on function public.can_edit_product_alternatives(uuid) to anon, authenticated, service_role;

-- This application uses the existing products/suppliers access model. Parent
-- SELECT policies still apply; no tenant or authentication model is invented here.
create policy "Read alternatives of visible products"
  on public.product_alternative_suppliers for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id)
    and exists (select 1 from public.suppliers s where s.id = supplier_id)
  );

create policy "Add alternatives of visible products"
  on public.product_alternative_suppliers for insert to anon, authenticated
  with check (
    public.can_edit_product_alternatives(product_id)
    and exists (select 1 from public.suppliers s where s.id = supplier_id)
  );

create policy "Remove alternatives of visible products"
  on public.product_alternative_suppliers for delete to anon, authenticated
  using (public.can_edit_product_alternatives(product_id));

grant select, insert, delete on public.product_alternative_suppliers to anon, authenticated;
grant all on public.product_alternative_suppliers to service_role;

create function public.check_alternative_supplier()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  primary_supplier uuid;
begin
  -- Serialize alternative edits with changes to the product's usual supplier.
  select p.supplier_id into primary_supplier
  from public.products p where p.id = new.product_id for update;
  if not found then
    raise exception 'Produit introuvable ou modification non autorisée.' using errcode = 'P0002';
  end if;
  if primary_supplier = new.supplier_id then
    raise exception 'Le fournisseur habituel ne peut pas être un autre fournisseur.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_alternative_supplier
before insert or update on public.product_alternative_suppliers
for each row execute function public.check_alternative_supplier();

-- Keep the invariant for older clients that update products.supplier_id directly.
create function public.remove_primary_supplier_from_alternatives()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.product_alternative_suppliers
  where product_id = new.id and supplier_id = new.supplier_id;
  return new;
end;
$$;

create trigger remove_primary_supplier_from_alternatives
before update of supplier_id on public.products
for each row when (old.supplier_id is distinct from new.supplier_id)
execute function public.remove_primary_supplier_from_alternatives();

-- Product fields and alternative links are saved in one transaction. In edit
-- mode product_markets is deliberately never written: concurrent stock edits,
-- assignments, quantities and units remain intact, including an empty assignment.
create function public.save_product_details(
  p_product_id uuid,
  p_details jsonb,
  p_alternative_supplier_ids uuid[] default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  saved_id uuid;
begin
  if p_product_id is null then
    insert into public.products (name, code, supplier_id, category_id, purchase_price, sale_price)
    values (
      p_details->>'name', nullif(p_details->>'code', ''),
      nullif(p_details->>'supplier_id', '')::uuid,
      (p_details->>'category_id')::uuid,
      (p_details->>'purchase_price')::numeric,
      (p_details->>'sale_price')::numeric
    ) returning id into saved_id;

    insert into public.product_markets (product_id, market_id, status)
    select saved_id, m.id, 'available' from public.markets m;
  else
    update public.products set
      name = case when p_details ? 'name' then p_details->>'name' else name end,
      code = case when p_details ? 'code' then nullif(p_details->>'code', '') else code end,
      supplier_id = case when p_details ? 'supplier_id'
        then nullif(p_details->>'supplier_id', '')::uuid else supplier_id end,
      category_id = case when p_details ? 'category_id'
        then (p_details->>'category_id')::uuid else category_id end,
      purchase_price = case when p_details ? 'purchase_price'
        then (p_details->>'purchase_price')::numeric else purchase_price end,
      sale_price = case when p_details ? 'sale_price'
        then (p_details->>'sale_price')::numeric else sale_price end
    where id = p_product_id
    returning id into saved_id;

    if not found then
      raise exception 'Produit introuvable ou modification non autorisée.' using errcode = 'P0002';
    end if;
  end if;

  -- NULL preserves links for callers that do not yet support alternatives.
  -- An empty array explicitly removes all alternatives.
  if p_alternative_supplier_ids is not null then
    delete from public.product_alternative_suppliers where product_id = saved_id;
    insert into public.product_alternative_suppliers (product_id, supplier_id)
    select saved_id, supplier_id
    from (select distinct unnest(p_alternative_supplier_ids) as supplier_id) alternatives;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.check_alternative_supplier() from public;
revoke all on function public.remove_primary_supplier_from_alternatives() from public;
revoke all on function public.save_product_details(uuid, jsonb, uuid[]) from public;
grant execute on function public.save_product_details(uuid, jsonb, uuid[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
