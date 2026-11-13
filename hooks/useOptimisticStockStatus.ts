'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { createStockStatusUpdater } from '@/lib/stockStatus';
import { notify } from '@/lib/utils/notify';

const updaters = new WeakMap<QueryClient, ReturnType<typeof createStockStatusUpdater>>();

export function useOptimisticStockStatus() {
  const client = useQueryClient();
  let updater = updaters.get(client);
  if (!updater) {
    updater = createStockStatusUpdater(client, async ({ productId, marketIds, status }) => {
      const { data, error } = await supabase.from('product_markets')
        .update({ status }).eq('product_id', productId).in('market_id', marketIds).select('market_id');
      if (error) throw error;
      return (data || []).map(row => row.market_id as string);
    }, () => notify.error('Modification impossible. Le dernier statut enregistré a été rétabli.'));
    updaters.set(client, updater);
  }
  return updater.update;
}
