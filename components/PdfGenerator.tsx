import jsPDF from 'jspdf';
import type { Supplier, Product } from '@/lib/types';

export const generatePurchaseOrderPDF = async (supplier: Supplier, products: Product[]) => {
  const pdf = new jsPDF();

  // Colors and styling
  const primaryColor = [46, 70, 229]; // Blue
  const secondaryColor = [107, 114, 128]; // Gray
  const accentColor = [220, 38, 38]; // Red for low stock

  // Header
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, 210, 30, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text('BON DE COMMANDE', 105, 20, { align: 'center' });

  // Date and order number
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  const currentDate = new Date().toLocaleDateString('fr-FR');
  const orderNumber = `CMD-${Date.now()}`;

  pdf.text(`Date: ${currentDate}`, 20, 45);
  pdf.text(`N° Commande: ${orderNumber}`, 20, 55);

  // Supplier information
  pdf.setFontSize(14);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('FOURNISSEUR', 20, 75);

  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text(supplier.name, 20, 85);
  if (supplier.phone_number) {
    pdf.text(`Téléphone: ${supplier.phone_number}`, 20, 95);
  }

  // Company information (placeholder)
  pdf.setFontSize(14);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('ENTREPRISE', 110, 75);

  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Mon Stock', 110, 85);
  pdf.text('123 Rue du Commerce', 110, 95);
  pdf.text('75001 Paris', 110, 105);

  // Products section
  pdf.setFontSize(14);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('PRODUITS À COMMANDER', 20, 125);

  // Table headers
  pdf.setFontSize(10);
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.text('Produit', 20, 140);
  pdf.text('Code', 120, 140);
  pdf.text('État', 150, 140);
  pdf.text('Prix HT', 180, 140);

  // Draw header line
  pdf.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.line(20, 142, 190, 142);

  let yPosition = 150;
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);

  products.forEach((product, index) => {
    // Check if we need a new page
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = 30;
    }

    // Product name
    const nameLines = pdf.splitTextToSize(product.name, 90);
    pdf.text(nameLines, 20, yPosition);

    // Product code
    pdf.text(product.code || 'N/A', 120, yPosition);

    // Status with color
    const statusText = product.status === 'out' ? 'Épuisé' : 'Presque fini';
    if (product.status === 'out') {
      pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    } else {
      pdf.setTextColor(255, 165, 0);
    }
    pdf.text(statusText, 150, yPosition);
    pdf.setTextColor(0, 0, 0);

    // Price
    const price = product.purchase_price ? `${product.purchase_price.toFixed(2)} €` : 'N/A';
    pdf.text(price, 180, yPosition);

    yPosition += 8;
  });

  // Totals section
  yPosition += 10;
  pdf.setFontSize(12);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('RÉCAPITULATIF', 20, yPosition);

  const totalHT = products.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
  const tva = totalHT * 0.20; // TVA 20%
  const totalTTC = totalHT + tva;

  yPosition += 15;
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Total HT: ${totalHT.toFixed(2)} €`, 20, yPosition);
  pdf.text(`TVA (20%): ${tva.toFixed(2)} €`, 20, yPosition + 8);
  pdf.text(`Total TTC: ${totalTTC.toFixed(2)} €`, 20, yPosition + 16);

  // Signature lines
  yPosition += 40;
  pdf.text('Signature client:', 20, yPosition);
  pdf.text('Signature fournisseur:', 120, yPosition);

  // Draw signature lines
  pdf.line(20, yPosition + 15, 80, yPosition + 15);
  pdf.line(120, yPosition + 15, 180, yPosition + 15);

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  pdf.text('Merci pour votre service !', 105, 280, { align: 'center' });

  return {
    success: true,
    documentType: 'Bon de Commande',
    supplier: supplier.name,
    date: currentDate,
    orderNumber,
    products: products.map(p => ({
      name: p.name,
      code: p.code,
      status: p.status,
      purchase_price: p.purchase_price,
    })),
    totals: {
      totalHT: totalHT.toFixed(2),
      tva: tva.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
    },
    pdfBlob: pdf.output('blob'),
    pdfDataUrl: pdf.output('datauristring'),
  };
};

export const downloadPDF = (pdfData: any) => {
  const blob = pdfData.pdfBlob;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pdfData.documentType}-${pdfData.supplier.replace(/\s+/g, '-')}-${pdfData.orderNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return true;
};

export const sharePDF = async (pdfData: any) => {
  if (navigator.share && navigator.canShare && typeof navigator.canShare === 'function') {
    try {
      const file = new File([pdfData.pdfBlob], `${pdfData.documentType}-${pdfData.supplier}-${pdfData.orderNumber}.pdf`, {
        type: 'application/pdf',
      });

      await navigator.share({
        title: `Bon de commande - ${pdfData.supplier}`,
        text: `Commande ${pdfData.orderNumber} pour ${pdfData.supplier}`,
        files: [file],
      });
      return true;
    } catch (error) {
      console.log('Error sharing:', error);
      // Fallback to download
      return downloadPDF(pdfData);
    }
  } else {
    // Fallback to download on desktop
    return downloadPDF(pdfData);
  }
};