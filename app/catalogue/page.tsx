'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import CatalogueScreen from '@/components/CatalogueScreen';

// TYPES & QUERIES
import type { Market, Product, ProductWithMarkets, Supplier, Category } from '@/lib/types';
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
      // Map UI fields to DB schema
      const payload: any = {
        name: newProduct.name,
        code: newProduct.code || null,
        status: newProduct.status,
        supplier_id: newProduct.supplier_id || null,
        category_id: newProduct.category_id,
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

      // 1️⃣ Update product (WITHOUT relations)
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: productData.name,
          code: productData.code || null,
          purchase_price: productData.purchase_price,
          sale_price: productData.sale_price,
          status: productData.status,
          supplier_id: productData.supplier_id,
          category_id: productData.category_id,
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
        // Insert product first
        const { data: inserted, error: insertErr } = await supabase
          .from('products')
          .insert([{
            name: product.name,
            code: product.code,
            status: product.status,
            supplier_id: product.supplier_id,
            category_id: product.category_id,
            purchase_price: product.purchase_price,
            sale_price: product.sale_price,
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        // If market_id is provided, create the relationship
        if (product.market_id) {
          const { error: marketErr } = await supabase
            .from('product_markets')
            .insert([{
              product_id: inserted.id,
              market_id: product.market_id,
            }]);

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
