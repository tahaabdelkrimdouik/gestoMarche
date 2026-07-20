'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, Loader2, PackagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  REORDER_UNITS,
  parseReorderQuantity,
  unitAllowsDecimals,
  type ReorderUnit,
} from '@/lib/reorder';

interface ReorderQuantityDialogProps {
  productName: string;
  open: boolean;
  initialQuantity: number;
  initialUnit: ReorderUnit;
  isAllMarkets: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quantity: number, unit: ReorderUnit) => Promise<void>;
}

export default function ReorderQuantityDialog({
  productName,
  open,
  initialQuantity,
  initialUnit,
  isAllMarkets,
  onOpenChange,
  onSave,
}: ReorderQuantityDialogProps) {
  const [quantityInput, setQuantityInput] = useState(String(initialQuantity).replace('.', ','));
  const [unit, setUnit] = useState<ReorderUnit>(initialUnit);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuantityInput(String(initialQuantity).replace('.', ','));
    setUnit(initialUnit);
    setSubmitError(null);
  }, [initialQuantity, initialUnit, open]);

  const validation = parseReorderQuantity(quantityInput, unit);
  const validationError = quantityInput.trim() ? validation.error : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const result = parseReorderQuantity(quantityInput, unit);
    if (result.value === undefined) {
      setSubmitError(result.error || 'Vérifiez la quantité.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(result.value, unit);
      onOpenChange(false);
    } catch {
      setSubmitError('Enregistrement impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden rounded-3xl border-0 p-0"
        onEscapeKeyDown={(event) => isSaving && event.preventDefault()}
        onPointerDownOutside={(event) => isSaving && event.preventDefault()}
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader className="bg-amber-50 px-5 pb-4 pt-5 text-left">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
              <PackagePlus className="h-5 w-5" />
            </div>
            <DialogTitle className="pr-8 text-xl text-gray-950">Quantité à racheter</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {productName}
              <span className="mt-1 block text-xs text-amber-800">
                {isAllMarkets ? 'La valeur sera appliquée à tous les marchés.' : 'La valeur sera appliquée à ce marché.'}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-[minmax(0,1fr),minmax(130px,0.9fr)] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reorder-quantity" className="text-sm font-semibold text-gray-800">
                  Quantité
                </Label>
                <Input
                  id="reorder-quantity"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  autoComplete="off"
                  maxLength={10}
                  value={quantityInput}
                  onChange={(event) => {
                    setQuantityInput(event.target.value);
                    setSubmitError(null);
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder={unitAllowsDecimals(unit) ? 'Ex. 1,5' : 'Ex. 6'}
                  aria-invalid={Boolean(validationError || submitError)}
                  aria-describedby="reorder-quantity-help"
                  className="h-12 rounded-xl text-lg font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-800">Unité</Label>
                <Select
                  value={unit}
                  onValueChange={(value) => {
                    setUnit(value as ReorderUnit);
                    setSubmitError(null);
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl bg-white text-sm" aria-label="Unité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-64">
                    {REORDER_UNITS.map(option => (
                      <SelectItem key={option.value} value={option.value} className="min-h-10">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p id="reorder-quantity-help" className="text-xs leading-relaxed text-gray-500">
              {unitAllowsDecimals(unit)
                ? 'Les décimales sont acceptées avec une virgule ou un point, jusqu’à 3 chiffres.'
                : 'Utilisez un nombre entier pour cette unité.'}
            </p>

            {(validationError || submitError) && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{submitError || validationError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-12 rounded-xl bg-white text-base"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={validation.value === undefined || isSaving}
              className="h-12 rounded-xl bg-amber-500 text-base font-bold text-white hover:bg-amber-600"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
