'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShoppingCart, Trash2, Calendar, User, Package, Pencil } from 'lucide-react';

import BottomNav from '@/components/BottomNav';
import EmptyState from '@/components/EmptyState';
import OrderFormDialog, { OrderFormSubmitData } from '@/components/OrderFormDialog';
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

import type { Order, ProductWithMarkets, OrderItemUnit } from '@/lib/types';
import { fetchOrders, createOrder, updateOrder, deleteOrder, fetchProducts } from '@/lib/queries';
import { notify } from '@/lib/utils/notify';

function formatQuantityDisplay(quantity: number, unit?: string): string {
  const u = unit || 'pièce';
  if (u === 'kg') return `${quantity} kg`;
  if (u === 'g') return `${quantity} g`;
  if (quantity === 1) return `1 ${u}`;
  return `${quantity} ${u}s`;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  const { data: products = [] } = useQuery<ProductWithMarkets[]>({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormSubmitData) => {
      return createOrder(data.client_name, data.items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsDialogOpen(false);
      setOrderToEdit(null);
      notify.success('Commande créée avec succès');
    },
    onError: () => {
      notify.error('Erreur lors de la création de la commande');
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: OrderFormSubmitData }) => {
      return updateOrder(orderId, data.client_name, data.items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsDialogOpen(false);
      setOrderToEdit(null);
      notify.success('Commande mise à jour');
    },
    onError: () => {
      notify.error('Erreur lors de la mise à jour de la commande');
    },
  });

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

  const handleSubmit = (data: OrderFormSubmitData, orderId?: string) => {
    if (orderId) {
      updateOrderMutation.mutate({ orderId, data });
    } else {
      createOrderMutation.mutate(data);
    }
  };

  const openCreate = () => {
    setOrderToEdit(null);
    setIsDialogOpen(true);
  };

  const openEdit = (order: Order) => {
    setOrderToEdit(order);
    setIsDialogOpen(true);
  };

  const handleDeleteOrder = () => {
    if (orderToDelete) deleteOrderMutation.mutate(orderToDelete.id);
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
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Commandes</h1>
                <p className="text-xs text-gray-500">
                  {orders.length} commande{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              onClick={openCreate}
              className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Nouvelle
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-20 sm:pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            type="orders"
            title="Aucune commande"
            description="Créez votre première commande en cliquant sur le bouton ci-dessus"
          />
        ) : (
          <div className="p-3 space-y-2.5">
            <AnimatePresence mode="popLayout">
              {orders.map((order, index) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="p-3 border-b border-gray-50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">
                          {order.client_name || 'Client inconnu'}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          {formatDate(order.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(order)}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        aria-label="Modifier la commande"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOrderToDelete(order)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        aria-label="Supprimer la commande"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Package className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        {order.items.length} produit{order.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {order.items.map((item, itemIndex) => (
                        <div
                          key={item.id || itemIndex}
                          className="flex items-center justify-between py-1.5 px-2.5 bg-gray-50 rounded-lg"
                        >
                          <span className="text-xs text-gray-700 truncate flex-1 min-w-0 mr-2">
                            {item.product_name || 'Produit inconnu'}
                          </span>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex-shrink-0">
                            {formatQuantityDisplay(item.quantity, item.unit)}
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

      <OrderFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setOrderToEdit(null);
        }}
        onSubmit={handleSubmit}
        products={products}
        order={orderToEdit}
      />

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

      <BottomNav />
    </div>
  );
}
