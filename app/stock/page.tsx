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

  // MUTATION FOR STATUS UPDATE
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StockStatus }) => {
      await supabase.from('products').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  // Filter products by MARKET using the new relation array
  const marketProducts = useMemo(() => {
    // If 'all' is selected, return all products without filtering
    if (selectedMarket === 'all') {
      return products;
    }

    // Otherwise, filter by the specific market ID
    return products.filter(p => {
      // Check if product_markets exists and contains the selected market ID
      return p.product_markets?.some((pm: any) => pm.market_id === selectedMarket);
    });
  }, [products, selectedMarket]);

  // Global Filter (Search + Status)
  const filteredProducts = useMemo(() => {
    let result = marketProducts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }

    if (stockFilter === 'low') result = result.filter(p => p.status === 'low');
    else if (stockFilter === 'out') result = result.filter(p => p.status === 'out');

    return result;
  }, [marketProducts, searchQuery, stockFilter]);

  const handleStatusChange = (productId: string, newStatus: StockStatus) =>
    updateStatusMutation.mutate({ id: productId, status: newStatus });

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
        <StockFilters activeFilter={stockFilter} onFilterChange={setStockFilter} />
        <div className="px-4 space-y-3 sm:space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.length === 0 ? (
              <EmptyState
                type={searchQuery ? 'search' : 'products'}
                title={searchQuery ? 'Aucun résultat' : 'Aucun produit'}
                description={searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Ajoutez des produits pour commencer'}
              />
            ) : (
              filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onStatusChange={handleStatusChange} />
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}