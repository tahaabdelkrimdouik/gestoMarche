'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 pb-28">
      <main role="alert" className="mx-auto max-w-md space-y-4 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
        <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="text-xl font-semibold">Impossible d’afficher cette page</h1>
        <p className="text-sm text-gray-500">Une erreur est survenue. Réessayez ou ouvrez une autre rubrique.</p>
        <Button onClick={reset} className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">Réessayer</Button>
      </main>
      <BottomNav />
    </div>
  );
}
