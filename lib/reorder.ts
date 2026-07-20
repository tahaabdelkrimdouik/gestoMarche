import type { ProductMarket } from '@/lib/types';

export const REORDER_UNITS = [
  { value: 'piece', label: 'Pièce', pluralLabel: 'pièces', allowsDecimals: false },
  { value: 'kg', label: 'Kilogramme (kg)', pluralLabel: 'kg', allowsDecimals: true },
  { value: 'g', label: 'Gramme (g)', pluralLabel: 'g', allowsDecimals: true },
  { value: 'litre', label: 'Litre (L)', pluralLabel: 'L', allowsDecimals: true },
  { value: 'ml', label: 'Millilitre (ml)', pluralLabel: 'ml', allowsDecimals: true },
  { value: 'bocal', label: 'Bocal', pluralLabel: 'bocaux', allowsDecimals: false },
  { value: 'bouteille', label: 'Bouteille', pluralLabel: 'bouteilles', allowsDecimals: false },
  { value: 'boite', label: 'Boîte', pluralLabel: 'boîtes', allowsDecimals: false },
  { value: 'carton', label: 'Carton', pluralLabel: 'cartons', allowsDecimals: false },
  { value: 'paquet', label: 'Paquet', pluralLabel: 'paquets', allowsDecimals: false },
] as const;

export type ReorderUnit = (typeof REORDER_UNITS)[number]['value'];

export const DEFAULT_REORDER_UNIT: ReorderUnit = 'piece';
export const MAX_REORDER_QUANTITY = 99999.999;

export function isReorderUnit(value: string | null | undefined): value is ReorderUnit {
  return REORDER_UNITS.some(unit => unit.value === value);
}

export function unitAllowsDecimals(unit: ReorderUnit): boolean {
  return REORDER_UNITS.find(option => option.value === unit)?.allowsDecimals ?? false;
}

export function parseReorderQuantity(
  rawValue: string,
  unit: ReorderUnit,
): { value?: number; error?: string } {
  const trimmed = rawValue.trim();
  if (!trimmed) return { error: 'Indiquez la quantité.' };

  const decimalMatch = trimmed.match(/^\d+(?:[.,](\d+))?$/);
  if (!decimalMatch) return { error: 'Entrez un nombre valide, par exemple 2 ou 1,5.' };

  const decimals = decimalMatch[1]?.length || 0;
  if (!unitAllowsDecimals(unit) && decimals > 0) {
    return { error: 'Cette unité nécessite un nombre entier.' };
  }
  if (decimals > 3) return { error: 'Utilisez au maximum 3 chiffres après la virgule.' };

  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return { error: 'La quantité doit être supérieure à 0.' };
  if (value > MAX_REORDER_QUANTITY) return { error: 'La quantité est trop élevée.' };

  return { value };
}

export function formatReorderQuantity(quantity: number, unit: ReorderUnit): string {
  const option = REORDER_UNITS.find(item => item.value === unit);
  const formattedQuantity = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(quantity);

  if (!option) return formattedQuantity;
  const alwaysAbbreviatedUnits: ReorderUnit[] = ['kg', 'g', 'litre', 'ml'];
  const label = alwaysAbbreviatedUnits.includes(unit)
    ? option.pluralLabel
    : quantity === 1
      ? option.label.toLowerCase()
      : option.pluralLabel;
  return `${formattedQuantity} ${label}`;
}

export function getReorderDetails(productMarkets: ProductMarket[]): {
  quantity: number;
  unit: ReorderUnit;
} {
  const relation = productMarkets.find(item => item.status === 'low') || productMarkets[0];
  return {
    quantity: Number(relation?.reorder_quantity) || 1,
    unit: isReorderUnit(relation?.reorder_unit) ? relation.reorder_unit : DEFAULT_REORDER_UNIT,
  };
}
