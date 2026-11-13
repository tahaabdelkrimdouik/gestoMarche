'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { REORDER_UNITS, parseReorderQuantity, type ReorderUnit } from '@/lib/reorder';

interface ReorderQuantityFieldsProps {
  productId: string;
  initialQuantity: number;
  initialUnit: ReorderUnit;
  isAllMarkets: boolean;
  onSave: (quantity: number, unit: ReorderUnit) => Promise<void>;
}

export default function ReorderQuantityFields({ productId, initialQuantity, initialUnit, isAllMarkets, onSave }: ReorderQuantityFieldsProps) {
  const [quantity, setQuantity] = useState(String(initialQuantity).replace('.', ','));
  const [unit, setUnit] = useState(initialUnit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = parseReorderQuantity(quantity, unit);
  const isDirty = validation.value !== initialQuantity || unit !== initialUnit;
  const id = `reorder-${productId}`;

  return (
    <form
      className="space-y-2 border-t border-gray-100 pt-3"
      onSubmit={async event => {
        event.preventDefault();
        if (isSaving || !isDirty) return;
        if (validation.value === undefined) {
          setError(validation.error || 'Vérifiez la quantité.');
          return;
        }
        setIsSaving(true);
        setError(null);
        try {
          await onSave(validation.value, unit);
        } catch {
          setError('Enregistrement impossible. Réessayez.');
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-quantity`} className="text-xs font-medium text-gray-600">Quantité à racheter</label>
          <Input
            id={`${id}-quantity`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={10}
            value={quantity}
            disabled={isSaving}
            onChange={event => { setQuantity(event.target.value); setError(null); }}
            aria-invalid={Boolean(error || (isDirty && validation.error))}
            aria-describedby={error || (isDirty && validation.error) ? `${id}-error` : undefined}
            className="min-h-[44px] rounded-xl text-base"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-unit`} className="text-xs font-medium text-gray-600">Unité</label>
          <select
            id={`${id}-unit`}
            value={unit}
            disabled={isSaving}
            onChange={event => { setUnit(event.target.value as ReorderUnit); setError(null); }}
            className="min-h-[44px] w-full rounded-xl border border-input bg-white px-2 text-base"
          >
            {REORDER_UNITS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      {isDirty && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{isAllMarkets ? 'Pour tous les marchés' : 'Pour ce marché'}</span>
          <Button type="submit" size="sm" disabled={isSaving || validation.value === undefined} className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}
      {(error || (isDirty && validation.error)) && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600">{error || validation.error}</p>
      )}
    </form>
  );
}
