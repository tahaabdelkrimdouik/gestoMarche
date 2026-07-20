'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { notify } from '@/lib/utils/notify';
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
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export default function Header({ 
  markets, 
  selectedMarket, 
  onMarketChange, 
  searchQuery, 
  onSearchChange 
}: HeaderProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const handleVoiceSearch = () => {
    let recognition = recognitionRef.current;

    if (recognition && isListening) {
      recognition.stop();
      return;
    }

    if (!recognition) {
      const SpeechRecognition = getSpeechRecognitionConstructor();
      if (!SpeechRecognition) {
        notify.error('La recherche vocale n\u2019est pas disponible sur ce navigateur');
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        let transcript = '';

        for (let index = 0; index < event.results.length; index += 1) {
          transcript += `${event.results[index][0].transcript} `;
        }

        const cleanTranscript = transcript.trim().replace(/[.,!?;:]+$/g, '');
        if (cleanTranscript) onSearchChange(cleanTranscript);
      };
      recognition.onerror = (event) => {
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          notify.error('Autorisez le microphone pour utiliser la recherche vocale');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          notify.error('La recherche vocale n\u2019a pas fonctionn\u00e9');
        }
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    try {
      recognition.start();
    } catch {
      notify.error('Patientez un instant avant de relancer le microphone');
    }
  };

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
              {/* All Markets Option */}
              <SelectItem 
                value="all"
                className="rounded-lg py-3 cursor-pointer font-semibold"
              >
                Tous les marchés
              </SelectItem>
              
              {/* Individual Markets */}
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
            onClick={handleVoiceSearch}
            aria-label={isListening ? 'Arr\u00eater la recherche vocale' : 'Rechercher un produit avec la voix'}
            aria-pressed={isListening}
            title="Recherche vocale"
            className={`absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-xl transition-all touch-manipulation ${
              isListening
                ? 'bg-red-50 text-red-600 animate-pulse'
                : 'text-emerald-600 hover:bg-emerald-50 active:scale-95'
            }`}
          >
            <Mic className="h-5 w-5" />
          </button>
          <span className="sr-only" aria-live="polite">
            {isListening ? '\u00c9coute en cours\u2026 Dites le nom du produit.' : ''}
          </span>
        </div>
      </div>
    </header>
  );
}
