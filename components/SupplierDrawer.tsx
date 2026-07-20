import { useState, useMemo } from 'react';
import { X, AlertTriangle, Phone, Mail, FileText, PhoneCall, Square, Search, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePurchaseOrderPDF, sharePDF } from '@/components/PdfGenerator';
import { notify } from '@/lib/utils/notify';
import { ProductWithMarkets, Supplier } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { formatReorderQuantity, getReorderDetails } from '@/lib/reorder';

const statusConfig = {
  low: {
    label: 'À racheter',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertTriangle,
  },
};
interface SupplierDrawerProps {
    supplier: Supplier;
    products: ProductWithMarkets[];
    onClose: () => void;
    isOpen: boolean;
}

interface SupplierDrawerPropsWithEdit extends SupplierDrawerProps {
  onEditSupplier?: () => void;
}

export default function SupplierDrawer({ isOpen, supplier, products, onClose, onEditSupplier }: SupplierDrawerPropsWithEdit) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const formatProductReorder = (product: ProductWithMarkets) => {
    const details = getReorderDetails(product.product_markets || []);
    return formatReorderQuantity(details.quantity, details.unit);
  };

  // CRITICAL FILTER: Only show products with "low" status (à racheter)
  // - "low" means product doesn't exist in stock globally and needs supplier purchase
  // - EXCLUDE products with "out" status (épuisé) - those can be transferred from another market
  // - EXCLUDE products that are only "out" in some markets but "available" elsewhere
  const criticalProducts = useMemo(() => {
    return products.filter((p) => {
      const markets = p.product_markets || [];
      if (markets.length === 0) return false;

      // Check if product has "low" status in at least one market
      // Since "low" is global, if it's "low" in one market, it's "low" globally
      const hasLowStatus = markets.some((pm) => pm.status === 'low');
      
      // Only show products that need purchasing (low status)
      // Explicitly exclude products with "out" status (those can be transferred)
      return hasLowStatus;
    });
  }, [products]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return criticalProducts;
    const q = searchQuery.toLowerCase();
    return criticalProducts.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q)
    );
  }, [criticalProducts, searchQuery]);

  // Mutation to mark product as purchased (change "low" to "available" for ALL markets)
  const markAsPurchasedMutation = useMutation({
    mutationFn: async (productId: string) => {
      const product = products.find(p => p.id === productId);
      if (!product || !product.product_markets) return;

      // Update all markets from "low" to "available" (since low is global)
      const updatePromises = product.product_markets.map((pm) =>
        supabase
          .from('product_markets')
          .update({ status: 'available' })
          .eq('product_id', productId)
          .eq('market_id', pm.market_id)
      );

      await Promise.all(updatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setUpdatingProductId(null);
      notify.success('Produit marqué comme disponible');
    },
    onError: (error) => {
      console.error('Error marking product as available:', error);
      setUpdatingProductId(null);
      notify.error('Erreur lors de la mise à jour');
    },
  });

  const handleMarkAsAvailable = (productId: string) => {
    setUpdatingProductId(productId);
    markAsPurchasedMutation.mutate(productId);
  };

  const handleMarkAllAsAvailable = () => {
    if (filteredProducts.length === 0) return;
    // Mark all products one by one with small delay
    filteredProducts.forEach((product, index) => {
      setTimeout(() => {
        markAsPurchasedMutation.mutate(product.id);
      }, index * 100); // Small delay to avoid overwhelming the API
    });
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
      const pdfData = await generatePurchaseOrderPDF(supplier, criticalProducts);

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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '90vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                    <span className="text-white text-xl font-bold">
                      {supplier?.name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {supplier?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {supplier?.phone_number && (
                        <a href={`tel:${supplier.phone_number}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                          <Phone className="w-3.5 h-3.5" />
                          {supplier.phone_number}
                        </a>
                      )}
                      {supplier?.email && (
                        <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                          <Mail className="w-3.5 h-3.5" />
                          {supplier.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEditSupplier && (
                    <button 
                      onClick={onEditSupplier}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-violet-100 flex items-center justify-center hover:bg-violet-200 transition-colors touch-manipulation active:scale-95"
                      title="Modifier le fournisseur"
                    >
                      <Pencil className="w-5 h-5 text-violet-600" />
                    </button>
                  )}
                  <button 
                    onClick={onClose}
                    className="min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors touch-manipulation active:scale-95"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Produits à commander ({filteredProducts.length})
                </h3>
                {filteredProducts.length > 0 && (
                  <button
                    onClick={handleMarkAllAsAvailable}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    Tout marquer comme disponible
                  </button>
                )}
              </div>

              {/* Search */}
              {criticalProducts.length > 3 && (
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full min-h-[40px] pl-10 pr-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              )}

              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-gray-500">Tous les produits sont en stock</p>
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                  {filteredProducts.map((product) => {
                    const config = statusConfig.low;
                    const Icon = config.icon;
                    const isUpdating = updatingProductId === product.id;

                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => handleMarkAsAvailable(product.id)}
                            disabled={isUpdating}
                            className="flex-shrink-0 min-w-[24px] min-h-[24px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Marquer comme disponible"
                          >
                            {isUpdating ? (
                              <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Square className="w-6 h-6 text-gray-400 hover:text-amber-600 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900 block truncate">{product.name}</span>
                            {product.code && (
                              <span className="text-xs text-gray-500 font-mono">{product.code}</span>
                            )}
                          </div>
                        </div>
                        <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-bold text-gray-900">{formatProductReorder(product)}</span>
                          <Badge variant="outline" className={`${config.color} border`}>
                            {Icon && <Icon className="w-3 h-3 mr-1" />}
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-3">
              {/* Call Supplier Button */}
              <Button
                onClick={() => window.open(`tel:${supplier.phone_number}`, '_self')}
                disabled={!supplier.phone_number}
                className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-lg shadow-emerald-200 transition-all touch-manipulation active:scale-[0.98]"
              >
                <PhoneCall className="w-5 h-5 mr-2" />
                {supplier.phone_number
                  ? `Appeler ${supplier.name}`
                  : 'Numéro non disponible'
                }
              </Button>

              {filteredProducts.length > 0 && (
                <>
                  <Button
                    onClick={handleGeneratePDF}
                    disabled={isGeneratingPDF}
                    className="w-full min-h-[56px] rounded-2xl bg-violet-500 hover:bg-violet-600 text-white font-semibold text-base shadow-lg shadow-violet-200 transition-all touch-manipulation active:scale-[0.98]"
                  >
                    {isGeneratingPDF ? (
                      <>
                        <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 mr-2" />
                        Générer Bon de Commande
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleShareEmail}
                    variant="outline"
                    disabled={!supplier?.email || filteredProducts.length === 0}
                    className="w-full min-h-[56px] rounded-2xl border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-semibold text-base transition-all touch-manipulation active:scale-[0.98] disabled:opacity-50"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    Envoyer par email
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
