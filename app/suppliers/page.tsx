'use client'
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { Search } from 'lucide-react';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import SupplierCard from '@/components/SupplierCard';
import SupplierDrawer from '@/components/SupplierDrawer';
import { Input } from '@/components/ui/input';

// TYPES & QUERIES
import type { Market, ProductWithMarkets, Supplier } from '@/lib/types';
import { fetchProducts, fetchSuppliers, fetchMarkets } from '@/lib/queries';

export default function SuppliersPage() {
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState('');

  const queryClient = useQueryClient();

  // FETCH DATA
  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // Set default market
  React.useEffect(() => {
    if (markets.length > 0 && !selectedMarket) {
      setTimeout(() => setSelectedMarket(markets[0].id), 0);
    }
  }, [markets, selectedMarket]);

  // Filter products by MARKET using the new relation array
  const marketProducts = useMemo(() => {
    if (!selectedMarket) return products;

    return products.filter(p => {
      // Check if product_markets exists and contains the selected market ID
      return p.product_markets?.some((pm: any) => pm.market_id === selectedMarket);
    });
  }, [products, selectedMarket]);

  // Supplier Filters
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => (s.name ?? '').toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  const getSupplierAlertCount = (supplierId: string): number => {
    return marketProducts.filter(
      (p) => p.supplier_id === supplierId && (p.status === 'low' || p.status === 'out')
    ).length;
  };

  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) return [];
    return marketProducts.filter(p => p.supplier_id === selectedSupplier.id);
  }, [selectedSupplier, marketProducts]);

  const handleSupplierClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        <div className="px-4 py-4 space-y-3 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-full min-h-[48px] pl-12 pr-4 border-0 bg-white rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredSuppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  alertCount={getSupplierAlertCount(supplier.id)}
                  onClick={() => handleSupplierClick(supplier)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <SupplierDrawer
        isOpen={isDrawerOpen && selectedSupplier !== null}
        supplier={selectedSupplier!}
        products={supplierProducts}
        onClose={() => { setIsDrawerOpen(false); setSelectedSupplier(null); }}
      />

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
