export interface ProductFields {
  name: string;
  code: string;
  category_id: string;
}

export function validateProduct(fields: ProductFields) {
  const errors: Partial<Record<keyof ProductFields, string>> = {};
  if (!fields.name.trim()) errors.name = 'Le nom du produit est obligatoire.';
  if (!fields.code.trim()) errors.code = 'Le code produit est obligatoire.';
  if (!fields.category_id.trim()) errors.category_id = 'Veuillez choisir une catégorie.';
  return errors;
}

export function productSaveError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === '23505') return 'Ce code produit est déjà utilisé. Choisissez un autre code.';
  if (code === '23503') return 'Le fournisseur ou la catégorie n’est plus disponible. Actualisez le catalogue.';
  return 'Enregistrement impossible. Vérifiez votre connexion et réessayez.';
}
