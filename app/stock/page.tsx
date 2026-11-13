'use client'
import { useState, useMemo, useRef } from 'react';
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
import { formatReorderQuantity, getReorderDetails, type ReorderUnit } from '@/lib/reorder';
import { matchesProductSearch } from '@/lib/search';

export default function StockPage() {
  // Default to 'all' to show all markets
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const stockLocks = useRef(new Set<string>());
  const [pendingProductIds, setPendingProductIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // FETCH DATA
  const marketsQuery = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });
  const { data: markets = [] } = marketsQuery;

  const productsQuery = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const { data: products = [] } = productsQuery;

  const productNames = useMemo(
    () => products.map((product) => product.name),
    [products]
  );

  // Status changes never overwrite saved reorder quantities or units.
  const updateStatusMutation = useMutation({
    mutationFn: async ({ productId, marketIds, status }: { productId: string; marketIds: string[]; status: StockStatus }) => {
      const { data, error } = await supabase
        .from('product_markets')
        .update({ status })
        .eq('product_id', productId)
        .in('market_id', marketIds)
        .select('market_id');
      
      if (error) throw error;
      if (!data || data.length !== marketIds.length) throw new Error('Mise à jour du stock incomplète.');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: () => notify.error('Impossible de modifier le statut du produit'),
  });

  const updateReorderMutation = useMutation({
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
    onSuccess: async ({ quantity, unit }) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success(`À racheter : ${formatReorderQuantity(quantity, unit)}`);
    },
    onError: (error) => {
      console.error('Error updating reorder details:', error);
      notify.error('Impossible d’enregistrer la quantité et l’unité');
    },
  });

  // Filter products by MARKET using the new relation array
  const marketProducts = useMemo<Array<ProductWithMarkets & { currentMarketStatus: StockStatus; currentMarketId: string }>>(() => {
    // If 'all' is selected, return all products with aggregated status
    if (selectedMarket === 'all') {
      return products.map(p => {
        // Calculate aggregated status: show the most critical status across all markets
        // Priority: 'out' > 'low' > 'available'
        let aggregatedStatus: StockStatus = 'available';
        
        if (p.product_markets && p.product_markets.length > 0) {
          const hasOut = p.product_markets.some(pm => pm.status === 'out');
          const hasLow = p.product_markets.some(pm => pm.status === 'low');
          
          if (hasOut) {
            aggregatedStatus = 'out';
          } else if (hasLow) {
            aggregatedStatus = 'low';
          } else {
            aggregatedStatus = 'available';
          }
        }
        
        return {
          ...p,
          currentMarketStatus: aggregatedStatus,
          currentMarketId: 'all', // Indicate we're showing all markets
        };
      });
    }

    // Otherwise, filter by the specific market ID and include market-specific status
    return products
      .filter(p => {
        // Check if product_markets exists and contains the selected market ID
        return p.product_markets?.some(pm => pm.market_id === selectedMarket);
      })
      .map(p => {
        // Find the status for the selected market
        const marketRelation = p.product_markets?.find(pm => pm.market_id === selectedMarket);
        return {
          ...p,
          currentMarketStatus: marketRelation?.status || 'available',
          currentMarketId: selectedMarket,
        };
      });
  }, [products, selectedMarket]);

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
        result = result.filter(p => p.currentMarketStatus === 'low');
      } else if (stockFilter === 'out') {
        result = result.filter(p => p.currentMarketStatus === 'out');
      }
    }

    return result;
  }, [marketProducts, searchQuery, stockFilter, selectedMarket]);

  const handleStatusChange = async (productId: string, newStatus: StockStatus) => {
    if (stockLocks.current.has(productId)) return;
    const product = marketProducts.find(p => p.id === productId);
    if (!product) return;

    const marketIds = selectedMarket === 'all'
      ? product.product_markets.map(market => market.market_id)
      : [selectedMarket];
    if (!marketIds.length) {
      notify.error('Aucun marché associé à ce produit');
      return;
    }
    stockLocks.current.add(productId);
    setPendingProductIds(new Set(stockLocks.current));
    try {
      await updateStatusMutation.mutateAsync({ productId, marketIds, status: newStatus });
    } catch {
      // The mutation displays a friendly error and leaves the previous status intact.
    } finally {
      stockLocks.current.delete(productId);
      setPendingProductIds(new Set(stockLocks.current));
    }
  };

  const handleReorderSave = async (productId: string, quantity: number, unit: ReorderUnit) => {
    const product = marketProducts.find(p => p.id === productId);
    if (!product) throw new Error('Produit introuvable.');

    const marketIds = selectedMarket === 'all'
      ? (product.product_markets || []).map(pm => pm.market_id)
      : [selectedMarket];

    if (marketIds.length === 0) throw new Error('Aucun marché associé à ce produit.');

    await updateReorderMutation.mutateAsync({ productId, marketIds, quantity, unit });
  };

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
          <QueryFeedback queries={[marketsQuery, productsQuery]} label="Chargement du stock…">
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
              filteredProducts.map((product) => {
                // Check if product has different statuses across markets (only when "all" is selected)
                const hasDifferentStatuses = selectedMarket === 'all' && 
                  product.product_markets && 
                  product.product_markets.length > 1 &&
                  new Set(product.product_markets.map(pm => pm.status)).size > 1;
                
                // Get status breakdown by market
                const statusByMarket = selectedMarket === 'all' && product.product_markets
                  ? product.product_markets.reduce<Record<StockStatus, string[]>>((acc, pm) => {
                      const status = pm.status || 'available';
                      acc[status].push(pm.market_id);
                      return acc;
                    }, { available: [], low: [], out: [] })
                  : undefined;

                const relevantMarketRelations = selectedMarket === 'all'
                  ? (product.product_markets || [])
                  : (product.product_markets || []).filter(pm => pm.market_id === selectedMarket);
                const currentReorder = getReorderDetails(relevantMarketRelations);

                return (
                  <ProductCard 
                    key={product.id} 
                    product={{
                      ...product,
                      currentMarketStatus: product.currentMarketStatus || 'available',
                      hasDifferentStatuses,
                      statusByMarket,
                      markets,
                      selectedMarket,
                      currentReorderQuantity: currentReorder.quantity,
                      currentReorderUnit: currentReorder.unit,
                    }} 
                    isUpdating={pendingProductIds.has(product.id)}
                    onStatusChange={handleStatusChange}
                    onReorderSave={handleReorderSave}
                  />
                );
              })
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
