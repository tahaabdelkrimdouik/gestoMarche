import React from 'react';
import { Card } from '@/components/ui/card';
import { Check, AlertTriangle, XCircle, LucideIcon, Info } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Définition du type pour le statut (Union Type)
type StockStatus = 'available' | 'low' | 'out';

// 2. Structure d'un produit (can have status per market)
interface Product {
  id: string;
  name: string;
  status?: StockStatus; // Optional for backward compatibility
  currentMarketStatus?: StockStatus; // Status for the current market
  price_purchase?: number;
  price_sale?: number;
  hasDifferentStatuses?: boolean; // True if product has different statuses in different markets
  statusByMarket?: Record<string, string[]>; // Status breakdown: { 'available': [marketId1, ...], 'low': [marketId2, ...] }
  markets?: Array<{ id: string; name: string }>; // List of markets for display
  selectedMarket?: string; // Current selected market ('all' or market ID)
}

// 3. Types pour les Props
interface ProductCardProps {
  product: Product;
  onStatusChange: (id: string, newStatus: StockStatus) => void;
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

export default function ProductCard({ product, onStatusChange }: ProductCardProps) {
  // Use currentMarketStatus if available (per-market status), otherwise fall back to status
  const productStatus = product.currentMarketStatus || product.status || 'available';
  const config = statusConfigs[productStatus];
  const isAllMarkets = product.selectedMarket === 'all';
  const hasDifferentStatuses = product.hasDifferentStatuses || false;
  const statusByMarket = product.statusByMarket || {};
  const markets = product.markets || [];

  // Helper to get market name by ID
  const getMarketName = (marketId: string) => {
    return markets.find(m => m.id === marketId)?.name || marketId;
  };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="p-4 border-0 shadow-sm rounded-2xl bg-white">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
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
                      if (!statusConfig || !Array.isArray(marketIds)) return null;
                      
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

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(statusConfigs) as StockStatus[]).map((status) => {
              const s = statusConfigs[status];
              const isActive = productStatus === status;
              
              return (
                <button
                  key={status}
                  onClick={() => onStatusChange(product.id, status)}
                  className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all border-2 ${
                    isActive 
                      ? 'border-gray-900 bg-gray-900 text-white' 
                      : 'border-gray-100 bg-gray-50 text-gray-400'
                  }`}
                >
                  {s.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}