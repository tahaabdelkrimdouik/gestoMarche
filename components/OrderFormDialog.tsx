'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, User, Plus, Trash2, Package, Hash } from 'lucide-react';
import type { ProductWithMarkets } from '@/lib/types';

interface OrderFormItem {
  id: string;
  product_id: string;
  quantity: number;
}

interface OrderFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { client_name: string; items: { product_id: string; quantity: number }[] }) => void;
  products: ProductWithMarkets[];
}

export default function OrderFormDialog({
  isOpen,
  onClose,
  onSubmit,
  products = [],
}: OrderFormDialogProps) {
  const [clientName, setClientName] = useState('');
  const [items, setItems] = useState<OrderFormItem[]>([
    { id: crypto.randomUUID(), product_id: '', quantity: 1 },
  ]);
  const [errors, setErrors] = useState<{ clientName?: string; items?: string[] }>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setClientName('');
      setItems([{ id: crypto.randomUUID(), product_id: '', quantity: 1 }]);
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: { clientName?: string; items?: string[] } = {};
    const itemErrors: string[] = [];

    // Validate client name
    if (!clientName.trim()) {
      newErrors.clientName = 'Le nom du client est requis';
    }

    // Validate items
    items.forEach((item, index) => {
      if (!item.product_id) {
        itemErrors[index] = 'Sélectionnez un produit';
      } else if (item.quantity < 1) {
        itemErrors[index] = 'La quantité doit être au moins 1';
      }
    });

    if (itemErrors.some((e) => e)) {
      newErrors.items = itemErrors;
    }

    // Check for duplicate products
    const productIds = items.map((i) => i.product_id).filter((id) => id);
    const uniqueProductIds = new Set(productIds);
    if (productIds.length !== uniqueProductIds.size) {
      newErrors.items = newErrors.items || [];
      items.forEach((item, index) => {
        const duplicates = items.filter(
          (i) => i.product_id === item.product_id && i.product_id !== ''
        );
        if (duplicates.length > 1 && !newErrors.items?.[index]) {
          newErrors.items![index] = 'Produit déjà ajouté';
        }
      });
    }

    setErrors(newErrors);
    return !newErrors.clientName && !newErrors.items?.some((e) => e);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const validItems = items
      .filter((item) => item.product_id && item.quantity > 0)
      .map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

    if (validItems.length === 0) {
      setErrors({ ...errors, items: ['Ajoutez au moins un produit'] });
      return;
    }

    onSubmit({
      client_name: clientName.trim(),
      items: validItems,
    });
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), product_id: '', quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
      // Clear errors for removed item
      if (errors.items) {
        const newItemErrors = [...errors.items];
        const removedIndex = items.findIndex((item) => item.id === id);
        newItemErrors.splice(removedIndex, 1);
        setErrors({ ...errors, items: newItemErrors });
      }
    }
  };

  const updateItem = (id: string, field: 'product_id' | 'quantity', value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'quantity' ? Math.max(1, Number(value)) : value }
          : item
      )
    );
    // Clear error for this item when updated
    if (errors.items) {
      const index = items.findIndex((item) => item.id === id);
      if (errors.items[index]) {
        const newItemErrors = [...errors.items];
        newItemErrors[index] = '';
        setErrors({ ...errors, items: newItemErrors });
      }
    }
  };

  const getAvailableProducts = (currentItemId: string) => {
    const selectedProductIds = items
      .filter((item) => item.id !== currentItemId && item.product_id)
      .map((item) => item.product_id);
    return products.filter((product) => !selectedProductIds.includes(product.id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90%] sm:max-w-lg h-auto max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
            </div>
            Nouvelle commande
          </DialogTitle>
          <DialogDescription className="text-sm">
            Créez une nouvelle commande en spécifiant le client et les produits
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="client_name" className="text-sm font-medium">
              Nom du client *
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  if (errors.clientName) {
                    setErrors({ ...errors, clientName: undefined });
                  }
                }}
                placeholder="Ex: Restaurant Le Gourmet"
                className={`min-h-[48px] rounded-xl pl-9 touch-manipulation ${
                  errors.clientName ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                aria-invalid={!!errors.clientName}
              />
            </div>
            {errors.clientName && (
              <p className="text-sm text-red-500">{errors.clientName}</p>
            )}
          </div>

          {/* Products Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Produits *</Label>
              <span className="text-xs text-gray-500">{items.length} produit(s)</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3 bg-gray-50 rounded-xl space-y-3 ${
                    errors.items?.[index] ? 'ring-1 ring-red-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      Produit {index + 1}
                    </span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                        aria-label={`Supprimer produit ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr,100px] gap-3">
                    {/* Product Select */}
                    <div className="space-y-1">
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateItem(item.id, 'product_id', value)}
                        >
                          <SelectTrigger className="min-h-[44px] rounded-xl pl-9 touch-manipulation">
                            <SelectValue placeholder="Sélectionner un produit" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableProducts(item.id).map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                <span className="flex items-center gap-2">
                                  {product.name}
                                  {product.code && (
                                    <span className="text-xs text-gray-400">({product.code})</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Quantity Input */}
                    <div className="space-y-1">
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          placeholder="Qté"
                          className="min-h-[44px] rounded-xl pl-9 touch-manipulation [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label={`Quantité pour produit ${index + 1}`}
                        />
                      </div>
                    </div>
                  </div>

                  {errors.items?.[index] && (
                    <p className="text-xs text-red-500">{errors.items[index]}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Add Product Button */}
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="w-full min-h-[44px] rounded-xl border-dashed border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 touch-manipulation"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un produit
            </Button>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl touch-manipulation order-2 sm:order-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white touch-manipulation order-1 sm:order-2"
            >
              Créer la commande
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
