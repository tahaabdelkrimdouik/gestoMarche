'use client';

import { Mic, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VoiceSearchController } from '@/hooks/useVoiceSearch';

interface VoiceSearchPanelProps {
  voice: VoiceSearchController;
}

export default function VoiceSearchDialog({ voice }: VoiceSearchPanelProps) {
  if (!voice.isOpen) return null;

  const isListening = voice.status === 'listening'
    || voice.status === 'requesting-permission'
    || voice.status === 'processing';

  return (
    <div
      className="absolute left-0 right-0 top-full z-[60] mt-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-lg shadow-gray-200/70"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            voice.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600'
          }`}
        >
          <Mic className={`h-5 w-5 ${isListening ? 'animate-pulse' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {voice.status === 'error'
              ? 'Je n’ai pas bien compris'
              : voice.status === 'processing'
                ? 'Recherche…'
                : voice.status === 'requesting-permission'
                  ? 'Microphone…'
                  : 'Écoute en cours…'}
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {voice.status === 'error'
              ? voice.errorMessage
              : voice.liveTranscript
                ? `« ${voice.liveTranscript} »`
                : 'Dites le nom du produit'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={voice.cancel}
          className="min-h-[44px] flex-1 rounded-xl touch-manipulation"
        >
          Annuler
        </Button>
        {isListening ? (
          <Button
            type="button"
            variant="destructive"
            onClick={voice.stop}
            className="min-h-[44px] flex-1 rounded-xl touch-manipulation"
          >
            <Square className="h-4 w-4" />
            Arrêter
          </Button>
        ) : (
          <Button
            type="button"
            onClick={voice.retry}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 touch-manipulation hover:bg-emerald-700"
          >
            <RotateCcw className="h-4 w-4" />
            Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}
