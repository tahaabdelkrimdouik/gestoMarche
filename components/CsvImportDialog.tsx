import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Upload, FileText } from 'lucide-react';
import type { Market, Supplier, Category } from '@/lib/types';
import { notify } from '@/lib/utils/notify';

interface CsvImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (products: any[]) => Promise<void>;
  markets: Market[];
  suppliers: Supplier[];
  categories: Category[];
}

interface ImportResult {
  success: number;
  errors: number;
  total: number;
}

const CsvImportDialog: React.FC<CsvImportDialogProps> = ({
  isOpen,
  onClose,
  onImport,
  markets,
  suppliers,
  categories,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      parseCsvPreview(file);
    } else {
      notify.error('Veuillez sélectionner un fichier CSV valide');
    }
  };

  const parseCsvPreview = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreviewData(results.data.slice(0, 5)); // Show first 5 rows
      },
      error: () => {
        notify.error('Erreur lors de la lecture du fichier CSV');
      },
    });
  };


  const processImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const results = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const processedData = results.data
              .filter((row: any) => row.name && row.category) // Must have name and category
              .map((row: any) => {
                // Map string values to UUIDs
                const category = categories.find(c => c.name.toLowerCase() === row.category?.toLowerCase());
                const supplier = suppliers.find(s => s.name.toLowerCase() === row.supplier?.toLowerCase());
                const market = markets.find(m => m.name.toLowerCase() === row.market?.toLowerCase());

                if (!category) {
                  console.warn(`Category "${row.category}" not found for product "${row.name}"`);
                  return null;
                }

                return {
                  name: row.name?.trim(),
                  code: row.code?.trim() || null,
                  category_id: category.id,
                  supplier_id: supplier?.id || null,
                  market_id: market?.id || null,
                  purchase_price: row.purchase_price ? parseFloat(row.purchase_price) : null,
                  sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
                  status: ['available', 'low', 'out'].includes(row.status) ? row.status : 'available',
                };
              })
              .filter(Boolean); // Remove null entries

            resolve(processedData);
          },
          error: reject,
        });
      });

      if (results.length === 0) {
        notify.error('Aucun produit valide trouvé dans le fichier CSV');
        return;
      }

      await onImport(results);

      setImportResult({
        success: results.length,
        errors: previewData.length - results.length,
        total: previewData.length,
      });

      notify.success(`${results.length} produit(s) importé(s) avec succès`);

      // Reset form
      setSelectedFile(null);
      setPreviewData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Import error:', error);
      notify.error('Erreur lors de l\'importation');
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setImportResult(null);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      resetDialog();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importer des produits depuis CSV
          </DialogTitle>
          <DialogDescription>
            Téléchargez un fichier CSV pour importer plusieurs produits en une fois.
            Assurez-vous que les catégories, fournisseurs et marchés correspondent exactement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">


          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Fichier CSV</Label>
            <Input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isImporting}
              className="cursor-pointer"
            />
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Aperçu des données (5 premières lignes)</Label>
              <div className="bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-700">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Import terminé: {importResult.success} produit(s) importé(s)
                {importResult.errors > 0 && `, ${importResult.errors} erreur(s)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Importation en cours...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isImporting}
            >
              Annuler
            </Button>
            <Button
              onClick={processImport}
              disabled={!selectedFile || isImporting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Importer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CsvImportDialog;
