'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShoppingCart, Trash2, Calendar, User, Package } from 'lucide-react';

import BottomNav from '@/components/BottomNav';
import EmptyState from '@/components/EmptyState';
import OrderFormDialog from '@/components/OrderFormDialog';
import { Button } from '@/components/ui/button';
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

import type { Order, ProductWithMarkets } from '@/lib/types';
import { fetchOrders, createOrder, deleteOrder, fetchProducts } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  // Fetch products for the order form
  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: { client_name: string; items: { product_id: string; quantity: number }[] }) => {
      return createOrder(data.client_name, data.items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsDialogOpen(false);
      notify.success('Commande créée avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création de la commande');
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setOrderToDelete(null);
      notify.success('Commande supprimée avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la suppression de la commande');
    },
  });

  const handleCreateOrder = (data: { client_name: string; items: { product_id: string; quantity: number }[] }) => {
    createOrderMutation.mutate(data);
  };

  const handleDeleteOrder = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate(orderToDelete.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Commandes</h1>
                <p className="text-sm text-gray-500">
                  {orders.length} commande{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-24 sm:pb-28">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            type="orders"
            title="Aucune commande"
            description="Créez votre première commande en cliquant sur le bouton ci-dessus"
          />
        ) : (
          <div className="p-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {order.client_name || 'Client inconnu'}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(order.created_at)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOrderToDelete(order)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        aria-label="Supprimer la commande"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        {order.items.length} produit{order.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item, itemIndex) => (
                        <div
                          key={item.id || itemIndex}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl"
                        >
                          <span className="text-sm text-gray-700">
                            {item.product_name || 'Produit inconnu'}
                          </span>
                          <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            x{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Order Form Dialog */}
      <OrderFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateOrder}
        products={products}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la commande</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la commande de{' '}
              <span className="font-medium">{orderToDelete?.client_name || 'ce client'}</span> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
