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
import { Tag } from 'lucide-react';
import type { Category } from '@/lib/types';

interface CategoryFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  category?: Category | null;
}

export default function CategoryFormDialog({
  isOpen,
  onClose,
  onSubmit,
  category = null,
}: CategoryFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
      });
    } else {
      setFormData({
        name: '',
      });
    }
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-600" />
            </div>
            {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {category ? 'Modifiez le nom de la catégorie' : 'Ajoutez une nouvelle catégorie à votre catalogue'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Nom de la catégorie *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Légumes, Fruits, Produits laitiers..."
              required
              className="min-h-[48px] rounded-xl touch-manipulation"
            />
          </div>

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
              {category ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
