export type StockStatus = 'available' | 'low' | 'out';

export interface Market {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone_number: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface ProductMarket {
  market_id: string;
  status: StockStatus; // Status is now per product-market combination
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

