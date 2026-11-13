import type { ProductWithMarkets } from './types';

export function normalizeAlternativeSupplierIds(ids: string[], primarySupplierId: string | null): string[] {
  return [...new Set(ids)].filter(id => id && id !== primarySupplierId);
}

export function needsReplenishment(product: Pick<ProductWithMarkets, 'product_markets'>): boolean {
  return product.product_markets.some(market => market.status === 'low' || market.status === 'out');
}

export function replenishmentStatus(product: Pick<ProductWithMarkets, 'product_markets'>): 'low' | 'out' {
  return product.product_markets.some(market => market.status === 'out') ? 'out' : 'low';
}
