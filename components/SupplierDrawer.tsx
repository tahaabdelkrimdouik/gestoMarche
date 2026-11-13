import { useState, useMemo, useRef } from 'react';
import { X, Check, CheckCheck, Phone, Mail, FileText, PhoneCall, Square, Search, Pencil, Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { generatePurchaseOrderPDF, sharePDF } from '@/components/PdfGenerator';
import { notify } from '@/lib/utils/notify';
import { ProductWithMarkets, Supplier } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { formatReorderQuantity, getReorderDetails } from '@/lib/reorder';
import { matchesProductSearch } from '@/lib/search';
import { needsReplenishment, replenishmentStatus } from '@/lib/suppliers';
import AlternativeSupplierReminder from '@/components/AlternativeSupplierReminder';

interface SupplierDrawerProps {
    supplier: Supplier;
    suppliers?: Supplier[];
    products: ProductWithMarkets[];
    onClose: () => void;
    isOpen: boolean;
}

interface SupplierDrawerPropsWithEdit extends SupplierDrawerProps {
  onEditSupplier?: () => void;
}

export default function SupplierDrawer({ isOpen, supplier, suppliers = [], products, onClose, onEditSupplier }: SupplierDrawerPropsWithEdit) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const updatingIdsRef = useRef(new Set<string>());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const formatProductReorder = (product: ProductWithMarkets) => {
    const details = getReorderDetails(product.product_markets || []);
    return formatReorderQuantity(details.quantity, details.unit);
  };

  // One list drives alerts and purchase actions for low and depleted stock.
  const criticalProducts = useMemo(() => products.filter(needsReplenishment), [products]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return criticalProducts;
    return criticalProducts.filter((p) => matchesProductSearch(searchQuery, p.name, p.code));
  }, [criticalProducts, searchQuery]);

  // Only this explicit action marks stock as available. Contact links do not.
  const markAsPurchasedMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = products.find(product => product.id === productId);
      if (!product || !product.product_markets.length) throw new Error('Produit introuvable.');
      const marketIds = product.product_markets.map(market => market.market_id);
      const { data, error } = await supabase
        .from('product_markets')
        .update({ status: 'available' })
        .eq('product_id', productId)
        .in('market_id', marketIds)
        .select('market_id');
      if (error) throw error;
      if (!data || data.length !== marketIds.length) throw new Error('Mise à jour du stock incomplète.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      notify.success('Produit marqué comme disponible');
    },
    onError: (error) => {
      console.error('Error marking product as available:', error);
      notify.error('Erreur lors de la mise à jour');
    },
  });

  const handleMarkAsAvailable = async (productId: string) => {
    if (updatingIdsRef.current.has(productId)) return;
    updatingIdsRef.current.add(productId);
    setUpdatingIds(new Set(updatingIdsRef.current));
    try {
      await markAsPurchasedMutation.mutateAsync(productId);
    } catch {
      // The mutation reports a friendly error; failed items remain available to retry.
    } finally {
      updatingIdsRef.current.delete(productId);
      setUpdatingIds(new Set(updatingIdsRef.current));
    }
  };

  const handleMarkAllAsAvailable = () => {
    if (updatingIdsRef.current.size) return;
    void Promise.all(filteredProducts.map(product => handleMarkAsAvailable(product.id)));
  };

  const handleShareEmail = () => {
    const productList = filteredProducts.map(p => {
      return `• ${p.name}${p.code ? ` (${p.code})` : ''} — Quantité : ${formatProductReorder(p)}`;
    }).join('\n');

    const subject = encodeURIComponent(`Liste de réapprovisionnement - ${supplier?.name}`);
    const body = encodeURIComponent(
      `Bonjour,\n\n` +
      `Voici la liste des produits à commander :\n\n` +
      `${productList || 'Aucun produit'}\n\n` +
      `Cordialement`
    );

    const email = supplier?.email || '';
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      // Generate the PDF
      const pdfData = await generatePurchaseOrderPDF(supplier, filteredProducts);

      // Download immediately
      const success = await sharePDF(pdfData);

      if (success) {
        notify.success('Bon de commande téléchargé avec succès');
      } else {
        notify.error('Erreur lors du téléchargement du PDF');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la génération du PDF:', error);
      notify.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Keep the mobile keyboard closed until the user chooses to search.
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
        className="top-auto bottom-0 left-0 flex max-h-[calc(var(--vvh,100dvh)-0.5rem)] max-w-none translate-x-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-0 bg-white p-0 shadow-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(42rem,calc(var(--vvh,100dvh)-2rem))] sm:max-w-xl sm:-translate-x-1/2 sm:rounded-2xl"
      >
        <div aria-hidden="true" className="flex shrink-0 justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-8 rounded-full bg-gray-200" />
        </div>

        <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
          <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-base font-semibold text-violet-700">
            {supplier?.name?.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="break-words text-base leading-6 font-semibold text-gray-900">
              {supplier?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Consultez les produits à commander, marquez-les comme disponibles ou générez un bon de commande.
            </DialogDescription>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              {supplier?.phone_number && (
                <a href={`tel:${supplier.phone_number}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-violet-500">
                  <Phone aria-hidden="true" className="size-3 shrink-0" />
                  <span className="break-all">{supplier.phone_number}</span>
                </a>
              )}
              {supplier?.email && (
                <a href={`mailto:${supplier.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
                  <Mail aria-hidden="true" className="size-3 shrink-0" />
                  <span className="break-all">{supplier.email}</span>
                </a>
              )}
            </div>
          </div>
          <div className="-my-1 -mr-1 flex shrink-0 items-center">
            {onEditSupplier && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEditSupplier}
                aria-label="Modifier le fournisseur"
                title="Modifier le fournisseur"
                className="size-11 rounded-xl text-gray-500 hover:bg-violet-50 hover:text-violet-700"
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
            )}
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fermer le fournisseur"
              title="Fermer"
              className="size-11 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </header>

        <section aria-labelledby="supplier-products-heading" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 px-4 pt-4 pb-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <h3 id="supplier-products-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                Produits à commander
                <span aria-live="polite" className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                  {searchQuery ? `${filteredProducts.length} / ${criticalProducts.length}` : criticalProducts.length}
                </span>
              </h3>
              {filteredProducts.length > 0 && (
                <Button
                  variant="ghost"
                  disabled={updatingIds.size > 0}
                  onClick={handleMarkAllAsAvailable}
                  aria-label="Tout marquer comme disponible"
                  title="Tout marquer comme disponible"
                  className="-mr-2 h-11 gap-1.5 rounded-lg px-2 text-xs text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                >
                  <CheckCheck aria-hidden="true" className="size-3.5" />
                  {updatingIds.size > 0 ? 'Mise à jour…' : 'Tout disponible'}
                </Button>
              )}
            </div>

            {criticalProducts.length > 3 && (
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  aria-label="Rechercher un produit à commander"
                  placeholder="Nom ou référence du produit…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/70 pr-3 pl-9 text-base text-gray-900 placeholder:text-sm placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 focus:outline-none sm:text-sm"
                />
              </div>
            )}
          </div>

          <div className="custom-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
            {filteredProducts.length === 0 ? (
              <div role="status" className="flex flex-col items-center px-4 py-10 text-center">
                <div className={`mb-3 flex size-11 items-center justify-center rounded-full ${criticalProducts.length ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  {criticalProducts.length ? <Search aria-hidden="true" className="size-5" /> : <PackageCheck aria-hidden="true" className="size-5" />}
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {criticalProducts.length ? 'Aucun produit trouvé' : 'Tous les produits sont en stock'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {criticalProducts.length ? 'Essayez un autre nom ou une autre référence.' : 'Aucun produit à commander pour ce fournisseur.'}
                </p>
                {criticalProducts.length > 0 && (
                  <Button variant="ghost" onClick={() => setSearchQuery('')} className="mt-2 h-11 text-violet-700">
                    Effacer la recherche
                  </Button>
                )}
              </div>
            ) : (
              <ul aria-label="Produits à racheter" className="space-y-1.5">
                {filteredProducts.map((product) => {
                  const isUpdating = updatingIds.has(product.id);
                  const status = replenishmentStatus(product);

                  return (
                    <li key={product.id} className="rounded-xl border border-gray-100 bg-gray-50/60 transition-colors hover:border-gray-200 hover:bg-gray-50">
                      <div className="flex items-center gap-1 py-2 pr-3 pl-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkAsAvailable(product.id)}
                          disabled={isUpdating}
                          aria-label={`Marquer ${product.name} comme disponible`}
                          title="Marquer comme disponible"
                          className="group size-11 shrink-0 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          {isUpdating ? (
                            <Loader2 aria-hidden="true" className="size-5 motion-safe:animate-spin text-violet-600" />
                          ) : (
                            <>
                              <Square aria-hidden="true" className="size-5 group-hover:hidden" />
                              <Check aria-hidden="true" className="hidden size-5 group-hover:block" />
                            </>
                          )}
                        </Button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm leading-5 font-medium break-words text-gray-900">{product.name}</p>
                              {product.code && <p className="mt-0.5 font-mono text-xs leading-4 break-all text-gray-500">{product.code}</p>}
                            </div>
                            <span className={`max-w-[45%] shrink-0 rounded-md border px-2 py-1 text-right text-xs leading-4 font-semibold tabular-nums ${status === 'out' ? 'border-red-100 bg-red-50 text-red-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                              <span className="sr-only">{status === 'out' ? 'Épuisé' : 'À racheter'} : </span>
                              {formatProductReorder(product)}
                            </span>
                          </div>
                          <AlternativeSupplierReminder supplierIds={product.alternative_supplier_ids} primarySupplierId={product.supplier_id} suppliers={suppliers} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3">
          <Button
            variant="outline"
            onClick={() => window.open(`tel:${supplier.phone_number}`, '_self')}
            disabled={!supplier?.phone_number}
            aria-label={supplier?.phone_number ? `Appeler ${supplier.name}` : 'Numéro non disponible'}
            title={supplier?.phone_number ? `Appeler ${supplier.name}` : 'Numéro non disponible'}
            className="h-11 min-w-11 rounded-xl border-emerald-200 px-3 text-emerald-700 shadow-none hover:bg-emerald-50 hover:text-emerald-800"
          >
            <PhoneCall aria-hidden="true" className="size-4" />
            <span className="hidden min-[380px]:inline">Appeler</span>
          </Button>
          {filteredProducts.length > 0 && (
            <>
              <Button
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                aria-label={isGeneratingPDF ? 'Génération du bon de commande' : 'Générer Bon de Commande'}
                title="Générer Bon de Commande"
                className="h-11 min-w-0 flex-1 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white shadow-none hover:bg-violet-700"
              >
                {isGeneratingPDF ? <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <FileText aria-hidden="true" className="size-4" />}
                <span className="truncate">{isGeneratingPDF ? 'Génération…' : 'Bon de commande'}</span>
              </Button>
              <Button
                onClick={handleShareEmail}
                variant="outline"
                size="icon"
                disabled={!supplier?.email}
                aria-label="Envoyer par email"
                title={supplier?.email ? 'Envoyer par email' : 'Email non disponible'}
                className="size-11 rounded-xl border-gray-200 text-gray-600 shadow-none hover:bg-violet-50 hover:text-violet-700"
              >
                <Mail aria-hidden="true" className="size-4" />
              </Button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
