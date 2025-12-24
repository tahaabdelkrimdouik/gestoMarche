'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import CatalogueScreen from '@/components/CatalogueScreen';

// TYPES & QUERIES
import type { Market, Product, ProductWithMarkets, Supplier } from '@/lib/types';
import { fetchProducts, fetchSuppliers, fetchMarkets } from '@/lib/queries';

export default function CataloguePage() {
  const queryClient = useQueryClient();

  // FETCH DATA
  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });

  // PRODUCT MUTATIONS
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      // Map UI fields to DB schema
      const payload: any = {
        name: newProduct.name,
        status: newProduct.status,
        supplier_id: newProduct.supplier_id || null,
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

  // SUPPLIER MUTATIONS
  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => supabase.from('suppliers').insert([data]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      supabase.from('suppliers').update(data).eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => supabase.from('suppliers').delete().eq('id', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

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
      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
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
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
