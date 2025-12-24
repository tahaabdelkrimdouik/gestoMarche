import { useState } from 'react';
import { X, AlertTriangle, XCircle, Phone, MessageCircle, FileText, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { generatePurchaseOrderPDF, sharePDF } from '@/components/PdfGenerator';
import { Product, Supplier } from '@/lib/types';

const statusConfig = {
  low: {
    label: 'Presque fini',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertTriangle,
  },
  out: {
    label: 'Épuisé',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle,
  },
};
interface SupplierDrawerProps {
    supplier: Supplier;
    products: Product[];
    onClose: () => void;
    isOpen: boolean;
}

export default function SupplierDrawer({ isOpen, supplier, products, onClose }: SupplierDrawerProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const criticalProducts = products.filter(p => p.status === 'low' || p.status === 'out');

  const handleShare = () => {
    const productList = criticalProducts
      .filter(p => p.status in statusConfig)
      .map(p => `• ${p.name} (${statusConfig[p.status as keyof typeof statusConfig]?.label})`)
      .join('\n');
    
    const message = `🛒 Liste de réapprovisionnement\n\nFournisseur: ${supplier?.name}\n\nProduits à commander:\n${productList}`;
    
    const whatsappUrl = `https://wa.me/${supplier?.phone_number?.toString().replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      // Générer le PDF réel
      const pdfData = await generatePurchaseOrderPDF(supplier, criticalProducts);

      // Partager ou télécharger selon la plateforme
      await sharePDF(pdfData);

      console.log('✅ PDF généré avec succès:', pdfData);
    } catch (error) {
      console.error('❌ Erreur lors de la génération du PDF:', error);
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
            className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-3xl  overflow-hidden"
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
                    <div className="flex items-center gap-3 mt-1">
                      {supplier?.phone_number && (
                        <a href={`tel:${supplier.phone_number}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                          <Phone className="w-3.5 h-3.5" />
                          {supplier.phone_number}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors touch-manipulation active:scale-95"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Produits à commander ({criticalProducts.length})
                </h3>
              </div>

              {criticalProducts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-gray-500">Tous les produits sont en stock</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {criticalProducts.map((product) => {
                    const config = statusConfig[product.status as keyof typeof statusConfig];
                    const Icon = config?.icon;
                    
                    return (
                      <div 
                        key={product.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                      >
                        <span className="font-medium text-gray-900">{product.name}</span>
                        <Badge variant="outline" className={`${config?.color} border`}>
                          {Icon && <Icon className="w-3.5 h-3.5 mr-1" />}
                          {config?.label}
                        </Badge>
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

              {criticalProducts.length > 0 && (
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
                    onClick={handleShare}
                    variant="outline"
                    className="w-full min-h-[56px] rounded-2xl border-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-semibold text-base transition-all touch-manipulation active:scale-[0.98]"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Partager sur WhatsApp
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