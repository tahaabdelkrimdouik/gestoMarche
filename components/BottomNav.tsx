'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, Truck, Layers, Store, ShoppingCart, LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

// 5 onglets pour éviter le défilement horizontal sur mobile (Paramètres retiré)
const tabs: Tab[] = [
  { id: 'stock', label: 'Stock', icon: Package, href: '/stock' },
  { id: 'catalogue', label: 'Catalogue', icon: Layers, href: '/catalogue' },
  { id: 'orders', label: 'Commandes', icon: ShoppingCart, href: '/orders' },
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck, href: '/suppliers' },
  { id: 'markets', label: 'Marchés', icon: Store, href: '/markets' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100 safe-area-bottom">
      <div className="grid grid-cols-5 w-full max-w-full overflow-hidden box-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="relative flex flex-col items-center justify-center min-h-[56px] py-1.5 px-1 rounded-none transition-all duration-300 touch-manipulation active:scale-95"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-emerald-50 rounded-none"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon
                  className={`w-5 h-5 transition-colors duration-300 ${
                    isActive ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors duration-300 leading-tight text-center max-w-full truncate px-0.5 ${
                    isActive ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
