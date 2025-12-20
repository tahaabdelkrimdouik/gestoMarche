import React from 'react';
import { Card } from '@/components/ui/card';
import { ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Définir la structure d'un fournisseur
interface Supplier {
  id: string;
  name: string;
  phone?: string; // Le point d'interrogation signifie que c'est optionnel
}

// 2. Définir les types pour les props du composant
interface SupplierCardProps {
  supplier: Supplier;
  alertCount: number;
  onClick: () => void;
}

export default function SupplierCard({ supplier, alertCount, onClick }: SupplierCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        onClick={onClick}
        className="p-5 min-h-[68px] bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl cursor-pointer active:bg-gray-50 touch-manipulation active:scale-[0.98]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <User className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {supplier.name}
            </h3>
            {supplier.phone && (
              <p className="text-sm text-gray-500 truncate">
                {supplier.phone}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {alertCount > 0 && (
              <div className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-red-100 text-red-600 text-sm font-semibold">
                {alertCount}
              </div>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}