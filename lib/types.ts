export type StockStatus = 'available' | 'low' | 'out';

export interface Market {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone_number: string;
  email?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface ProductMarket {
  market_id: string;
  status: StockStatus; // Status is now per product-market combination
  reorder_quantity?: number;
  reorder_unit?: string;
}

export type Product = {
  id: string;
  name: string;
  code: string;
  purchase_price: number | null;
  sale_price: number | null;
  supplier_id: string | null;
  category_id: string;
  // Note: status is removed from Product - it's now in ProductMarket
};

export type ProductWithMarkets = Product & {
  product_markets: ProductMarket[];
};

// Unités pour les lignes de commande
export type OrderItemUnit = 'pièce' | 'bouteille' | 'boîte' | 'kg' | 'g';

export interface OrderItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity: number; // nombre d'unités (ex: 2) ou poids (ex: 1.5 pour kg, 500 pour g)
  unit?: OrderItemUnit;
}

export interface Order {
  id: string;
  client_name: string;
  created_at: string;
  items: OrderItem[];
}

