import { supabase } from "@/lib/supabaseClient";
import type { Product, ProductWithMarkets, Supplier, Market, Category, Order, OrderItem } from "@/lib/types";

export const fetchProducts = async (): Promise<ProductWithMarkets[]> => {
  // First fetch products (avoid nesting relations in the same select to prevent schema-cache errors)
  // Sorted alphabetically by name
  // Note: status is no longer in products table, it's in product_markets
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, code, supplier_id, category_id, purchase_price, sale_price')
    .order('name', { ascending: true });

  if (prodErr) throw prodErr;
  const items = (products || []) as any[];

  if (items.length === 0) return [];

  // Then fetch product_markets relations for these products (including status per market)
  const ids = items.map((p) => p.id);
  const { data: relations, error: relErr } = await supabase
    .from('product_markets')
    .select('product_id, market_id, status')
    .in('product_id', ids as string[]);

  if (relErr) {
    // If the relation table doesn't exist or fails, return products without relations
    console.warn('Could not fetch product_markets relations:', relErr.message || relErr);
    return items.map((p) => ({ ...p, product_markets: [] })) as ProductWithMarkets[];
  }

  const relsByProduct: Record<string, { market_id: string; status: string }[]> = {};
  (relations || []).forEach((r: any) => {
    relsByProduct[r.product_id] = relsByProduct[r.product_id] || [];
    relsByProduct[r.product_id].push({ 
      market_id: r.market_id,
      status: r.status || 'available' // Default to 'available' if status is null
    });
  });

  return items.map((p) => ({
    ...p,
    product_markets: relsByProduct[p.id] || [],
  })) as ProductWithMarkets[];
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
  const orderList = (orders || []) as any[];

  if (orderList.length === 0) return [];

  // Fetch order items with product names
  const orderIds = orderList.map((o) => o.id);
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, quantity, products(name)")
    .in("order_id", orderIds as string[]);

  if (itemsErr) {
    console.warn("Could not fetch order_items:", itemsErr.message || itemsErr);
    return orderList.map((o) => ({ ...o, items: [] })) as Order[];
  }

  // Group items by order
  const itemsByOrder: Record<string, OrderItem[]> = {};
  (items || []).forEach((item: any) => {
    itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || [];
    itemsByOrder[item.order_id].push({
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name || "Produit inconnu",
      quantity: item.quantity,
    });
  });

  return orderList.map((o) => ({
    ...o,
    items: itemsByOrder[o.id] || [],
  })) as Order[];
};

export const createOrder = async (
  clientName: string,
  items: { product_id: string; quantity: number }[]
): Promise<Order> => {
  // Create the order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert([{ client_name: clientName }])
    .select()
    .single();

  if (orderErr) throw orderErr;

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }));

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsErr) throw itemsErr;

  return { ...order, items } as Order;
};

export const deleteOrder = async (id: string): Promise<void> => {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
};
