import React, { useRef, useState } from 'react';
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
import { Package, Hash, LoaderCircle } from 'lucide-react';
import type { ProductWithMarkets, ProductDetailsInput, Supplier, Category } from '@/lib/types';
import { validateProduct, productSaveError } from '@/lib/productValidation';
import { normalizeAlternativeSupplierIds } from '@/lib/suppliers';

interface ProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductDetailsInput) => Promise<void>;
  product?: ProductWithMarkets | null;
  suppliers: Supplier[];
  categories: Category[];
}

export default function ProductFormDialog({
  isOpen,
  onClose,
  onSubmit,
  product = null,
  suppliers = [],
  categories = []
}: ProductFormDialogProps) {
  // The catalogue mounts a fresh form for each edit. Background refetches must
  // not reset a user's unsaved selections or write stale stock data back.
  const [formData, setFormData] = useState(() => ({
    name: product?.name || '',
    code: product?.code || '',
    supplier_id: product?.supplier_id || '',
    alternative_supplier_ids: normalizeAlternativeSupplierIds(product?.alternative_supplier_ids || [], product?.supplier_id || null),
    category_id: product?.category_id || '',
  }));
  const submissionLock = useRef(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateProduct>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLock.current) return;
    const validation = validateProduct(formData);
    setErrors(validation);
    const firstInvalid = Object.keys(validation)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid === 'category_id' ? 'category' : firstInvalid)?.focus();
      return;
    }
    submissionLock.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim(),
        supplier_id: formData.supplier_id || null,
        alternative_supplier_ids: normalizeAlternativeSupplierIds(formData.alternative_supplier_ids, formData.supplier_id),
      });
    } catch (error) {
      setSaveError(productSaveError(error));
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={() => !isSaving && onClose()}>
      <DialogContent showCloseButton={!isSaving} className="flex h-[calc(var(--vvh,100dvh)-1rem)] max-h-[calc(var(--vvh,100dvh)-1rem)] max-w-[calc(100%-1.25rem)] overflow-hidden rounded-3xl p-4 sm:h-auto sm:max-h-[min(90vh,calc(var(--vvh,90vh)-2rem))] sm:max-w-lg sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {product ? 'Modifiez les informations du produit' : 'Ajoutez un nouveau produit à votre catalogue'}
          </DialogDescription>
        </DialogHeader>

        <form noValidate aria-busy={isSaving} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <fieldset disabled={isSaving} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2 sm:space-y-4">
          <p className="text-xs text-gray-500">Les champs marqués d’un * sont obligatoires.</p>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Nom du produit *</Label>
            <Input
              id="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors(previous => ({ ...previous, name: undefined })); }}
              placeholder="Ex: Tomates fraîches"
              required
              className={`min-h-[48px] rounded-xl touch-manipulation ${errors.name ? "border-red-500 focus-visible:ring-red-200" : ""}`}
            />
          </div>

            {errors.name && <p id="name-error" role="alert" className="text-sm text-red-600">{errors.name}</p>}
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm">Code produit *</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="code"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "code-error" : undefined}
                value={formData.code}
                onChange={(e) => { setFormData({ ...formData, code: e.target.value }); setErrors(previous => ({ ...previous, code: undefined })); }}
                placeholder="Ex: TOM001"
                required
                className={`min-h-[48px] rounded-xl pl-9 touch-manipulation ${errors.code ? "border-red-500 focus-visible:ring-red-200" : ""}`}
              />
            </div>
          </div>

            {errors.code && <p id="code-error" role="alert" className="text-sm text-red-600">{errors.code}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-sm">Fournisseur habituel</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({
                  ...formData,
                  supplier_id: value === 'none' ? '' : value,
                  alternative_supplier_ids: normalizeAlternativeSupplierIds(formData.alternative_supplier_ids, value),
                })}
              >
                <SelectTrigger id="supplier" className="min-h-[48px] w-full rounded-xl touch-manipulation">
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="none">Aucun fournisseur habituel</SelectItem>
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
                onValueChange={(value) => { setFormData({ ...formData, category_id: value }); setErrors(previous => ({ ...previous, category_id: undefined })); }}
                required
              >
                <SelectTrigger id="category" aria-invalid={Boolean(errors.category_id)} aria-describedby={errors.category_id ? "category-error" : undefined} className={`min-h-[48px] w-full rounded-xl touch-manipulation ${errors.category_id ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {errors.category_id && <p id="category-error" role="alert" className="text-sm text-red-600">{errors.category_id}</p>}
          <fieldset className="space-y-2" disabled={isSaving}>
            <legend className="text-sm font-medium">Autres fournisseurs <span className="font-normal text-gray-500">(facultatif)</span></legend>
            <p className="text-xs text-gray-500">À contacter si le fournisseur habituel ne peut pas vous approvisionner.</p>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 p-1">
              {suppliers.filter(supplier => supplier.id !== formData.supplier_id).map(supplier => (
                <label key={supplier.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-emerald-600"
                    checked={formData.alternative_supplier_ids.includes(supplier.id)}
                    onChange={event => setFormData(previous => ({
                      ...previous,
                      alternative_supplier_ids: event.target.checked
                        ? normalizeAlternativeSupplierIds([...previous.alternative_supplier_ids, supplier.id], previous.supplier_id)
                        : previous.alternative_supplier_ids.filter(id => id !== supplier.id),
                    }))}
                  />
                  <span className="break-words">{supplier.name}</span>
                </label>
              ))}
              {suppliers.every(supplier => supplier.id === formData.supplier_id) && (
                <p className="p-3 text-sm text-gray-500">Aucun autre fournisseur enregistré.</p>
              )}
            </div>
          </fieldset>

          </fieldset>

          {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          <div className="flex shrink-0 flex-row gap-3 border-t border-gray-100 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 min-h-[48px] rounded-xl touch-manipulation"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 touch-manipulation"
            >
              {isSaving && <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
              {isSaving ? 'Enregistrement…' : product ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
