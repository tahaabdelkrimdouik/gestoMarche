import { supabase } from "@/lib/supabaseClient";
import type { Product, ProductWithMarkets, Supplier, Market, Category } from "@/lib/types";

export const fetchProducts = async (): Promise<ProductWithMarkets[]> => {
  // First fetch products (avoid nesting relations in the same select to prevent schema-cache errors)
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, code, status, supplier_id, category_id, purchase_price, sale_price');

  if (prodErr) throw prodErr;
  const items = (products || []) as any[];

  if (items.length === 0) return [];

  // Then fetch product_markets relations for these products
  const ids = items.map((p) => p.id);
  const { data: relations, error: relErr } = await supabase
    .from('product_markets')
    .select('product_id, market_id')
    .in('product_id', ids as string[]);

  if (relErr) {
    // If the relation table doesn't exist or fails, return products without relations
    console.warn('Could not fetch product_markets relations:', relErr.message || relErr);
    return items.map((p) => ({ ...p, product_markets: [] })) as ProductWithMarkets[];
  }

  const relsByProduct: Record<string, { market_id: string }[]> = {};
  (relations || []).forEach((r: any) => {
    relsByProduct[r.product_id] = relsByProduct[r.product_id] || [];
    relsByProduct[r.product_id].push({ market_id: r.market_id });
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
    .order("name");

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
    .order("name");

  if (error) throw error;
  return data ?? [];
};
export const fetchMarkets = async (): Promise<Market[]> => {
  const { data, error } = await supabase
    .from("markets") // Or "markets" depending on your table name
    .select("id, name") // Or "id, nom" if your column is still 'nom'
    .order("name");

  if (error) throw error;
  
  // Normalizing: if your DB uses 'nom', we map it to 'name'
  return (data || []).map((m: Market) => ({
    id: m.id,
    name: m.name ?? m.name // Handles both cases
  })) as Market[];
};