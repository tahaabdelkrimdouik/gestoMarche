export function normalizeAlternativeSupplierIds(ids: string[], primarySupplierId: string | null): string[] {
  return [...new Set(ids)].filter(id => id && id !== primarySupplierId);
}
