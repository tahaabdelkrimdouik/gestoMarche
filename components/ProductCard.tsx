import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Check, AlertTriangle, XCircle, LucideIcon, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import ReorderQuantityFields from '@/components/ReorderQuantityFields';
import { getReorderDetails, type ReorderUnit } from '@/lib/reorder';
import type { Market, ProductWithMarkets, StockStatus } from '@/lib/types';
import { getStockStatus } from '@/lib/stockStatus';

interface ProductCardProps {
  product: ProductWithMarkets;
  markets: Market[];
  selectedMarket: string;
  onStatusChange: (id: string, newStatus: StockStatus) => void;
  onReorderSave: (id: string, quantity: number, unit: ReorderUnit) => Promise<void>;
}

// 4. Configuration des styles par statut
interface StatusConfig {
  label: string;
  color: string;
  icon: LucideIcon;
}

const statusConfigs: Record<StockStatus, StatusConfig> = {
  available: { label: 'Disponible', color: 'text-emerald-600 bg-emerald-50', icon: Check },
  low: { label: 'À racheter', color: 'text-amber-600 bg-amber-50', icon: AlertTriangle },
  out: { label: 'Épuisé', color: 'text-red-600 bg-red-50', icon: XCircle },
};

function ProductCard({ product, markets, selectedMarket, onStatusChange, onReorderSave }: ProductCardProps) {
  const productStatus = getStockStatus(product, selectedMarket);
  const config = statusConfigs[productStatus];
  const isAllMarkets = selectedMarket === 'all';
  const relations = isAllMarkets ? product.product_markets
    : product.product_markets.filter(market => market.market_id === selectedMarket);
  const hasDifferentStatuses = isAllMarkets && new Set(relations.map(market => market.status)).size > 1;
  const statusByMarket = relations.reduce<Record<StockStatus, string[]>>((result, market) => {
    result[market.status].push(market.market_id);
    return result;
  }, { available: [], low: [], out: [] });
  const { quantity: initialQuantity, unit: initialUnit } = getReorderDetails(relations);

  // Helper to get market name by ID
  const getMarketName = (marketId: string) => {
    return markets.find(m => m.id === marketId)?.name || marketId;
  };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="gap-0 p-3.5 sm:p-4 border border-gray-100 shadow-sm rounded-2xl bg-white">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex justify-between items-start gap-3">
            <h3 className="min-w-0 break-words text-sm sm:text-base font-semibold leading-snug text-gray-900">{product.name}</h3>
            <div className={`flex shrink-0 items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
              <config.icon className="w-3 h-3" />
              {config.label}
            </div>
          </div>

          {/* Alert when product has different statuses in different markets */}
          {isAllMarkets && hasDifferentStatuses && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    Statuts différents selon les marchés:
                  </p>
                  <div className="space-y-1">
                    {Object.entries(statusByMarket).map(([status, marketIds]) => {
                      const statusConfig = statusConfigs[status as StockStatus];
                      if (!statusConfig || !marketIds.length) return null;
                      
                      return (
                        <div key={status} className="flex items-center gap-2 text-xs">
                          <div className={`px-2 py-0.5 rounded ${statusConfig.color} font-medium`}>
                            {statusConfig.label}
                          </div>
                          <span className="text-amber-700">
                            {marketIds.map(id => getMarketName(id)).join(', ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div role="group" aria-label={`Statut de ${product.name}`} className="grid grid-cols-3 gap-2">
            {(Object.keys(statusConfigs) as StockStatus[]).map((status) => {
              const s = statusConfigs[status];
              const isActive = productStatus === status;
              
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusChange(product.id, status)}
                  aria-pressed={isActive}
                  className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-medium leading-snug transition-colors border touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    isActive 
                      ? 'border-gray-900 bg-gray-900 text-white' 
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {productStatus !== 'available' && (
            <ReorderQuantityFields
              key={`${product.id}-${selectedMarket}-${initialQuantity}-${initialUnit}`}
              productId={product.id}
              initialQuantity={initialQuantity}
              initialUnit={initialUnit}
              isAllMarkets={isAllMarkets}
              onSave={(quantity, unit) => onReorderSave(product.id, quantity, unit)}
            />
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default memo(ProductCard);
