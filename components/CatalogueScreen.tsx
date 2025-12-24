import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Truck,
  Pencil,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import EmptyState from './EmptyState';
// Assurez-vous que ces composants existent ou commentez-les si nécessaire
import FloatingActionButton from './FloatingActionButton'; 
import ProductFormDialog from './ProductFormDialog';
import SupplierFormDialog from './SupplierFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Market, Product, ProductWithMarkets, Supplier, Category } from '@/lib/types';

// 1. Interface des Props
interface CatalogueScreenProps {
  products: ProductWithMarkets[];
  suppliers: Supplier[];
  markets: Market[];
  categories: Category[];
  onCreateProduct: (data: any) => void; // On utilise any temporairement pour les forms, ou Omit<Product, 'id'>
  onUpdateProduct: (id: string, data: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onCreateSupplier: (data: any) => void;
  onUpdateSupplier: (id: string, data: Partial<Supplier>) => void;
  onDeleteSupplier: (id: string) => void;
}

export default function CatalogueScreen({
  products,
  suppliers,
  markets,
  categories,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier
}: CatalogueScreenProps) {

  const [activeTab, setActiveTab] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Correction: Typage explicite pour permettre l'objet ou null
  const [editingProduct, setEditingProduct] = useState<ProductWithMarkets | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  
  // Correction: Typage de l'état de suppression
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'product' | 'supplier' | null;
    id: string | null;
  }>({ isOpen: false, type: null, id: null });

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Filter by search query (name or code)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // Filter suppliers by search
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) 
      // Note: email n'est pas dans types.ts, on le retire ou on cast si nécessaire
      // || (s as any).email?.toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery]);

  // Correction: Typage des arguments
  const getSupplierName = (supplierId: string | null | undefined) => {
    if (!supplierId) return 'N/A';
    return suppliers.find(s => s.id === supplierId)?.name || 'N/A';
  };

  const getMarketName = (marketId: string | null | undefined) => {
      // Note: Product a maintenant product_markets[], cette fonction sert d'helper simple
      // Si un produit a plusieurs marchés, il faudrait adapter l'affichage.
      if (!marketId) return 'N/A';
      return markets.find(m => m.id === marketId)?.name || 'N/A';
  };

  const calculateMargin = (prixAchat: number | null | undefined, prixVente: number | null | undefined) => {
    if (!prixAchat || !prixVente) return null;
    return (((prixVente - prixAchat) / prixVente) * 100).toFixed(1);
  };

  const handleAddClick = () => {
    if (activeTab === 'products') {
      setEditingProduct(null);
      setIsProductDialogOpen(true);
    } else {
      setEditingSupplier(null);
      setIsSupplierDialogOpen(true);
    }
  };

  const handleEditProduct = (product: ProductWithMarkets) => {
    setEditingProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsSupplierDialogOpen(true);
  };

  const handleDeleteClick = (type: 'product' | 'supplier', id: string) => {
    setDeleteConfirm({ isOpen: true, type, id });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.type === 'product' && deleteConfirm.id) {
      onDeleteProduct(deleteConfirm.id);
    } else if (deleteConfirm.type === 'supplier' && deleteConfirm.id) {
      onDeleteSupplier(deleteConfirm.id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null });
  };

  const handleProductSubmit = (data: any) => {
    if (editingProduct) {
      onUpdateProduct(editingProduct.id, data);
    } else {
      onCreateProduct(data);
    }
    setIsProductDialogOpen(false);
    setEditingProduct(null);
  };

  const handleSupplierSubmit = (data: any) => {
    if (editingSupplier) {
      onUpdateSupplier(editingSupplier.id, data);
    } else {
      onCreateSupplier(data);
    }
    setIsSupplierDialogOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="px-4 py-4 sm:py-6 pb-28">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Catalogue</h1>
        <p className="text-sm sm:text-base text-gray-500">Gérez vos produits et fournisseurs</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder={activeTab === 'products' ? 'Rechercher par nom ou code...' : 'Rechercher un fournisseur...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-h-[48px] pl-12 pr-4 border-0 bg-white rounded-xl text-base shadow-sm touch-manipulation"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-100 p-1 min-h-[52px] rounded-xl">
          <TabsTrigger 
            value="products" 
            className="rounded-lg min-h-[44px] data-[state=active]:bg-white data-[state=active]:shadow-sm touch-manipulation"
          >
            <Package className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Produits ({products.length})</span>
            <span className="sm:hidden">Produits</span>
          </TabsTrigger>
          <TabsTrigger 
            value="suppliers"
            className="rounded-lg min-h-[44px] data-[state=active]:bg-white data-[state=active]:shadow-sm touch-manipulation"
          >
            <Truck className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Fournisseurs ({suppliers.length})</span>
            <span className="sm:hidden">Fournisseurs</span>
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-4">
          {/* Category Filter */}
          <div className="mb-4">
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full min-h-[48px] pl-12 pr-4 border-0 bg-white rounded-xl text-base shadow-sm touch-manipulation">
                  <SelectValue placeholder="Filtrer par catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState
              type="products"
              title="Aucun produit"
              description={searchQuery ? `Aucun produit ne correspond à "${searchQuery}"` : "Ajoutez des produits à votre catalogue"}
            />
          ) : (
            <Card className="overflow-hidden border-0 shadow-sm rounded-2xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold text-sm whitespace-nowrap">Produit</TableHead>
                      <TableHead className="font-semibold text-sm whitespace-nowrap hidden sm:table-cell">Code</TableHead>
                      <TableHead className="font-semibold text-sm whitespace-nowrap hidden md:table-cell">Catégorie</TableHead>
                      <TableHead className="font-semibold text-sm whitespace-nowrap hidden lg:table-cell">Fournisseur</TableHead>
                      <TableHead className="font-semibold text-sm text-right whitespace-nowrap">Prix achat</TableHead>
                      <TableHead className="font-semibold text-sm text-right whitespace-nowrap">Prix vente</TableHead>
                      <TableHead className="font-semibold text-sm text-center whitespace-nowrap hidden xl:table-cell">Marge</TableHead>
                      <TableHead className="font-semibold text-sm text-center whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      // Correction: Utilisation des noms de propriétés anglais (match types.ts)
                      const margin = calculateMargin(product.purchase_price, product.sale_price);
                      // Affichage simplifié du premier marché si disponible
                      const firstMarketId = product.product_markets?.[0]?.market_id;

                      // Get category name
                      const getCategoryName = (categoryId: string | undefined) => {
                        if (!categoryId) return 'N/A';
                        return categories.find(c => c.id === categoryId)?.name || 'N/A';
                      };

                      return (
                        <TableRow key={product.id} className="hover:bg-gray-50">
                          <TableCell className="min-w-[120px]">
                            <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm hidden sm:table-cell font-mono">
                            {product.code || '-'}
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm hidden md:table-cell">
                            {getCategoryName(product.category_id)}
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm hidden lg:table-cell">
                            {getSupplierName(product.supplier_id)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                            {product.purchase_price ? `${product.purchase_price.toFixed(2)} €` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                            {product.sale_price ? `${product.sale_price.toFixed(2)} €` : '-'}
                          </TableCell>
                          <TableCell className="text-center hidden xl:table-cell">
                            {margin !== null ? (
                              <Badge
                                variant="outline"
                                className={`text-xs whitespace-nowrap ${
                                  parseFloat(margin) > 30 ? 'bg-green-50 text-green-700 border-green-200' :
                                  parseFloat(margin) > 15 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                  'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {margin}%
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditProduct(product)}
                                className="min-h-[44px] min-w-[44px] hover:bg-gray-100 touch-manipulation"
                              >
                                <Pencil className="w-5 h-5 text-gray-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick('product', product.id)}
                                className="min-h-[44px] min-w-[44px] hover:bg-red-50 touch-manipulation"
                              >
                                <Trash2 className="w-5 h-5 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="mt-4">
          {filteredSuppliers.length === 0 ? (
            <EmptyState
              type="suppliers"
              title="Aucun fournisseur"
              description={searchQuery ? `Aucun fournisseur ne correspond à "${searchQuery}"` : "Ajoutez des fournisseurs"}
            />
          ) : (
            <Card className="overflow-hidden border-0 shadow-sm rounded-2xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold text-sm">Nom</TableHead>
                      <TableHead className="font-semibold text-sm hidden sm:table-cell">Téléphone</TableHead>
                      <TableHead className="font-semibold text-sm hidden md:table-cell">Email</TableHead>
                      <TableHead className="font-semibold text-sm text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-gray-900 text-sm">
                          {supplier.name}
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm hidden sm:table-cell">
                          {/* Correction: phone -> phone_number */}
                          {supplier.phone_number || '-'}
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm hidden md:table-cell">
                          {/* Note: Si l'email n'est pas dans types.ts, on met un tiret ou on cast */}
                          {(supplier as any).email || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSupplier(supplier)}
                              className="min-h-[44px] min-w-[44px] hover:bg-gray-100 touch-manipulation"
                            >
                              <Pencil className="w-5 h-5 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick('supplier', supplier.id)}
                              className="min-h-[44px] min-w-[44px] hover:bg-red-50 touch-manipulation"
                            >
                              <Trash2 className="w-5 h-5 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      {/* Assurez-vous que ce composant existe, sinon remplacez-le par un bouton standard */}
      <FloatingActionButton label="Ajouter" onClick={handleAddClick} />

      {/* Product Dialog */}
      {isProductDialogOpen && (
        <ProductFormDialog
          isOpen={isProductDialogOpen}
          onClose={() => {
            setIsProductDialogOpen(false);
            setEditingProduct(null);
          }}
          onSubmit={handleProductSubmit}
          product={editingProduct}
          markets={markets}
          suppliers={suppliers}
          categories={categories}
        />
      )}

      {/* Supplier Dialog */}
      {isSupplierDialogOpen && (
        <SupplierFormDialog
          isOpen={isSupplierDialogOpen}
          onClose={() => {
            setIsSupplierDialogOpen(false);
            setEditingSupplier(null);
          }}
          onSubmit={handleSupplierSubmit}
          supplier={editingSupplier}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, type: null, id: null })}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}