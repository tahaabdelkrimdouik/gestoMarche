import { Product } from "./types";

export interface ProductWithMarkets extends Product {
  markets: string[]; // array of market ids
}