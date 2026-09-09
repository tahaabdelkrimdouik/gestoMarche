'use client';

import { Search, MapPin, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import VoiceSearchDialog from '@/components/VoiceSearchDialog';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
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

interface HeaderProps {
  markets: Market[];
  selectedMarket: string;
  onMarketChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  productNames?: string[];
}

export default function Header({
  markets,
  selectedMarket,
  onMarketChange,
  searchQuery,
  onSearchChange,
  productNames = [],
}: HeaderProps) {
  const voice = useVoiceSearch({
    productNames,
    onSearch: onSearchChange,
  });

  const micActive = voice.status === 'listening'
    || voice.status === 'requesting-permission'
    || voice.status === 'processing';

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
              <SelectItem
                value="all"
                className="rounded-lg py-3 cursor-pointer font-semibold"
              >
                Tous les marchés
              </SelectItem>

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
            className="w-full min-h-[48px] pl-12 pr-14 border-0 bg-gray-50 rounded-xl text-base placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:bg-white transition-all touch-manipulation"
          />
          <button
            type="button"
            onClick={voice.toggle}
            aria-label={micActive ? 'Arrêter la recherche vocale' : 'Rechercher un produit avec la voix'}
            aria-pressed={micActive}
            title="Recherche vocale"
            className={`absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl transition-all touch-manipulation ${
              micActive
                ? 'bg-red-50 text-red-600 animate-pulse'
                : 'text-emerald-600 hover:bg-emerald-50 active:scale-95'
            }`}
          >
            <Mic className="h-5 w-5" />
          </button>
          <span className="sr-only" aria-live="polite">
            {micActive ? 'Écoute en cours… Dites le nom du produit.' : ''}
          </span>
          <VoiceSearchDialog voice={voice} />
        </div>
      </div>
    </header>
  );
}
