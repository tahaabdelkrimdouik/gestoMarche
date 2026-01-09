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
import type { ProductWithMarkets, Market, Supplier, Category, StockStatus } from '@/lib/types';

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
    markets: [] as Array<{ market_id: string; status: StockStatus }>, // Market with status per market
    purchase_price: '',
    sale_price: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        code: product.code || '',
        supplier_id: product.supplier_id || '',
        category_id: product.category_id || '',
        markets: product.product_markets?.map(pm => ({
          market_id: pm.market_id,
          status: pm.status || 'available'
        })) || [],
        purchase_price: product.purchase_price?.toString() || '',
        sale_price: product.sale_price?.toString() || '',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        supplier_id: '',
        category_id: '',
        markets: [],
        purchase_price: '',
        sale_price: '',
      });
    }
  }, [product, markets, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate that at least one market is selected
    if (formData.markets.length === 0) {
      alert('Veuillez sélectionner au moins un marché');
      return;
    }
    const dataToSubmit = {
      ...formData,
      market_ids: formData.markets, // Send markets with status
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const handleMarketToggle = (marketId: string) => {
    setFormData(prev => {
      const isSelected = prev.markets.some(m => m.market_id === marketId);
      if (isSelected) {
        // Remove market
        return {
          ...prev,
          markets: prev.markets.filter(m => m.market_id !== marketId)
        };
      } else {
        // Add market with default status 'available'
        return {
          ...prev,
          markets: [...prev.markets, { market_id: marketId, status: 'available' }]
        };
      }
    });
  };

  const handleMarketStatusChange = (marketId: string, status: StockStatus) => {
    setFormData(prev => ({
      ...prev,
      markets: prev.markets.map(m =>
        m.market_id === marketId ? { ...m, status } : m
      )
    }));
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
      <DialogContent className="max-w-[80%] h-[100dvh] max-h-[90vh] overflow-y-auto rounded-3xl">
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
            <Label className="text-sm">Marchés *</Label>
            <div className="border rounded-xl p-3 min-h-[48px] max-h-[300px] overflow-y-auto bg-white">
              {markets.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun marché disponible</p>
              ) : (
                <div className="space-y-3">
                  {markets.map((market) => {
                    const isSelected = formData.markets.some(m => m.market_id === market.id);
                    const marketData = formData.markets.find(m => m.market_id === market.id);
                    
                    return (
                      <div
                        key={market.id}
                        className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50'}`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleMarketToggle(market.id)}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-gray-700 flex-1">{market.name}</span>
                        </label>
                        {isSelected && (
                          <div className="mt-2 ml-6">
                            <Label className="text-xs text-gray-600 mb-1 block">Statut pour ce marché:</Label>
                            <Select
                              value={marketData?.status || 'available'}
                              onValueChange={(value) => handleMarketStatusChange(market.id, value as StockStatus)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="available">Disponible</SelectItem>
                                <SelectItem value="low">À racheter</SelectItem>
                                <SelectItem value="out">Épuisé</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {formData.markets.length > 0 && (
              <p className="text-xs text-gray-500">
                {formData.markets.length} marché{formData.markets.length > 1 ? 'x' : ''} sélectionné{formData.markets.length > 1 ? 's' : ''}
              </p>
            )}
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