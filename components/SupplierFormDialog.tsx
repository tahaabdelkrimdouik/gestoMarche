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
import { Truck, Phone, Mail } from 'lucide-react';
import type { Supplier } from '@/lib/types';

interface SupplierFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Supplier, 'id'>) => Promise<void>;
  supplier?: Supplier | null;
}

export default function SupplierFormDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  supplier = null
}: SupplierFormDialogProps) {
  const saving = useAsyncAction();
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    phone_number: supplier?.phone_number || '',
    email: supplier?.email || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    void saving.run(() => onSubmit({ ...formData, name: formData.name.trim() }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !saving.isPending && onClose()}>
      <DialogContent showCloseButton={!saving.isPending} className="max-w-[calc(100%-1.25rem)] overflow-y-auto rounded-3xl sm:max-w-lg">
      <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-violet-600" />
            </div>
            {supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {supplier ? 'Modifiez les informations du fournisseur' : 'Ajoutez un nouveau fournisseur'}
          </DialogDescription>
        </DialogHeader>

        <form aria-busy={saving.isPending} onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-4">
          <fieldset disabled={saving.isPending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Nom du fournisseur *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Distribution Martin"
              required
              className="min-h-[48px] rounded-xl touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm">Téléphone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="text"
                inputMode="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
                pattern="[\+]?[\d\s\-\(\)]*"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="fournisseur@example.com"
                className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
              />
            </div>
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
              className="flex-1 min-h-[48px] rounded-xl bg-violet-600 hover:bg-violet-700 touch-manipulation"
            >
              {saving.isPending ? <LoadingIndicator>Enregistrement…</LoadingIndicator> : supplier ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}