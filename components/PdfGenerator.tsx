/**
 * Simule la génération d'un PDF pour un bon de commande fournisseur
 * Dans une vraie app, vous utiliseriez une librairie comme jsPDF ou pdfmake
 */

export const generatePurchaseOrderPDF = (supplier, products, company = {}) => {
  const totalHT = products.reduce((sum, p) => sum + (p.prix_achat || 0), 0);
  const tva = totalHT * 0.20; // TVA 20%
  const totalTTC = totalHT + tva;

  const pdfContent = `
╔════════════════════════════════════════════════════════════╗
║                    BON DE COMMANDE                         ║
╚════════════════════════════════════════════════════════════╝

Date: ${new Date().toLocaleDateString('fr-FR')}
N° Commande: CMD-${Date.now()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FOURNISSEUR:
${supplier.name}
${supplier.phone || ''}
${supplier.email || ''}

ENTREPRISE:
${company.name || 'Mon Stock'}
${company.address || '123 Rue du Commerce'}
${company.phone || '+33 1 23 45 67 89'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUITS À COMMANDER:

${products.map((p, i) => `
  ${i + 1}. ${p.name}
     Catégorie: ${p.category || 'N/A'}
     État: ${p.status === 'out' ? '❌ Épuisé' : '⚠️ Presque fini'}
     Prix unitaire HT: ${(p.prix_achat || 0).toFixed(2)} €
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÉCAPITULATIF:

Total HT:           ${totalHT.toFixed(2)} €
TVA (20%):          ${tva.toFixed(2)} €
                    ─────────────────
Total TTC:          ${totalTTC.toFixed(2)} €

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Signature client:                    Signature fournisseur:




_________________                    _________________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Merci pour votre service !
  `;

  // Log to console (simulation)
  console.log(pdfContent);
  
  // Return formatted data that could be used by a real PDF library
  return {
    success: true,
    documentType: 'Bon de Commande',
    supplier: supplier.name,
    date: new Date().toLocaleDateString('fr-FR'),
    orderNumber: `CMD-${Date.now()}`,
    products: products.map(p => ({
      name: p.name,
      category: p.category,
      status: p.status,
      prix_achat: p.prix_achat,
    })),
    totals: {
      totalHT: totalHT.toFixed(2),
      tva: tva.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
    },
    pdfPreview: pdfContent,
  };
};

/**
 * Simule le téléchargement du PDF
 * Dans une vraie app, cela générerait et téléchargerait un fichier PDF
 */
export const downloadPDF = (pdfData) => {
  // Créer un blob de texte pour simuler un téléchargement
  const blob = new Blob([pdfData.pdfPreview], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pdfData.documentType}-${pdfData.supplier}-${pdfData.orderNumber}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  return true;
};