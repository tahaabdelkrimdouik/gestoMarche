import React from 'react';
import { Package, Search, Truck, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

const icons = {
  products: Package,
  search: Search,
  suppliers: Truck,
  categories: Tag,
};
type EmptyStateType = 'products' | 'search' | 'suppliers' | 'categories';

// 2. Définition des Props
interface EmptyStateProps {
  type?: EmptyStateType; // Le ? signifie que c'est optionnel (défaut: 'products')
  title: string;
  description: string;
}


export default function EmptyState({ type = 'products', title, description }: EmptyStateProps) {
    const Icon = icons[type] || Package;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-gray-500 max-w-xs">
        {description}
      </p>
    </motion.div>
  );
}