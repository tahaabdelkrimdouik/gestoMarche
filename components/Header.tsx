import { Search, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
interface Market {
  id: string;
  name: string;
}

// 2. Types pour les Props
interface HeaderProps {
  markets: Market[];
  selectedMarket: string;
  onMarketChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}
export default function Header({ markets, selectedMarket, onMarketChange, searchQuery, onSearchChange }:HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="px-4 py-4 space-y-3">
        {/* Market Selector */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <Select value={selectedMarket} onValueChange={onMarketChange}>
            <SelectTrigger className="flex-1 min-h-[48px] border-0 bg-gray-50 rounded-xl text-base font-medium hover:bg-gray-100 transition-colors touch-manipulation">
              <SelectValue placeholder="Choisir un marché" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {markets.map((market) => (
                <SelectItem 
                  key={market.id} 
                  value={market.id}
                  className="rounded-lg py-3 cursor-pointer"
                >
                  {market.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[48px] pl-12 pr-4 border-0 bg-gray-50 rounded-xl text-base placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:bg-white transition-all touch-manipulation"
          />
        </div>
      </div>
    </header>
  );
}