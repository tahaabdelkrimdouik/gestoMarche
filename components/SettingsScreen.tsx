import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Store, 
  Package, 
  Truck, 
  Bell, 
  Moon, 
  HelpCircle, 
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

const settingsGroups = [
  {
    title: 'Gestion',
    items: [
      { id: 'markets', label: 'Mes marchés', icon: Store, badge: null, route: '/markets' },
      { id: 'products', label: 'Gérer les produits', icon: Package, badge: null, route: '/catalogue' },
      { id: 'suppliers', label: 'Gérer les fournisseurs', icon: Truck, badge: null, route: '/suppliers' },
    ],
  },
  {
    title: 'Préférences',
    items: [
      { id: 'theme', label: 'Mode sombre', icon: Moon, badge: 'Bientôt' },
    ],
  },

];

interface SettingsScreenProps {
  onNavigate?: (route: string) => void;
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  return (
    <div className="px-4 py-4 sm:py-6 pb-28 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-200 mb-3 sm:mb-4">
          <Package className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">GestoStock</h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">Gérez vos paramètres</p>
      </div>

      {/* Settings Groups */}
      {settingsGroups.map((group, groupIndex) => (
        <motion.div
          key={group.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIndex * 0.1 }}
        >
          <h2 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 px-1">
            {group.title}
          </h2>
          <Card className="overflow-hidden border-0 shadow-sm rounded-2xl">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === group.items.length - 1;
              
              return (
                <button
                  key={item.id}
                  onClick={() => item.route && onNavigate?.(item.route)}
                  disabled={!item.route}
                  className={`w-full flex items-center gap-4 p-5 min-h-[64px] hover:bg-gray-50 transition-colors touch-manipulation active:bg-gray-100 ${
                    !isLast ? 'border-b border-gray-100' : ''
                  } ${!item.route ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                  </div>
                  <span className="flex-1 text-left font-medium text-sm sm:text-base text-gray-900">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              );
            })}
          </Card>
        </motion.div>
      ))}



      {/* Version */}
      <p className="text-center text-xs sm:text-sm text-gray-400">
        Built with douik karim
      </p>
    </div>
  );
}