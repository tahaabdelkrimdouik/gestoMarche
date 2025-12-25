'use client'
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Search, Filter } from 'lucide-react';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import SupplierCard from '@/components/SupplierCard';
import SupplierDrawer from '@/components/SupplierDrawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Phone } from 'lucide-react';

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

  // Set default to "all" markets for better visibility of all supplier alerts
  React.useEffect(() => {
    if (!selectedMarket) {
      setSelectedMarket('all');
    }
  }, [selectedMarket]);

  // Filter products by MARKET using the new relation array (or show all if 'all' selected)
  const marketProducts = useMemo(() => {
    if (!selectedMarket || selectedMarket === 'all') return products;

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
    return products.filter(
      (p) => p.supplier_id === supplierId && (p.status === 'low' || p.status === 'out')
    ).length;
  };

  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) return [];
    // Show ALL products for this supplier, not just those in the current market
    // This ensures the drawer shows all critical products regardless of market
    return products.filter(p => p.supplier_id === selectedSupplier.id);
  }, [selectedSupplier, products]);

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

          {/* Market Filter */}
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-full min-h-[48px] pl-12 pr-4 border-0 bg-white rounded-xl text-base shadow-sm touch-manipulation">
                <SelectValue placeholder="Filtrer par marché" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les marchés</SelectItem>
                {markets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
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

          {/* Desktop Table View */}
          <div className="hidden md:block">
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun fournisseur trouvé</p>
              </div>
            ) : (
              <Card className="overflow-hidden border-0 shadow-sm rounded-2xl">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-sm whitespace-nowrap">Fournisseur</TableHead>
                        <TableHead className="font-semibold text-sm whitespace-nowrap">Téléphone</TableHead>
                        <TableHead className="font-semibold text-sm whitespace-nowrap">Alertes</TableHead>
                        <TableHead className="font-semibold text-sm text-center whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {filteredSuppliers.map((supplier) => {
                          const alertCount = getSupplierAlertCount(supplier.id);
                          return (
                            <TableRow key={supplier.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-gray-900 text-sm">
                                {supplier.name}
                              </TableCell>
                              <TableCell className="text-gray-600 text-sm">
                                {supplier.phone_number || '-'}
                              </TableCell>
                              <TableCell>
                                {alertCount > 0 && (
                                  <div className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-red-100 text-red-600 text-sm font-semibold">
                                    {alertCount}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-2">
                                  {supplier.phone_number && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => window.open(`tel:${supplier.phone_number}`, '_self')}
                                      className="min-h-[40px] min-w-[40px] hover:bg-green-50"
                                    >
                                      <Phone className="w-4 h-4 text-green-600" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSupplierClick(supplier)}
                                    className="min-h-[40px] min-w-[40px] hover:bg-gray-100"
                                  >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
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
