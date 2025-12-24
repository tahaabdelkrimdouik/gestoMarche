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
import { Package, Euro, TrendingUp, Hash } from 'lucide-react';
import type { ProductWithMarkets, Market, Supplier, Category } from '@/lib/types';

interface ProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  product?: ProductWithMarkets | null;
  markets: Market[];
  suppliers: Supplier[];
  categories: Category[];
}

export default function ProductFormDialog({
  isOpen,
  onClose,
  onSubmit,
  product = null,
  markets = [],
  suppliers = [],
  categories = []
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    supplier_id: '',
    category_id: '',
    market_id: '',
    purchase_price: '',
    sale_price: '',
    status: 'available',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        code: product.code || '',
        supplier_id: product.supplier_id || '',
        category_id: product.category_id || '',
        market_id: product.product_markets?.[0]?.market_id || '',
        purchase_price: product.purchase_price?.toString() || '',
        sale_price: product.sale_price?.toString() || '',
        status: product.status,
      });
    } else {
      setFormData({
        name: '',
        code: '',
        supplier_id: '',
        category_id: '',
        market_id: '',
        purchase_price: '',
        sale_price: '',
        status: 'available',
      });
    }
  }, [product, markets, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const calculateMargin = () => {
    const achat = parseFloat(formData.purchase_price) || 0;
    const vente = parseFloat(formData.sale_price) || 0;
    if (achat === 0 || vente === 0) return null;
    const margin = ((vente - achat) / vente) * 100;
    return margin.toFixed(1);
  };

  const margin = calculateMargin();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {product ? 'Modifiez les informations du produit' : 'Ajoutez un nouveau produit à votre catalogue'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Nom du produit *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Tomates fraîches"
              required
              className="min-h-[48px] rounded-xl touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm">Code produit</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: TOM001"
                className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-sm">Fournisseur</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger className="min-h-[48px] rounded-xl touch-manipulation">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm">Catégorie *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                required
              >
                <SelectTrigger className="min-h-[48px] rounded-xl touch-manipulation">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="market" className="text-sm">Marché *</Label>
            <Select
              value={formData.market_id}
              onValueChange={(value) => setFormData({ ...formData, market_id: value })}
              required
            >
              <SelectTrigger className="min-h-[48px] rounded-xl touch-manipulation">
                <SelectValue placeholder="Choisir un marché" />
              </SelectTrigger>
              <SelectContent>
                {markets.map((market) => (
                  <SelectItem key={market.id} value={market.id}>
                    {market.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="purchase_price" className="text-sm">Prix d'achat (€)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  placeholder="0.00"
                  className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_price" className="text-sm">Prix de vente (€)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  placeholder="0.00"
                  className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
                />
              </div>
            </div>
          </div>

          {margin !== null && (
            <div className={`flex items-center gap-2 p-3 rounded-xl ${
              parseFloat(margin) > 30 ? 'bg-green-50' : 
              parseFloat(margin) > 15 ? 'bg-yellow-50' : 'bg-red-50'
            }`}>
              <TrendingUp className={`w-4 h-4 ${
                parseFloat(margin) > 30 ? 'text-green-600' : 
                parseFloat(margin) > 15 ? 'text-yellow-600' : 'text-red-600'
              }`} />
              <span className={`text-sm font-semibold ${
                parseFloat(margin) > 30 ? 'text-green-700' : 
                parseFloat(margin) > 15 ? 'text-yellow-700' : 'text-red-700'
              }`}>
                Marge : {margin}%
              </span>
            </div>
          )}

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
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 touch-manipulation order-1 sm:order-2"
            >
              {product ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}