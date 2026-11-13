import type { QueryClient } from '@tanstack/react-query';
import type { ProductMarket, ProductWithMarkets, StockStatus } from './types';

export const PRODUCTS_QUERY_KEY = ['products'] as const;

export interface StockStatusWrite {
  productId: string;
  marketIds: string[];
  status: StockStatus;
}

type Intent = { status: StockStatus; revision: number };
type ProductQueue = {
  productId: string;
  confirmed: Map<string, StockStatus>;
  desired: Map<string, Intent>;
  uncertain: Set<string>;
};

export function getStockStatus(product: ProductWithMarkets, marketId: string): StockStatus {
  const markets = marketId === 'all'
    ? product.product_markets
    : product.product_markets.filter(market => market.market_id === marketId);
  if (markets.some(market => market.status === 'out')) return 'out';
  return markets.some(market => market.status === 'low') ? 'low' : 'available';
}

// Copy only changed rows/products. Unrelated cards keep their object identity,
// and quantity writes cannot accidentally overwrite an optimistic status.
export function patchProductMarkets(
  products: ProductWithMarkets[] | undefined,
  productId: string,
  marketIds: readonly string[],
  patch: Partial<Pick<ProductMarket, 'status' | 'reorder_quantity' | 'reorder_unit'>>,
): ProductWithMarkets[] | undefined {
  if (!products) return products;
  const ids = new Set(marketIds);
  let changed = false;
  const result = products.map(product => {
    if (product.id !== productId) return product;
    const markets = product.product_markets.map(market => {
      if (!ids.has(market.market_id) || !Object.entries(patch).some(([key, value]) => market[key as keyof ProductMarket] !== value)) return market;
      changed = true;
      return { ...market, ...patch };
    });
    return changed ? { ...product, product_markets: markets } : product;
  });
  return changed ? result : products;
}

/** One queue per product, shared for the lifetime of the QueryClient.
 * Writes to different products run independently. While a request is in flight,
 * repeated clicks replace the desired status per market, not whole products.
 */
export function createStockStatusUpdater(
  client: QueryClient,
  persist: (write: StockStatusWrite) => Promise<readonly string[]>,
  onError: () => void,
) {
  const queues = new Map<string, ProductQueue>();
  let revision = 0;

  function render() {
    const current = client.getQueryData<ProductWithMarkets[]>(PRODUCTS_QUERY_KEY);
    if (!current) return;
    let changed = false;
    const next = current.map(product => {
      const queue = queues.get(product.id);
      if (!queue) return product;
      let productChanged = false;
      const markets = product.product_markets.map(market => {
        const status = queue.desired.get(market.market_id)?.status ?? queue.confirmed.get(market.market_id);
        if (status === undefined || status === market.status) return market;
        changed = productChanged = true;
        return { ...market, status };
      });
      return productChanged ? { ...product, product_markets: markets } : product;
    });
    if (changed) client.setQueryData(PRODUCTS_QUERY_KEY, next);
  }

  const cancelReads = () => void client.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY, exact: true });

  // A focus/navigation/manual refresh must not replace pending user selections.
  // Manual cache updates are ignored to avoid subscription loops.
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (queues.size && event.type === 'updated' && event.query.queryKey.length === 1
      && event.query.queryKey[0] === 'products' && event.action.type === 'success' && !event.action.manual) render();
  });

  async function flush(queue: ProductQueue) {
    while (queue.desired.size) {
      for (const [marketId, intent] of queue.desired) {
        if (intent.status === queue.confirmed.get(marketId) && !queue.uncertain.has(marketId)) queue.desired.delete(marketId);
      }
      if (!queue.desired.size) break;
      const status = queue.desired.values().next().value!.status;
      const batch = new Map([...queue.desired].filter(([, intent]) => intent.status === status));
      let saved = new Set<string>();
      try {
        saved = new Set(await persist({ productId: queue.productId, marketIds: [...batch.keys()], status }));
      } catch {
        // The last confirmed status is retained for rollback. A newer intent
        // still gets its own request, even if it returns to that same status.
      }
      let failedLatest = false;
      for (const [marketId, intent] of batch) {
        if (saved.has(marketId)) {
          queue.confirmed.set(marketId, status);
          queue.uncertain.delete(marketId);
        } else {
          queue.uncertain.add(marketId);
        }
        if (queue.desired.get(marketId)?.revision === intent.revision) {
          queue.desired.delete(marketId);
          if (!saved.has(marketId)) failedLatest = true;
        }
      }
      render();
      if (failedLatest) onError();
    }
    // Cancel any refresh started while saving before releasing the final state.
    cancelReads();
    render();
    queues.delete(queue.productId);
  }

  function update({ productId, marketIds, status }: StockStatusWrite) {
    const product = client.getQueryData<ProductWithMarkets[]>(PRODUCTS_QUERY_KEY)?.find(product => product.id === productId);
    if (!product) return;
    const ids = new Set(marketIds);
    const targets = product.product_markets.filter(market => ids.has(market.market_id));
    if (!targets.length) return;
    const existing = queues.get(productId);
    if (!existing && targets.every(market => market.status === status)) return;
    const queue: ProductQueue = existing || { productId, confirmed: new Map(), desired: new Map(), uncertain: new Set() };
    for (const market of targets) {
      if (!queue.confirmed.has(market.market_id)) queue.confirmed.set(market.market_id, market.status);
      queue.desired.set(market.market_id, { status, revision: ++revision });
    }
    queues.set(productId, queue);
    cancelReads();
    render(); // Synchronous optimistic cache write, before any network wait.
    if (!existing) void flush(queue);
  }

  return { update, dispose: unsubscribe };
}
