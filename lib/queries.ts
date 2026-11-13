import { supabase } from "@/lib/supabaseClient";
import type { Product, ProductDetailsInput, ProductWithMarkets, ProductMarket, Supplier, Market, Category, Order, OrderItem, OrderItemUnit, StockStatus } from "@/lib/types";
import { validateProduct } from './productValidation';
import { normalizeAlternativeSupplierIds } from './suppliers';

interface ProductMarketRow extends ProductMarket {
  product_id: string;
}

type OrderRow = Pick<Order, 'id' | 'client_name' | 'created_at'>;

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit: OrderItemUnit | null;
  products: { name: string } | { name: string }[] | null;
}

export const fetchProducts = async (): Promise<ProductWithMarkets[]> => {
  // First fetch products (avoid nesting relations in the same select to prevent schema-cache errors)
  // Sorted alphabetically by name
  // Note: status is no longer in products table, it's in product_markets
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, code, supplier_id, category_id, purchase_price, sale_price')
    .order('name', { ascending: true });

  if (prodErr) throw prodErr;
  const items = (products || []) as Product[];

  if (items.length === 0) return [];

  const { data: alternatives, error: alternativesError } = await supabase
    .from('product_alternative_suppliers')
    .select('product_id, supplier_id')
    .in('product_id', items.map(product => product.id));

  // Permit the previous catalogue to load during a migration-first rollout.
  // Other failures must not look like an empty list that could overwrite saved links.
  if (alternativesError && !['42P01', 'PGRST205'].includes(alternativesError.code)) {
    throw alternativesError;
  }
  const alternativesByProduct: Record<string, string[]> = {};
  for (const relation of alternatives || []) {
    (alternativesByProduct[relation.product_id] ||= []).push(relation.supplier_id);
  }
  const withAlternatives = items.map(product => ({
    ...product,
    alternative_supplier_ids: normalizeAlternativeSupplierIds(alternativesByProduct[product.id] || [], product.supplier_id),
  }));

  // Then fetch product_markets relations for these products (including status per market)
  const ids = items.map((p) => p.id);
  const { data: relations, error: relErr } = await supabase
    .from('product_markets')
    .select('product_id, market_id, status, reorder_quantity, reorder_unit')
    .in('product_id', ids as string[]);

  let relationRows: ProductMarketRow[];
  if (relErr?.code === '42703' && relErr.message.includes('reorder_unit')) {
    // Keep reads working if the app deploys just before the unit migration.
    const { data: legacyRelations, error: legacyError } = await supabase
      .from('product_markets')
      .select('product_id, market_id, status, reorder_quantity')
      .in('product_id', ids as string[]);

    if (legacyError) {
      throw legacyError;
    }

    relationRows = ((legacyRelations || []) as ProductMarketRow[]).map(relation => ({
      ...relation,
      reorder_unit: 'piece',
    }));
  } else if (relErr) {
    throw relErr;
  } else {
    relationRows = (relations || []) as ProductMarketRow[];
  }

  const relsByProduct: Record<string, ProductMarket[]> = {};
  relationRows.forEach((r) => {
    relsByProduct[r.product_id] = relsByProduct[r.product_id] || [];
    relsByProduct[r.product_id].push({ 
      market_id: r.market_id,
      status: (r.status || 'available') as StockStatus, // Default to 'available' if status is null
      reorder_quantity: r.reorder_quantity || 1,
      reorder_unit: r.reorder_unit || 'piece',
    });
  });

  return withAlternatives.map((p) => ({
    ...p,
    product_markets: relsByProduct[p.id] || [],
  })) as ProductWithMarkets[];
};

export const saveProductDetails = async (product: ProductDetailsInput, id: string | null = null): Promise<void> => {
  if (Object.keys(validateProduct(product)).length) {
    throw new Error('Le nom, le code produit et la catégorie sont obligatoires.');
  }
  const { alternative_supplier_ids, ...details } = { ...product, name: product.name.trim(), code: product.code.trim() };
  const { error } = await supabase.rpc('save_product_details', {
    p_product_id: id,
    p_details: details,
    p_alternative_supplier_ids: alternative_supplier_ids === undefined
      ? null
      : normalizeAlternativeSupplierIds(alternative_supplier_ids, product.supplier_id),
  });
  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error('La mise à jour de la base de données est nécessaire avant d’enregistrer les produits.');
    }
    throw error;
  }
};

export const fetchCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const createCategory = async (category: Omit<Category, 'id'>): Promise<Category> => {
  const { data, error } = await supabase
    .from("categories")
    .insert([category])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<Category> => {
  const { data, error } = await supabase
    .from("categories")
    .update(category)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const fetchSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
};
export const fetchMarkets = async (): Promise<Market[]> => {
  const { data, error } = await supabase
    .from("markets") // Or "markets" depending on your table name
    .select("id, name") // Or "id, nom" if your column is still 'nom'
    .order("name", { ascending: true });

  if (error) throw error;
  
  // Normalizing: if your DB uses 'nom', we map it to 'name'
  return (data || []).map((m: Market) => ({
    id: m.id,
    name: m.name ?? m.name // Handles both cases
  })) as Market[];
};

// Order functions
export const fetchOrders = async (): Promise<Order[]> => {
  // Fetch orders
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, client_name, created_at")
    .order("created_at", { ascending: false });

  if (ordersErr) throw ordersErr;
  const orderList = (orders || []) as OrderRow[];

  if (orderList.length === 0) return [];

  // Fetch order items with product names (unit if column exists)
  const orderIds = orderList.map((o) => o.id);
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, quantity, unit, products(name)")
    .in("order_id", orderIds as string[]);

  if (itemsErr) {
    throw itemsErr;
  }

  // Group items by order
  const itemsByOrder: Record<string, OrderItem[]> = {};
  const orderItemRows = (items || []) as OrderItemRow[];
  orderItemRows.forEach((item) => {
    const relatedProduct = Array.isArray(item.products) ? item.products[0] : item.products;
    itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || [];
    itemsByOrder[item.order_id].push({
      id: item.id,
      product_id: item.product_id,
      product_name: relatedProduct?.name || "Produit inconnu",
      quantity: item.quantity,
      unit: item.unit || "pièce",
    });
  });

  return orderList.map((o) => ({
    ...o,
    items: itemsByOrder[o.id] || [],
  })) as Order[];
};

export const createOrder = async (
  clientName: string,
  items: { product_id: string; quantity: number; unit?: string }[]
): Promise<Order> => {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert([{ client_name: clientName }])
    .select()
    .single();

  if (orderErr) throw orderErr;

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    ...(item.unit && { unit: item.unit }),
  }));

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsErr) throw itemsErr;

  return { ...order, items } as Order;
};

export const updateOrder = async (
  orderId: string,
  clientName: string,
  items: { product_id: string; quantity: number; unit?: string }[]
): Promise<Order> => {
  const { error: updateErr } = await supabase
    .from("orders")
    .update({ client_name: clientName })
    .eq("id", orderId);

  if (updateErr) throw updateErr;

  const { error: deleteErr } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (deleteErr) throw deleteErr;

  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    ...(item.unit && { unit: item.unit }),
  }));

  const { error: insertErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (insertErr) throw insertErr;

  const orders = await fetchOrders();
  const updated = orders.find((o) => o.id === orderId);
  return updated ?? ({ id: orderId, client_name: clientName, created_at: "", items } as Order);
};

export const deleteOrder = async (id: string): Promise<void> => {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
};
