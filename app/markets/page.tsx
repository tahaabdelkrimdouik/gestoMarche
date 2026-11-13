'use client'
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Edit2, Trash2 } from 'lucide-react';

// COMPONENTS
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { notify } from '@/lib/utils/notify';
import { Label } from '@/components/ui/label';
import { LoadingIndicator } from '@/components/QueryFeedback';
import QueryFeedback from '@/components/QueryFeedback';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// TYPES & QUERIES
import type { Market } from '@/lib/types';
import { fetchMarkets, fetchProducts } from '@/lib/queries';

export default function MarketsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [newMarketName, setNewMarketName] = useState('');

  const saving = useAsyncAction();
  const deletion = useAsyncAction('Suppression impossible. Vérifiez les produits associés à ce marché.');
  const [marketToDelete, setMarketToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // FETCH DATA
  const marketsQuery = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  });
  const { data: markets = [] } = marketsQuery;

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const { data: products = [] } = productsQuery;

  // CREATE MARKET MUTATION
  const createMarketMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('markets')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      setIsCreateDialogOpen(false);
      setNewMarketName('');
      notify.success('Marché enregistré');
    },
  });

  // UPDATE MARKET MUTATION
  const updateMarketMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('markets')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      setEditingMarket(null);
      setNewMarketName('');
      notify.success('Marché enregistré');
    },
  });

  // DELETE MARKET MUTATION
  const deleteMarketMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if market has associated products
      const marketProducts = products.filter((product) =>
        product.product_markets?.some((pm) => pm.market_id === id)
      );

      if (marketProducts.length > 0) {
        throw new Error(`Impossible de supprimer ce marché car ${marketProducts.length} produit(s) y sont associé(s).`);
      }

      const { error } = await supabase
        .from('markets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      setMarketToDelete(null);
      notify.success('Marché supprimé');
    },
  });

  const handleCreateMarket = () => {
    if (newMarketName.trim()) {
      void saving.run(async () => { await createMarketMutation.mutateAsync(newMarketName.trim()); });
    }
  };

  const handleUpdateMarket = () => {
    if (editingMarket && newMarketName.trim()) {
      void saving.run(async () => { await updateMarketMutation.mutateAsync({ id: editingMarket.id, name: newMarketName.trim() }); });
    }
  };

  const handleDeleteMarket = (market: Market) => {
    void deletion.run(async () => { await deleteMarketMutation.mutateAsync(market.id); });
  };

  const openEditDialog = (market: Market) => {
    saving.resetError();
    setEditingMarket(market);
    setNewMarketName(market.name);
  };

  const getMarketProductCount = (marketId: string) => {
    return products.filter((product) =>
      product.product_markets?.some((pm) => pm.market_id === marketId)
    ).length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Marchés</h1>
          <Dialog open={isCreateDialogOpen} onOpenChange={open => { if (!saving.isPending) { setIsCreateDialogOpen(open); if (open) { setNewMarketName(''); saving.resetError(); } } }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nouveau marché
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={!saving.isPending}>
              <DialogHeader>
                <DialogTitle>Ajouter un marché</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="new-market-name">Nom du marché *</Label>
                <Input
                  id="new-market-name"
                  disabled={saving.isPending}
                  placeholder="Nom du marché"
                  value={newMarketName}
                  onChange={(e) => setNewMarketName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateMarket()}
                />
                {saving.error && <p role="alert" className="text-sm text-red-600">{saving.error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    disabled={saving.isPending}
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateMarket}
                    disabled={!newMarketName.trim() || saving.isPending}
                  >
                    {saving.isPending ? <LoadingIndicator>Création…</LoadingIndicator> : 'Créer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="p-4 pb-24 sm:pb-28">
        <QueryFeedback queries={[marketsQuery, productsQuery]} label="Chargement des marchés…">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <Card key={market.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{market.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {getMarketProductCount(market.id)} produit(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(market)}
                    className="flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Modifier
                  </Button>

                  <AlertDialog open={marketToDelete === market.id} onOpenChange={open => { if (!deletion.isPending) { if (open) deletion.resetError(); setMarketToDelete(open ? market.id : null); } }}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer le marché « {market.name} » ?
                          {getMarketProductCount(market.id) > 0 && (
                            <span className="block mt-2 text-red-600 font-medium">
                              ⚠️ Ce marché contient {getMarketProductCount(market.id)} produit(s).
                              La suppression est impossible.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {deletion.error && <p role="alert" className="text-sm text-red-600">{deletion.error}</p>}
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletion.isPending}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={event => { event.preventDefault(); handleDeleteMarket(market); }}
                          disabled={getMarketProductCount(market.id) > 0 || deletion.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deletion.isPending ? <LoadingIndicator>Suppression…</LoadingIndicator> : 'Supprimer'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {markets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun marché créé</p>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="mt-4"
            >
              Créer le premier marché
            </Button>
          </div>
        )}
        </QueryFeedback>
      </main>

      {/* FOOTER */}
      <BottomNav />

      {/* EDIT DIALOG */}
      <Dialog open={!!editingMarket} onOpenChange={() => !saving.isPending && setEditingMarket(null)}>
        <DialogContent showCloseButton={!saving.isPending}>
          <DialogHeader>
            <DialogTitle>Modifier le marché</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="edit-market-name">Nom du marché *</Label>
            <Input
              id="edit-market-name"
              disabled={saving.isPending}
              placeholder="Nom du marché"
              value={newMarketName}
              onChange={(e) => setNewMarketName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateMarket()}
            />
            {saving.error && <p role="alert" className="text-sm text-red-600">{saving.error}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={saving.isPending}
                onClick={() => setEditingMarket(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleUpdateMarket}
                disabled={!newMarketName.trim() || saving.isPending}
              >
                {saving.isPending ? <LoadingIndicator>Enregistrement…</LoadingIndicator> : 'Modifier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
