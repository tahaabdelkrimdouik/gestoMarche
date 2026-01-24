'use client'
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import SupplierCard from '@/components/SupplierCard';
import SupplierDrawer from '@/components/SupplierDrawer';
import SupplierFormDialog from '@/components/SupplierFormDialog';
import FloatingActionButton from '@/components/FloatingActionButton';
import { Input } from '@/components/ui/input';
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
import { Pencil, Phone, Mail } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { notify } from '@/lib/utils/notify';

// TYPES & QUERIES
import type { ProductWithMarkets, Supplier } from '@/lib/types';
import { fetchProducts, fetchSuppliers } from '@/lib/queries';

export default function SuppliersPage() {
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const queryClient = useQueryClient();


  // FETCH DATA
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });





  // Supplier Filters
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => (s.name ?? '').toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  const getSupplierAlertCount = (supplierId: string): number => {
    return products.filter((p) => {
      // Check if product belongs to this supplier
      if (p.supplier_id !== supplierId) return false;

      const markets = p.product_markets || [];
      if (markets.length === 0) return false;

      // Business Rule:
      // - Only count products with "low" status (à racheter) - these need supplier purchase
      // - "low" is GLOBAL: if product is "low" in any market, it means product doesn't exist in stock
      // - Exclude products with "out" status (épuisé) - these can be transferred from another market
      const hasLowStatus = markets.some((pm) => pm.status === 'low');
      
      return hasLowStatus;
    }).length;
  };

  const supplierProducts = useMemo(() => {
    if (!selectedSupplier) return [];
    // Show ALL products for this supplier, not just those in the current market
    // This ensures the drawer shows all critical products regardless of market
    return products.filter(p => p.supplier_id === selectedSupplier.id);
  }, [selectedSupplier, products]);

  // SUPPLIER MUTATIONS
  const createSupplierMutation = useMutation({
    mutationFn: async (data: { name: string; phone_number: string; email?: string }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsFormDialogOpen(false);
      setEditingSupplier(null);
      notify.success('Fournisseur créé avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création du fournisseur');
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Supplier> }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsFormDialogOpen(false);
      setEditingSupplier(null);
      notify.success('Fournisseur mis à jour avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour du fournisseur');
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if supplier has associated products
      const supplierProducts = products.filter(p => p.supplier_id === id);
      if (supplierProducts.length > 0) {
        throw new Error(`Impossible de supprimer ce fournisseur car ${supplierProducts.length} produit(s) y sont associé(s).`);
      }

      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteConfirm({ isOpen: false, id: null });
      notify.success('Fournisseur supprimé avec succès');
    },
    onError: (error: Error) => {
      notify.error(error.message || 'Erreur lors de la suppression du fournisseur');
    },
  });

  const handleSupplierClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDrawerOpen(true);
  };

  const handleEditSupplierFromDrawer = () => {
    if (selectedSupplier) {
      setIsDrawerOpen(false);
      setEditingSupplier(selectedSupplier);
      setIsFormDialogOpen(true);
    }
  };

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsFormDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormDialogOpen(true);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setDeleteConfirm({ isOpen: true, id: supplier.id });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      deleteSupplierMutation.mutate(deleteConfirm.id);
    }
  };

  const handleSupplierSubmit = (data: { name: string; phone_number: string; email?: string }) => {
    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data });
    } else {
      createSupplierMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Fournisseurs</h1>
            <p className="text-sm sm:text-base text-gray-500">Gérez vos fournisseurs</p>
          </div>
        </div>
      </div>

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
                                <div className="space-y-1">
                                  {supplier.phone_number && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="w-3 h-3 text-gray-400" />
                                      {supplier.phone_number}
                                    </div>
                                  )}
                                  {supplier.email && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <Mail className="w-3 h-3 text-gray-400" />
                                      {supplier.email}
                                    </div>
                                  )}
                                  {!supplier.phone_number && !supplier.email && '-'}
                                </div>
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
                                    onClick={() => handleEditSupplier(supplier)}
                                    className="min-h-[40px] min-w-[40px] hover:bg-gray-100"
                                  >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteSupplier(supplier)}
                                    className="min-h-[40px] min-w-[40px] hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
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
        onEditSupplier={handleEditSupplierFromDrawer}
      />

      {/* Supplier Form Dialog */}
      <SupplierFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => {
          setIsFormDialogOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleSupplierSubmit}
        supplier={editingSupplier}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, id: null })}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700"
              disabled={deleteSupplierMutation.isPending}
            >
              {deleteSupplierMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Button */}
      <FloatingActionButton label="Ajouter" onClick={handleAddSupplier} />

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
