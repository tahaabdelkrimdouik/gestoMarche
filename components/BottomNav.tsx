import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Truck, Settings, Layers, Store, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

// 1. Définition du type pour un onglet
interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

const tabs: Tab[] = [
  { id: 'stock', label: 'Stock', icon: Package, href: '/stock' },
  { id: 'catalogue', label: 'Catalogue', icon: Layers, href: '/catalogue' },
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck, href: '/suppliers' },
  { id: 'markets', label: 'Marchés', icon: Store, href: '/markets' },
  { id: 'settings', label: 'Paramètres', icon: Settings, href: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100 safe-area-bottom overflow-x-auto">
      <div className="flex items-center justify-around px-2 py-2 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="relative flex flex-col items-center justify-center min-w-[70px] min-h-[60px] py-2 px-3 rounded-2xl transition-all duration-300 touch-manipulation active:scale-95"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-emerald-50 rounded-2xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className={`w-6 h-6 transition-colors duration-300 ${
                    isActive ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
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