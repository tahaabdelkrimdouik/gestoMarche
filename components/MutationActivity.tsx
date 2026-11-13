'use client';

import { useIsMutating, useMutationState } from '@tanstack/react-query';
import { LoadingIndicator } from './QueryFeedback';

export default function MutationActivity() {
  const count = useIsMutating();
  const paused = useMutationState({ filters: { status: 'pending' }, select: mutation => mutation.state.isPaused }).some(Boolean);
  if (!count) return null;
  return <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-lg"><LoadingIndicator>{paused ? 'Hors ligne : opération en attente…' : 'Opération en cours…'}</LoadingIndicator></div>;
}
