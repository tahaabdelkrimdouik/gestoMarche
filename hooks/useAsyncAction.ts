'use client';

import { useRef, useState } from 'react';

// The ref also prevents a second submission before React renders the disabled button.
export function useAsyncAction(fallback = 'Enregistrement impossible. Vérifiez votre connexion et réessayez.') {
  const lock = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setIsPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(fallback);
    } finally {
      lock.current = false;
      setIsPending(false);
    }
  };

  return { run, isPending, error, resetError: () => setError(null) };
}
