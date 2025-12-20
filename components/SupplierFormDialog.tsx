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
import { Truck, Phone, Mail } from 'lucide-react';
import { Supplier } from '@/lib/types';
interface SupplierFormDialogProps {
  isOpen: boolean;                    // L'ID du filtre actif (ex: 'all')
  onClose:() => void;   // Une fonction qui change le filtre
  onSubmit:() => void;   // Une fonction qui change le filtre
  supplier:Supplier | null;   // Une fonction qui change le filtre
}
export default function SupplierFormDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  supplier = null
}:SupplierFormDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone_number: ''
  });

  useEffect(() => {
    // Avoid calling setState synchronously in the effect body (can trigger cascading renders).
    // Schedule the update in a microtask so React won't warn about synchronous setState here.
    if (supplier) {
      Promise.resolve().then(() => {
        setFormData({
          name: supplier.name ?? '',
          phone_number: (supplier as any).phone_number ?? ''
        });
      });
    } else {
      Promise.resolve().then(() => {
        setFormData({
          name: '',
          phone_number: ''
        });
      });
    }
  }, [supplier]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-violet-600" />
            </div>
            {supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {supplier ? 'Modifiez les informations du fournisseur' : 'Ajoutez un nouveau fournisseur'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-4">
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
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
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
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@fournisseur.fr"
                className="min-h-[48px] rounded-xl pl-9 touch-manipulation"
              />
            </div>
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
              className="flex-1 min-h-[48px] rounded-xl bg-violet-600 hover:bg-violet-700 touch-manipulation order-1 sm:order-2"
            >
              {supplier ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}