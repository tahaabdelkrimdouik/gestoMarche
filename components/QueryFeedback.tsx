'use client';

import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryState {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: string;
  refetch: () => Promise<unknown>;
}

export function LoadingIndicator({ children = 'Chargement en cours…' }: { children?: ReactNode }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm"><LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />{children}</span>;
}

export function ListSkeleton({ label = 'Chargement en cours…' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-4">
      <span className="text-sm text-gray-500">{label}</span>
      {[0, 1, 2, 3].map(index => (
        <div key={index} aria-hidden="true" className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 motion-safe:animate-pulse">
          <div className="flex justify-between gap-4"><div className="h-4 w-2/5 rounded bg-gray-200" /><div className="h-5 w-20 rounded-full bg-gray-100" /></div>
          <div className="h-3 w-1/3 rounded bg-gray-100" />
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(item => <div key={item} className="h-11 rounded-xl bg-gray-100" />)}</div>
        </div>
      ))}
    </div>
  );
}

export default function QueryFeedback({ queries, label, children }: { queries: QueryState[]; label: string; children: ReactNode }) {
  const missingData = queries.some(query => query.data === undefined);
  const failed = queries.some(query => query.isError);
  const fetching = queries.some(query => query.isFetching);
  const paused = queries.some(query => query.fetchStatus === 'paused');

  return (
    <>
      {(failed || paused) && (
        <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1">{paused ? 'Connexion interrompue. Le chargement reprendra dès votre retour en ligne.' : missingData ? 'Chargement impossible. Vérifiez votre connexion et réessayez.' : 'Actualisation impossible. Les dernières données disponibles restent affichées.'}</p>
          <Button variant="outline" disabled={fetching || paused} onClick={() => void Promise.allSettled(queries.map(query => query.refetch()))} className="min-h-11 rounded-xl">{fetching ? 'Chargement…' : 'Réessayer'}</Button>
        </div>
      )}
      {missingData ? (!failed && <ListSkeleton label={label} />) : (
        <>
          {fetching && <div className="py-2"><LoadingIndicator>Actualisation en cours…</LoadingIndicator></div>}
          {children}
        </>
      )}
    </>
  );
}
