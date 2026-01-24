'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import CatalogueScreen from '@/components/CatalogueScreen';

// TYPES & QUERIES
import type { Market, Product, ProductWithMarkets, ProductMarket, Supplier, Category, StockStatus } from '@/lib/types';
import { fetchProducts, fetchSuppliers, fetchMarkets, fetchCategories, createCategory, updateCategory, deleteCategory } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';

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

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: markets = [] } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });

  // PRODUCT MUTATIONS
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: any) => {
      // Map UI fields to DB schema (status is no longer in products table)
      const payload: any = {
        name: newProduct.name,
        code: newProduct.code || null,
        supplier_id: newProduct.supplier_id || null,
        category_id: newProduct.category_id,
        purchase_price: newProduct.prix_achat !== undefined ? newProduct.prix_achat : newProduct.purchase_price,
        sale_price: newProduct.prix_vente !== undefined ? newProduct.prix_vente : newProduct.sale_price,
      };

      // 1. Insert product first
      const { data: inserted, error: insertErr } = await supabase.from('products').insert([payload]).select().single();
      if (insertErr) throw insertErr;

      // 2. Automatically assign product to ALL markets
      // Fetch all markets to ensure we assign to all of them
      const { data: allMarkets, error: marketsErr } = await supabase
        .from('markets')
        .select('id');
      
      if (marketsErr) throw marketsErr;

      // 3. Use provided market_ids if available, otherwise use all markets
      const marketData = newProduct.market_ids || [];
      
      // If no markets provided or if we want to ensure all markets, use all markets
      const marketsToAssign = marketData.length > 0 
        ? marketData 
        : (allMarkets || []).map((m: { id: string }) => ({ market_id: m.id, status: 'available' }));
      
      // 4. Insert rows into junction table for each market with status
      if (marketsToAssign.length > 0) {
        const marketRelations = marketsToAssign.map((market: string | { market_id: string; status?: string }) => {
          // Handle both formats: string (market_id) or object {market_id, status}
          const marketId = typeof market === 'string' ? market : market.market_id;
          const status = (typeof market === 'object' && market.status) ? market.status : 'available';
          
          return {
            product_id: inserted.id,
            market_id: marketId,
            status: status, // Status per market-product combination
          };
        });
        
        const { error: marketErr } = await supabase
          .from('product_markets')
          .insert(marketRelations);
        
        if (marketErr) throw marketErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit créé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création du produit');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (product: ProductWithMarkets) => {
      const { product_markets, ...productData } = product;

      // 1. Update product scalar fields (WITHOUT relations and WITHOUT status)
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: productData.name,
          code: productData.code || null,
          purchase_price: productData.purchase_price,
          sale_price: productData.sale_price,
          supplier_id: productData.supplier_id,
          category_id: productData.category_id,
        })
        .eq('id', productData.id);

      if (productError) throw productError;

      // 2. Delete ALL existing entries in product_markets for this product_id
      const { error: deleteError } = await supabase
        .from('product_markets')
        .delete()
        .eq('product_id', productData.id);

      if (deleteError) throw deleteError;

      // 3. Automatically assign to ALL markets (products are always in all markets)
      // Fetch all markets to ensure we assign to all of them
      const { data: allMarkets, error: marketsFetchErr } = await supabase
        .from('markets')
        .select('id');
      
      if (marketsFetchErr) throw marketsFetchErr;

      // Use provided product_markets if available, otherwise use all markets with default status
      const marketsToAssign = product_markets && product_markets.length > 0
        ? product_markets
        : (allMarkets || []).map((m: { id: string }) => ({ market_id: m.id, status: 'available' as StockStatus }));

      // 4. Insert NEW rows into product_markets for all markets with status
      if (marketsToAssign.length > 0) {
        const marketRelations = marketsToAssign.map(pm => ({
          product_id: productData.id,
          market_id: pm.market_id,
          status: pm.status || 'available', // Include status per market
        }));

        const { error: marketsError } = await supabase
          .from('product_markets')
          .insert(marketRelations);

        if (marketsError) throw marketsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit mis à jour avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour du produit');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('products').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit supprimé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la suppression du produit');
    },
  });

  // SUPPLIER MUTATIONS
  const createSupplierMutation = useMutation({
    mutationFn: async (data: any) => supabase.from('suppliers').insert([data]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur créé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création du fournisseur');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      supabase.from('suppliers').update(data).eq('id', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur mis à jour avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour du fournisseur');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => supabase.from('suppliers').delete().eq('id', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur supprimé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la suppression du fournisseur');
    },
  });

  // CATEGORY MUTATIONS
  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notify.success('Catégorie créée avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création de la catégorie');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Category> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notify.success('Catégorie mise à jour avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour de la catégorie');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notify.success('Catégorie supprimée avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la suppression de la catégorie');
    },
  });

  // BULK IMPORT MUTATION
  const createBulkProductsMutation = useMutation({
    mutationFn: async (products: any[]) => {
      // Process all products in parallel
      const productPromises = products.map(async (product) => {
        // 1. Insert product first (status is no longer in products table)
        const { data: inserted, error: insertErr } = await supabase
          .from('products')
          .insert([{
            name: product.name,
            code: product.code,
            supplier_id: product.supplier_id,
            category_id: product.category_id,
            purchase_price: product.purchase_price,
            sale_price: product.sale_price,
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        // 2. Handle market relationships with status per market
        const marketData = product.market_ids || (product.market_id ? [product.market_id] : []);
        
        // 3. Insert rows into junction table for each selected market with status
        if (marketData.length > 0) {
          const marketRelations = marketData.map((market: string | { market_id: string; status?: string }) => {
            const marketId = typeof market === 'string' ? market : market.market_id;
            const status = (typeof market === 'object' && market.status) ? market.status : (product.status || 'available');
            
            return {
              product_id: inserted.id,
              market_id: marketId,
              status: status, // Status per market-product combination
            };
          });

          const { error: marketErr } = await supabase
            .from('product_markets')
            .insert(marketRelations);

          if (marketErr) throw marketErr;
        }

        return inserted;
      });

      // Wait for all products to be inserted
      return await Promise.all(productPromises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success(`${data.length} produit(s) importé(s) avec succès`);
    },
    onError: () => {
      notify.error('Erreur lors de l\'importation en masse des produits');
    },
  });

  // Wrapper handlers
  const handleCreateProduct = (data: any) => createProductMutation.mutate(data);
  const handleUpdateProduct = (id: string, data: Partial<Product> & { market_id?: string; market_ids?: string[] | Array<{ market_id: string; status?: string }> }) => {
    // Find the current product to get its existing product_markets data
    const currentProduct = products.find(p => p.id === id);
    if (currentProduct) {
      // Convert market_id (single) or market_ids (array) from form to product_markets array format with status
      let product_markets: Array<{ market_id: string; status: StockStatus }> = [];
      
      if (data.market_ids && Array.isArray(data.market_ids)) {
        // If market_ids array is provided, check if it's array of strings or objects
        if (data.market_ids.length > 0 && typeof data.market_ids[0] === 'object') {
          // Array of objects with market_id and status
          product_markets = (data.market_ids as Array<{ market_id: string; status?: StockStatus }>).map(m => ({
            market_id: m.market_id,
            status: (m.status || 'available') as StockStatus
          }));
        } else {
          // Array of strings (market IDs) - use existing status or default
          product_markets = (data.market_ids as string[]).map(marketId => {
            const existing = currentProduct.product_markets?.find(pm => pm.market_id === marketId);
            return {
              market_id: marketId,
              status: (existing?.status || 'available') as StockStatus
            };
          });
        }
      } else if (data.market_id) {
        // If single market_id is provided, convert to array with default status
        const existing = currentProduct.product_markets?.find(pm => pm.market_id === data.market_id);
        product_markets = [{ 
          market_id: data.market_id,
          status: (existing?.status || 'available') as StockStatus
        }];
      } else if (currentProduct.product_markets && currentProduct.product_markets.length > 0) {
        // If no market data in update, preserve existing markets with their statuses
        product_markets = currentProduct.product_markets.map(pm => ({
          market_id: pm.market_id,
          status: (pm.status || 'available') as StockStatus
        }));
      }

      // Remove market_id and market_ids from data before passing to mutation
      const { market_id, market_ids, ...productData } = data;

      updateProductMutation.mutate({
        ...currentProduct,
        ...productData,
        product_markets,
      });
    }
  };
  const handleDeleteProduct = (id: string) => deleteProductMutation.mutate(id);
  const handleCreateSupplier = (data: any) => createSupplierMutation.mutate(data);
  const handleUpdateSupplier = (id: string, data: any) => updateSupplierMutation.mutate({ id, data });
  const handleDeleteSupplier = (id: string) => deleteSupplierMutation.mutate(id);
  const handleCreateCategory = (data: any) => createCategoryMutation.mutate(data);
  const handleUpdateCategory = (id: string, data: any) => updateCategoryMutation.mutate({ id, data });
  const handleDeleteCategory = (id: string) => deleteCategoryMutation.mutate(id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        <CatalogueScreen
          products={products}
          suppliers={suppliers}
          markets={markets}
          categories={categories}
          onCreateProduct={handleCreateProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onCreateSupplier={handleCreateSupplier}
          onUpdateSupplier={handleUpdateSupplier}
          onDeleteSupplier={handleDeleteSupplier}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          onImportProducts={async (products: any[]) => {
            await createBulkProductsMutation.mutateAsync(products);
          }}
        />
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
