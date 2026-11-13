'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import QueryFeedback from '@/components/QueryFeedback';
import BottomNav from '@/components/BottomNav';
import CatalogueScreen from '@/components/CatalogueScreen';

// TYPES & QUERIES
import type { Market, ProductDetailsInput, ProductWithMarkets, Supplier, Category } from '@/lib/types';
import { fetchProducts, fetchSuppliers, fetchMarkets, fetchCategories, createCategory, updateCategory, deleteCategory, saveProductDetails } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';

export default function CataloguePage() {
  const queryClient = useQueryClient();

  // FETCH DATA
  const productsQuery = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const { data: products = [] } = productsQuery;

  const suppliersQuery = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });
  const { data: suppliers = [] } = suppliersQuery;

  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: categories = [] } = categoriesQuery;

  const marketsQuery = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });
  const { data: markets = [] } = marketsQuery;

  // Save details and alternative links atomically. Stock rows are never rewritten.
  const createProductMutation = useMutation({
    mutationFn: (product: ProductDetailsInput) => saveProductDetails(product),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit créé avec succès');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductDetailsInput }) => saveProductDetails(data, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit mis à jour avec succès');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
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
    mutationFn: async (data: Omit<Supplier, 'id'>) => {
      const { error } = await supabase.from('suppliers').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur créé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création du fournisseur');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Supplier> }) => {
      const { error } = await supabase.from('suppliers').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur mis à jour avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour du fournisseur');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      notify.success('Fournisseur supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['products'] });
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

  // Wrapper handlers
  const handleCreateProduct = (data: ProductDetailsInput) => createProductMutation.mutateAsync(data);
  const handleUpdateProduct = (id: string, data: ProductDetailsInput) => updateProductMutation.mutateAsync({ id, data });
  const handleDeleteProduct = (id: string) => deleteProductMutation.mutateAsync(id);
  const handleCreateSupplier = (data: Omit<Supplier, 'id'>) => createSupplierMutation.mutateAsync(data);
  const handleUpdateSupplier = (id: string, data: Partial<Supplier>) => updateSupplierMutation.mutateAsync({ id, data });
  const handleDeleteSupplier = (id: string) => deleteSupplierMutation.mutateAsync(id);
  const handleCreateCategory = async (data: Omit<Category, 'id'>) => { await createCategoryMutation.mutateAsync(data); };
  const handleUpdateCategory = async (id: string, data: Partial<Category>) => { await updateCategoryMutation.mutateAsync({ id, data }); };
  const handleDeleteCategory = (id: string) => deleteCategoryMutation.mutateAsync(id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        <div className="px-4 sm:px-6"><QueryFeedback queries={[productsQuery, suppliersQuery, categoriesQuery, marketsQuery]} label="Chargement du catalogue…">
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

        />
        </QueryFeedback></div>
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
