import { Mail, Phone } from 'lucide-react';
import type { Supplier } from '@/lib/types';
import { normalizeAlternativeSupplierIds } from '@/lib/suppliers';

interface AlternativeSupplierReminderProps {
  supplierIds?: string[];
  primarySupplierId: string | null;
  suppliers: Supplier[];
}

export default function AlternativeSupplierReminder({ supplierIds = [], primarySupplierId, suppliers }: AlternativeSupplierReminderProps) {
  const ids = normalizeAlternativeSupplierIds(supplierIds, primarySupplierId);
  const alternatives = suppliers.filter(supplier => ids.includes(supplier.id));
  if (!alternatives.length) return null;

  return (
    <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-600">
      <p>{alternatives.length === 1 ? 'Autre fournisseur :' : 'Autres fournisseurs :'}</p>
      {alternatives.map(supplier => (
        <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-x-3">
          <span className="min-w-0 break-words font-semibold text-gray-800">{supplier.name}</span>
          <div className="flex flex-wrap items-center gap-3">
            {supplier.phone_number && (
              <a href={`tel:${supplier.phone_number}`} aria-label={`Appeler ${supplier.name}`} className="inline-flex min-h-[44px] items-center gap-1 text-emerald-700 hover:underline">
                <Phone className="h-3.5 w-3.5" /> Appeler
              </a>
            )}
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} aria-label={`Contacter ${supplier.name} par email`} className="inline-flex min-h-[44px] items-center gap-1 text-emerald-700 hover:underline">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
          </div>
        </div>
      ))}
      <p className="text-gray-500">Vérifier la disponibilité</p>
    </div>
  );
}
