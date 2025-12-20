import React from 'react';
import { Card } from '@/components/ui/card';
import { Check, AlertTriangle, XCircle, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Définition du type pour le statut (Union Type)
type StockStatus = 'available' | 'low' | 'out';

// 2. Structure d'un produit
interface Product {
  id: string;
  name: string;
  status: StockStatus;
  price_purchase?: number;
  price_sale?: number;
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
  const config = statusConfigs[product.status];

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

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(statusConfigs) as StockStatus[]).map((status) => {
              const s = statusConfigs[status];
              const isActive = product.status === status;
              
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