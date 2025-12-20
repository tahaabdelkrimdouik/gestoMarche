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
import { Package, Euro, TrendingUp } from 'lucide-react';

export default function ProductFormDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  product = null,
  markets = [],
  suppliers = []
}) {
  const [formData, setFormData] = useState({
    name: '',
    market_id: '',
    supplier_id: '',
    category: '',
    prix_achat: '',
    prix_vente: '',
    status: 'available',
  });

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        name: '',
        market_id: markets[0]?.id || '',
        supplier_id: '',
        category: '',
        prix_achat: '',
        prix_vente: '',
        status: 'available',
      });
    }
  }, [product, markets]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      prix_achat: formData.prix_achat ? parseFloat(formData.prix_achat) : undefined,
      prix_vente: formData.prix_vente ? parseFloat(formData.prix_vente) : undefined,
    };
    onSubmit(dataToSubmit);
  };

  const calculateMargin = () => {
    const achat = parseFloat(formData.prix_achat) || 0;
    const vente = parseFloat(formData.prix_vente) || 0;
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="market" className="text-sm">Marché *</Label>
              <Select
                value={formData.market_id}
                onValueChange={(value) => setFormData({ ...formData, market_id: value })}
              >
                <SelectTrigger className="min-h-[48px] rounded-xl touch-manipulation">
                  <SelectValue placeholder="Choisir" />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm">Catégorie</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Ex: Légumes, Épicerie..."
              className="min-h-[48px] rounded-xl touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prix_achat" className="text-sm">Prix d'achat (€)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="prix_achat"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_achat}
                  onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })}
                  placeholder="0.00"
                  className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prix_vente" className="text-sm">Prix de vente (€)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="prix_vente"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_vente}
                  onChange={(e) => setFormData({ ...formData, prix_vente: e.target.value })}
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