'use client'
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import StockFilters from '@/components/StockFilters';
import ProductCard from '@/components/ProductCard';
import EmptyState from '@/components/EmptyState';

// TYPES & QUERIES
import type { Market, ProductWithMarkets, StockStatus } from '@/lib/types';
import { fetchProducts, fetchMarkets } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';
import { formatReorderQuantity, getReorderDetails, type ReorderUnit } from '@/lib/reorder';

export default function StockPage() {
  // Default to 'all' to show all markets
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const queryClient = useQueryClient();

  // FETCH DATA
  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });

  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // MUTATION FOR STATUS UPDATE (per product-market combination)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ productId, marketId, status }: { productId: string; marketId: string; status: StockStatus }) => {
      // Update status in product_markets junction table
      const { error } = await supabase
        .from('product_markets')
        .update({ status })
        .eq('product_id', productId)
        .eq('market_id', marketId);
      
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
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
          status: 'low',
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
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
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

  const handleStatusChange = (productId: string, newStatus: StockStatus) => {
    const product = marketProducts.find(p => p.id === productId);
    if (!product) return;

    if (selectedMarket === 'all') {
      // If "all" is selected, update status for ALL markets of this product
      if (product.product_markets && product.product_markets.length > 0) {
        // Update status for all markets of this product
        const updatePromises = product.product_markets.map(pm =>
          supabase
            .from('product_markets')
            .update({ status: newStatus })
            .eq('product_id', productId)
            .eq('market_id', pm.market_id)
        );
        
        Promise.all(updatePromises)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
          })
          .catch((error) => {
            console.error('Error updating status for all markets:', error);
          });
      }
    } else {
      // Update status for the specific market
      updateStatusMutation.mutate({ 
        productId, 
        marketId: selectedMarket, 
        status: newStatus 
      });
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
      />

      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        {/* Fixed Stock Filters */}
        <div className="sticky top-[140px] z-40 bg-white border-b border-gray-200 shadow-sm">
          <StockFilters activeFilter={stockFilter} onFilterChange={setStockFilter} />
        </div>
        <div className="px-4 space-y-3 sm:space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.length === 0 ? (
              <EmptyState
                type={searchQuery ? 'search' : 'products'}
                title={searchQuery ? 'Aucun résultat' : 'Aucun produit'}
                description={searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Ajoutez des produits pour commencer'}
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
                    onStatusChange={handleStatusChange}
                    onReorderSave={handleReorderSave}
                  />
                );
              })
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
