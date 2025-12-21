'use client'
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient'; // Needed for mutations only
import { Search } from 'lucide-react';

// COMPONENTS
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import StockFilters from '@/components/StockFilters';
import ProductCard from '@/components/ProductCard';
import SupplierCard from '@/components/SupplierCard';
import SupplierDrawer from '@/components/SupplierDrawer';
import SettingsScreen from '@/components/SettingsScreen';
import CatalogueScreen from '@/components/CatalogueScreen';
import EmptyState from '@/components/EmptyState';
import { Input } from '@/components/ui/input';

// TYPES & QUERIES
import type { Market, Product, ProductWithMarkets, Supplier, StockStatus } from '@/lib/types';
// adjust the path below to where your queries.ts file is located
import { fetchProducts, fetchSuppliers, fetchMarkets } from '@/lib/queries'; 

export default function Home() {
  const [activeTab, setActiveTab] = useState('stock');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const queryClient = useQueryClient();

  // --- 1. FETCH DATA (USING YOUR QUERIES FILE) ---
  
  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });

  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  // --- 2. MUTATIONS (Stay local for now) ---
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StockStatus }) => {
      await supabase.from('products').update({ status }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const createProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      // Map UI fields to DB schema
      const payload: any = {
        name: newProduct.name,
        status: newProduct.status,
        supplier_id: newProduct.supplier_id || null,
        category: newProduct.category || null,
        purchase_price: newProduct.prix_achat !== undefined ? newProduct.prix_achat : newProduct.purchase_price,
        sale_price: newProduct.prix_vente !== undefined ? newProduct.prix_vente : newProduct.sale_price,
      };

      // Insert product first
      const { data: inserted, error: insertErr } = await supabase.from('products').insert([payload]).select().single();
      if (insertErr) throw insertErr;

      // If a market was provided from the form (single market), insert relation into product_markets
      const marketId = newProduct.market_id;
      if (marketId) {
        await supabase.from('product_markets').insert([{ product_id: inserted.id, market_id: marketId }]);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

const updateProductMutation = useMutation({
  mutationFn: async (product: ProductWithMarkets) => {
    const { product_markets, ...productData } = product;

    // 1️⃣ Update product (WITHOUT relations)
    const { error: productError } = await supabase
      .from('products')
      .update({
        name: productData.name,
        purchase_price: productData.purchase_price,
        sale_price: productData.sale_price,
        status: productData.status,
        supplier_id: productData.supplier_id,
      })
      .eq('id', productData.id);

    if (productError) throw productError;

    // 2️⃣ Sync markets (relation table)
    await supabase
      .from('product_markets')
      .delete()
      .eq('product_id', productData.id);

    if (product_markets?.length) {
      const { error: marketsError } = await supabase
        .from('product_markets')
        .insert(
          product_markets.map(pm => ({
            product_id: productData.id,
            market_id: pm.market_id,
          }))
        );

      if (marketsError) throw marketsError;
    }
  },

  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  },
});


  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('products').delete().eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  // Supplier mutations...
  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => supabase.from('suppliers').insert([data]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });
  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => supabase.from('suppliers').update(data).eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });
  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => supabase.from('suppliers').delete().eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  // --- 3. FILTERING LOGIC ---

  // Set default market
  useEffect(() => {
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


  // --- 4. RENDER ---

  const handleStatusChange = (productId: string, newStatus: StockStatus) => updateStatusMutation.mutate({ id: productId, status: newStatus });
  const handleSupplierClick = (supplier: Supplier) => { setSelectedSupplier(supplier); setIsDrawerOpen(true); };
  
  // Wrapper handlers
  const handleCreateProduct = (data: any) => createProductMutation.mutate(data);
  const handleUpdateProduct = (id: string, data: Partial<Product>) => {
    // Find the current product to get its product_markets data
    const currentProduct = products.find(p => p.id === id);
    if (currentProduct) {
      updateProductMutation.mutate({
        ...currentProduct,
        ...data,
      });
    }
  };
  const handleDeleteProduct = (id: string) => deleteProductMutation.mutate(id);
  const handleCreateSupplier = (data: any) => createSupplierMutation.mutate(data);
  const handleUpdateSupplier = (id: string, data: any) => updateSupplierMutation.mutate({ id, data });
  const handleDeleteSupplier = (id: string) => deleteSupplierMutation.mutate(id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      {activeTab !== 'settings' && activeTab !== 'catalogue' && (
        <Header
          markets={markets}
          selectedMarket={selectedMarket}
          onMarketChange={setSelectedMarket}
          searchQuery={activeTab === 'stock' ? searchQuery : ''}
          onSearchChange={activeTab === 'stock' ? setSearchQuery : () => {}}
        />
      )}

      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        
        {/* TAB: STOCK */}
        {activeTab === 'stock' && (
          <>
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
          </>
        )}

        {/* TAB: SUPPLIERS */}
        {activeTab === 'suppliers' && (
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
        )}

        {/* TAB: CATALOGUE */}
        {activeTab === 'catalogue' && (
          <CatalogueScreen
            products={products}
            suppliers={suppliers}
            markets={markets}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onCreateSupplier={handleCreateSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* FOOTER */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <SupplierDrawer
        isOpen={isDrawerOpen && selectedSupplier !== null}
        supplier={selectedSupplier!}
        products={supplierProducts}
        onClose={() => { setIsDrawerOpen(false); setSelectedSupplier(null); }}
      />
    </div>
  );
}