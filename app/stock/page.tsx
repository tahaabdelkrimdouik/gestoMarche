'use client'
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import Header from '@/components/Header';
import QueryFeedback from '@/components/QueryFeedback';
import BottomNav from '@/components/BottomNav';
import StockFilters from '@/components/StockFilters';
import ProductCard from '@/components/ProductCard';
import EmptyState from '@/components/EmptyState';

// TYPES & QUERIES
import type { Market, ProductWithMarkets, StockStatus } from '@/lib/types';
import { fetchProducts, fetchMarkets } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';
import type { ReorderUnit } from '@/lib/reorder';
import { PRODUCTS_QUERY_KEY, getStockStatus, patchProductMarkets } from '@/lib/stockStatus';
import { useOptimisticStockStatus } from '@/hooks/useOptimisticStockStatus';
import { matchesProductSearch } from '@/lib/search';

export default function StockPage() {
  // Default to 'all' to show all markets
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const queryClient = useQueryClient();
  const updateStatus = useOptimisticStockStatus();

  // FETCH DATA
  const marketsQuery = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });
  const { data: markets = [] } = marketsQuery;

  const productsQuery = useQuery<ProductWithMarkets[]>({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: fetchProducts,
  });
  const { data: products = [] } = productsQuery;

  const productNames = useMemo(
    () => products.map((product) => product.name),
    [products]
  );

  const updateReorderMutation = useMutation({
    meta: { silent: true },
    networkMode: 'always',
    mutationFn: async ({ productId, marketIds, quantity, unit }: {
      productId: string;
      marketIds: string[];
      quantity: number;
      unit: ReorderUnit;
    }) => {
      const { data, error } = await supabase
        .from('product_markets')
        .update({
          reorder_quantity: quantity,
          reorder_unit: unit,
        })
        .eq('product_id', productId)
        .in('market_id', marketIds)
        .select('market_id');

      if (error) throw error;
      if (!data || data.length !== marketIds.length) {
        throw new Error('Certaines lignes produit-marché n’ont pas été mises à jour.');
      }

      return { quantity, unit };
    },
    onSuccess: (_, { productId, marketIds, quantity, unit }) => {
      queryClient.setQueryData<ProductWithMarkets[]>(PRODUCTS_QUERY_KEY, products =>
        patchProductMarkets(products, productId, marketIds, { reorder_quantity: quantity, reorder_unit: unit }));
    },
  });
  const saveReorder = updateReorderMutation.mutateAsync;

  // Retain raw product references so memoized cards for other products do not render.
  const marketProducts = useMemo(() => selectedMarket === 'all' ? products
    : products.filter(product => product.product_markets.some(market => market.market_id === selectedMarket)),
  [products, selectedMarket]);

  // Global Filter (Search + Status) - now filters by status per market
  const filteredProducts = useMemo(() => {
    let result = marketProducts;

    if (searchQuery) {
      result = result.filter(p => matchesProductSearch(searchQuery, p.name));
    }

    if (selectedMarket === 'all') {
      // When "all" is selected, show product if it has at least one market with the filtered status
      if (stockFilter === 'low') {
        result = result.filter(p => 
          p.product_markets?.some(pm => pm.status === 'low')
        );
      } else if (stockFilter === 'out') {
        result = result.filter(p => 
          p.product_markets?.some(pm => pm.status === 'out')
        );
      }
      // If stockFilter === 'all', show all products
    } else {
      // When specific market is selected, filter by that market's status
      if (stockFilter === 'low') {
        result = result.filter(p => getStockStatus(p, selectedMarket) === 'low');
      } else if (stockFilter === 'out') {
        result = result.filter(p => getStockStatus(p, selectedMarket) === 'out');
      }
    }

    return result;
  }, [marketProducts, searchQuery, stockFilter, selectedMarket]);

  const handleStatusChange = useCallback((productId: string, status: StockStatus) => {
    const product = queryClient.getQueryData<ProductWithMarkets[]>(PRODUCTS_QUERY_KEY)?.find(product => product.id === productId);
    if (!product) return;
    const marketIds = product.product_markets
      .filter(market => selectedMarket === 'all' || market.market_id === selectedMarket)
      .map(market => market.market_id);
    if (!marketIds.length) {
      notify.error('Aucun marché associé à ce produit');
      return;
    }
    updateStatus({ productId, marketIds, status });
  }, [queryClient, selectedMarket, updateStatus]);

  const handleReorderSave = useCallback(async (productId: string, quantity: number, unit: ReorderUnit) => {
    const product = queryClient.getQueryData<ProductWithMarkets[]>(PRODUCTS_QUERY_KEY)?.find(product => product.id === productId);
    if (!product) throw new Error('Produit introuvable.');
    const marketIds = product.product_markets
      .filter(market => selectedMarket === 'all' || market.market_id === selectedMarket)
      .map(market => market.market_id);
    if (!marketIds.length) throw new Error('Aucun marché associé à ce produit.');
    await saveReorder({ productId, marketIds, quantity, unit });
  }, [queryClient, selectedMarket, saveReorder]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <Header
        markets={markets}
        selectedMarket={selectedMarket}
        onMarketChange={setSelectedMarket}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        productNames={productNames}
      />

      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        {/* Fixed Stock Filters */}
        <div className="sticky top-[141px] z-40 bg-white border-b border-gray-200 shadow-sm">
          <StockFilters activeFilter={stockFilter} onFilterChange={setStockFilter} />
        </div>
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:pt-6">
          <QueryFeedback queries={[marketsQuery, productsQuery]} label="Chargement du stock…" showBackgroundActivity={false}>
          <p className="mb-3 text-sm text-gray-500">{filteredProducts.length} produit{filteredProducts.length !== 1 ? 's' : ''}</p>
          <div className="space-y-3 sm:space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.length === 0 ? (
              <EmptyState
                type={searchQuery ? 'search' : 'products'}
                title={searchQuery || stockFilter !== 'all' || selectedMarket !== 'all' ? 'Aucun résultat' : 'Aucun produit'}
                description={searchQuery || stockFilter !== 'all' || selectedMarket !== 'all' ? 'Aucun produit ne correspond aux filtres sélectionnés.' : 'Ajoutez des produits dans le catalogue pour commencer.'}
              />
            ) : (
              filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  markets={markets}
                  selectedMarket={selectedMarket}
                  onStatusChange={handleStatusChange}
                  onReorderSave={handleReorderSave}
                />
              ))
            )}
          </AnimatePresence>
          </div>
          </QueryFeedback>
        </div>
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
