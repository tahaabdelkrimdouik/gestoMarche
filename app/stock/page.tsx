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

  // Filter products by MARKET using the new relation array
  const marketProducts = useMemo(() => {
    // If 'all' is selected, return all products with aggregated status
    if (selectedMarket === 'all') {
      return products.map(p => {
        // Calculate aggregated status: show the most critical status across all markets
        // Priority: 'out' > 'low' > 'available'
        let aggregatedStatus: StockStatus = 'available';
        
        if (p.product_markets && p.product_markets.length > 0) {
          const hasOut = p.product_markets.some((pm: any) => pm.status === 'out');
          const hasLow = p.product_markets.some((pm: any) => pm.status === 'low');
          
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
        return p.product_markets?.some((pm: any) => pm.market_id === selectedMarket);
      })
      .map(p => {
        // Find the status for the selected market
        const marketRelation = p.product_markets?.find((pm: any) => pm.market_id === selectedMarket);
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
          p.product_markets?.some((pm: any) => pm.status === 'low')
        );
      } else if (stockFilter === 'out') {
        result = result.filter(p => 
          p.product_markets?.some((pm: any) => pm.status === 'out')
        );
      }
      // If stockFilter === 'all', show all products
    } else {
      // When specific market is selected, filter by that market's status
      if (stockFilter === 'low') {
        result = result.filter(p => (p as any).currentMarketStatus === 'low');
      } else if (stockFilter === 'out') {
        result = result.filter(p => (p as any).currentMarketStatus === 'out');
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
        const updatePromises = product.product_markets.map((pm: any) =>
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
                  new Set(product.product_markets.map((pm: any) => pm.status)).size > 1;
                
                // Get status breakdown by market
                const statusByMarket = selectedMarket === 'all' && product.product_markets
                  ? product.product_markets.reduce((acc: any, pm: any) => {
                      const status = pm.status || 'available';
                      if (!acc[status]) acc[status] = [];
                      acc[status].push(pm.market_id);
                      return acc;
                    }, {})
                  : null;

                return (
                  <ProductCard 
                    key={product.id} 
                    product={{
                      ...product,
                      currentMarketStatus: (product as any).currentMarketStatus || 'available',
                      hasDifferentStatuses,
                      statusByMarket,
                      markets,
                      selectedMarket,
                    }} 
                    onStatusChange={handleStatusChange} 
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