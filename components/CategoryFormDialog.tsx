import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { LoadingIndicator } from './QueryFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag } from 'lucide-react';
import type { Category } from '@/lib/types';

interface CategoryFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Category, 'id'>) => Promise<void>;
  category?: Category | null;
}

export default function CategoryFormDialog({
  isOpen,
  onClose,
  onSubmit,
  category = null,
}: CategoryFormDialogProps) {
  const saving = useAsyncAction();
  const [formData, setFormData] = useState({
    name: category?.name || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    void saving.run(() => onSubmit({ ...formData, name: formData.name.trim() }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !saving.isPending && onClose()}>
      <DialogContent showCloseButton={!saving.isPending} className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-emerald-600" />
            </div>
            {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {category ? 'Modifiez le nom de la catégorie' : 'Ajoutez une nouvelle catégorie à votre catalogue'}
          </DialogDescription>
        </DialogHeader>

        <form aria-busy={saving.isPending} onSubmit={handleSubmit} className="space-y-4 mt-4">
          <fieldset disabled={saving.isPending} className="space-y-4">
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

          </fieldset>
          {saving.error && <p role="alert" className="text-sm text-red-600">{saving.error}</p>}
          <div className="flex flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving.isPending}
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-xl touch-manipulation"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving.isPending}
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 touch-manipulation"
            >
              {saving.isPending ? <LoadingIndicator>Enregistrement…</LoadingIndicator> : category ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
