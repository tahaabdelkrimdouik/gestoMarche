'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { ShoppingCart, User, Plus, Trash2, Package, Search } from 'lucide-react';
import type { ProductWithMarkets, Order, OrderItemUnit } from '@/lib/types';

const UNIT_OPTIONS: { value: OrderItemUnit; label: string }[] = [
  { value: 'pièce', label: 'Pièce' },
  { value: 'bouteille', label: 'Bouteille' },
  { value: 'boîte', label: 'Boîte' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'g' },
];

interface OrderFormItem {
  id: string;
  product_id: string;
  quantityStr: string;
  unit: OrderItemUnit;
}

export interface OrderFormSubmitData {
  client_name: string;
  items: { product_id: string; quantity: number; unit: OrderItemUnit }[];
}

interface OrderFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderFormSubmitData, orderId?: string) => void;
  products: ProductWithMarkets[];
  order?: Order | null; // pour modification
}

export default function OrderFormDialog({
  isOpen,
  onClose,
  onSubmit,
  products = [],
  order = null,
}: OrderFormDialogProps) {
  const [clientName, setClientName] = useState('');
  const [items, setItems] = useState<OrderFormItem[]>([]);
  const [errors, setErrors] = useState<{ clientName?: string; items?: string[] }>({});
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [openProductDropdown, setOpenProductDropdown] = useState<string | null>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const isEditMode = !!order?.id;

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    if (openProductDropdown === null) return;
    const handlePointerDown = (e: PointerEvent) => {
      const el = productDropdownRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpenProductDropdown(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
  }, [openProductDropdown]);

  useEffect(() => {
    if (isOpen) {
      if (order?.id) {
        setClientName(order.client_name || '');
        setItems(
          order.items.length > 0
            ? order.items.map((it) => ({
                id: it.id || crypto.randomUUID(),
                product_id: it.product_id,
                quantityStr: it.quantity != null ? String(it.quantity) : '1',
                unit: (it.unit as OrderItemUnit) || 'pièce',
              }))
            : [{ id: crypto.randomUUID(), product_id: '', quantityStr: '1', unit: 'pièce' as OrderItemUnit }]
        );
      } else {
        setClientName('');
        setItems([{ id: crypto.randomUUID(), product_id: '', quantityStr: '1', unit: 'pièce' }]);
      }
      setProductSearch({});
      setOpenProductDropdown(null);
      setErrors({});
    }
  }, [isOpen, order]);

  const validateForm = (): boolean => {
    const newErrors: { clientName?: string; items?: string[] } = {};
    const itemErrors: string[] = [];

    if (!clientName.trim()) {
      newErrors.clientName = 'Le nom du client est obligatoire';
    }

    items.forEach((item, index) => {
      if (!item.product_id) {
        itemErrors[index] = 'Choisissez un produit';
      } else {
        const q = (item.quantityStr ?? '').trim();
        if (!q) {
          itemErrors[index] = 'Indiquez la quantité';
        } else {
          const num = Number(q.replace(',', '.'));
          if (Number.isNaN(num)) {
            itemErrors[index] = 'La quantité doit être un nombre (ex. 1, 1.5, 500)';
          } else if (num <= 0) {
            itemErrors[index] = 'La quantité doit être supérieure à 0';
          }
        }
      }
    });

    const productIds = items.map((i) => i.product_id).filter(Boolean);
    if (productIds.length !== new Set(productIds).size) {
      items.forEach((item, index) => {
        const duplicates = items.filter((i) => i.product_id === item.product_id && i.product_id !== '');
        if (duplicates.length > 1) itemErrors[index] = 'Produit déjà ajouté';
      });
    }

    newErrors.items = itemErrors;
    setErrors(newErrors);
    return !newErrors.clientName && !itemErrors.some(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const validItems: { product_id: string; quantity: number; unit: OrderItemUnit }[] = [];
    for (const item of items) {
      if (!item.product_id) continue;
      const q = (item.quantityStr ?? '').trim();
      const num = Number(q.replace(',', '.'));
      if (Number.isNaN(num) || num <= 0) continue;
      validItems.push({ product_id: item.product_id, quantity: num, unit: item.unit });
    }

    if (validItems.length === 0) {
      setErrors((e) => ({ ...e, items: ['Ajoutez au moins un produit'] }));
      return;
    }

    onSubmit(
      { client_name: clientName.trim(), items: validItems },
      isEditMode ? order!.id : undefined
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        product_id: '', 
        quantity: 1, 
        quantityStr: '1', // Add this line
        unit: 'pièce' 
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setProductSearch((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateItem = (
    id: string,
    field: 'product_id' | 'quantityStr' | 'unit',
    value: string | OrderItemUnit
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'quantityStr') return { ...item, quantityStr: value as string };
        if (field === 'unit') return { ...item, unit: value as OrderItemUnit };
        return { ...item, product_id: value as string };
      })
    );
    if (field === 'product_id') setOpenProductDropdown(null);
  };

  const getAvailableProducts = (currentItemId: string) => {
    const selected = items.filter((i) => i.id !== currentItemId && i.product_id).map((i) => i.product_id);
    return products.filter((p) => !selected.includes(p.id));
  };

  const getFilteredProducts = (itemId: string) => {
    const list = getAvailableProducts(itemId);
    const q = (productSearch[itemId] || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95%] sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-4 sm:p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
            </div>
            {isEditMode ? 'Modifier la commande' : 'Nouvelle commande'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEditMode
              ? 'Modifiez le client et les produits de la commande'
              : 'Indiquez le client et les produits à commander'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="client_name" className="text-xs font-medium">
              Nom du client *
            </Label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setErrors((e) => ({ ...e, clientName: undefined }));
                }}
                placeholder="Ex : Restaurant Le Gourmet"
                className={`min-h-[40px] text-sm rounded-lg pl-8 ${
                  errors.clientName ? 'border-red-500' : ''
                }`}
              />
            </div>
            {errors.clientName && (
              <p className="text-xs text-red-500">{errors.clientName}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Produits *</Label>
              <span className="text-xs text-gray-500">{items.length} ligne(s)</span>
            </div>

            <div className="space-y-2 max-h-[min(280px,50vh)] overflow-y-auto pr-0.5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-2.5 bg-gray-50 rounded-lg space-y-2 ${
                    errors.items?.[index] ? 'ring-1 ring-red-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-gray-500">Ligne {index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Produit avec recherche */}
                  <div className="relative" ref={openProductDropdown === item.id ? productDropdownRef : null}>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          value={
                            openProductDropdown === item.id
                              ? (productSearch[item.id] ?? '')
                              : item.product_id
                                ? products.find((p) => p.id === item.product_id)?.name || ''
                                : productSearch[item.id] ?? ''
                          }
                          onChange={(e) => {
                            setProductSearch((prev) => ({ ...prev, [item.id]: e.target.value }));
                            setOpenProductDropdown(item.id);
                            if (!e.target.value) updateItem(item.id, 'product_id', '');
                          }}
                          onFocus={() => setOpenProductDropdown(item.id)}
                          placeholder="Rechercher un produit..."
                          className="w-full min-h-[36px] text-sm rounded-lg pl-8 pr-2 border border-input bg-background"
                          autoComplete="off"
                        />
                        {openProductDropdown === item.id && (
                          <div
                            className="absolute top-full left-0 right-0 mt-0.5 bg-white border rounded-lg shadow-lg z-[100] max-h-40 overflow-y-auto"
                            onPointerDown={(e) => e.preventDefault()}
                          >
                            {getFilteredProducts(item.id).length === 0 ? (
                              <div className="px-3 py-2 text-xs text-gray-500">
                                Aucun produit trouvé
                              </div>
                            ) : (
                              getFilteredProducts(item.id).map((product) => (
                                <div
                                  key={product.id}
                                  role="button"
                                  tabIndex={0}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    updateItem(item.id, 'product_id', product.id);
                                    setProductSearch((prev) => ({ ...prev, [item.id]: '' }));
                                    setOpenProductDropdown(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      updateItem(item.id, 'product_id', product.id);
                                      setProductSearch((prev) => ({ ...prev, [item.id]: '' }));
                                      setOpenProductDropdown(null);
                                    }
                                  }}
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 active:bg-emerald-100 flex items-center gap-2 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {product.name}
                                    {product.code && (
                                      <span className="text-xs text-gray-400"> ({product.code})</span>
                                    )}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr,auto] gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-gray-500">Quantité</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.quantityStr ?? ''}
                        onChange={(e) =>
                          updateItem(item.id, 'quantityStr', e.target.value)
                        }
                        placeholder={item.unit === 'g' ? 'ex. 500' : item.unit === 'kg' ? 'ex. 1,5' : '1'}
                        className="min-h-[36px] text-sm rounded-lg"
                      />
                      {(item.quantityStr ?? '').trim() && Number.isNaN(Number((item.quantityStr ?? '').replace(',', '.'))) && (
                        <p className="text-xs text-amber-600">
                          Entrez un nombre (ex. 1, 1,5 ou 500)
                        </p>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-xs text-gray-500">Unité</Label>
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(item.id, 'unit', e.target.value as OrderItemUnit)
                        }
                        className="min-h-[36px] text-sm rounded-lg border border-input bg-background px-3 w-full min-w-[90px]"
                      >
                        {UNIT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {errors.items?.[index] && (
                    <p className="text-xs text-red-500">{errors.items[index]}</p>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="w-full min-h-[36px] rounded-lg border-dashed border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Ajouter un produit
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 min-h-[40px] rounded-xl text-sm"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              {isEditMode ? 'Enregistrer' : 'Créer la commande'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
