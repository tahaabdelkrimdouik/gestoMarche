export type StockStatus = 'available' | 'low' | 'out';

export interface Market {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone_number:number;
}
export interface Category {
  id: string;
  name: string;
}
export interface ProductMarket {
  market_id: string;
}

export type Product = {
  id: string;
  name: string;
  purchase_price: number | null;
  sale_price: number | null;
  status: StockStatus;
  supplier_id: string | null;
};

export type ProductWithMarkets = Product & {
  product_markets: ProductMarket[];
};

