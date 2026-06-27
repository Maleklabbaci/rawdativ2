import React, { useRef } from 'react';
import { Download, X, Printer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement, Enfant } from '../types';

interface FactureProps {
  paiement: Paiement;
  enfant: Enfant;
  onClose: () => void;
}

export default function Facture({ paiement, enfant, onClose }: FactureProps) {
  const { language } = useLanguage();
  const { user, creche } = useAuth();
  const factureRef = useRef<HTMLDivElement>(null);
  const isArabic = language === 'ar';

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      fr: {
        invoice: 'FACTURE',
        number: 'N° Facture',
        date: 'Date',
        creche: 'Établissement',
        address: 'Adresse',
        child: 'Enfant',
        parent: 'Parent/Tuteur',
        phone: 'Téléphone',
        email: 'Email',
        description: 'Description',
        amount: 'Montant',
        status: 'Statut',
        month: 'Mois concerné',
        totalAmount: 'Montant Total',
        signature: 'Signature & Tampon',
        download: 'Télécharger PDF',
        print: 'Imprimer',
        paid: 'Payé',
        pending: 'En attente',
        late: 'Retard',
        monthlyFee: 'Frais mensuels de garderie',
      },
      ar: {
        invoice: 'الفاتورة',
        number: 'رقم الفاتورة',
        date: 'التاريخ',
        creche: 'المؤسسة',
        address: 'العنوان',
        child: 'الطفل',
        parent: 'الوالد/الوصي',
        phone: 'الهاتف',
        email: 'البريد الإلكتروني',
        description: 'الوصف',
        amount: 'المبلغ',
        status: 'الحالة',
        month: 'الشهر المعني',
        totalAmount: 'المبلغ الإجمالي',
        signature: 'التوقيع والختم',
        download: 'تحميل PDF',
        print: 'طباعة',
        paid: 'مدفوع',
        pending: 'قيد الانتظار',
        late: 'متأخر',
        monthlyFee: 'رسوم الحضانة الشهرية',
      },
    };
    return translations[language]?.[key] || translations.fr[key];
  };

  const getStatusColor = () => {
    if (paiement?.statut === 'Payé') return 'text-green-600 bg-green-50';
    if (paiement?.statut === 'En attente') return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getStatusLabel = () => {
    if (paiement?.statut === 'Payé') return t('paid');
    if (paiement?.statut === 'En attente') return t('pending');
    return t('late');
  };

  const parentInfo = enfant?.parents?.[0] || {};
  const invoiceNumber = `FAC-${paiement?.id?.slice(0, 8).toUpperCase() || 'INCONNU'}`;
  const invoiceDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR');

  // Fonction magique pour récupérer tous les styles Tailwind actifs de l'application
  const getAppStyles = () => {
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');
    return styles;
  };

  // Styles CSS supplémentaires pour forcer les couleurs de fond à l'impression
  const printStyles = `
    <style>
      @media print {
        body { 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
          background-color: white !important;
        }
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding: 24px !important;
        background-color: white !important;
      }
    </style>
  `;

  const handlePrint = () => {
    if (!factureRef.current) return;

    const printWindow = window.open('', '', 'height=850,width=900');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="${isArabic ? 'rtl' : 'ltr'}">
          <head>
            <meta charset="UTF-8">
            <title>${invoiceNumber}</title>
            ${getAppStyles()}
            ${printStyles}
          </head>
          <body class="bg-white">
            <div class="max-w-4xl mx-auto">
              ${factureRef.current.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      // Laisser un petit délai de 400ms pour charger les styles Tailwind avant d'imprimer
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 400);
    }
  };

  const handleDownloadPDF = () => {
    // Sur le web, le bouton "Télécharger PDF" déclenche généralement la boîte d'impression 
    // qui permet à l'utilisateur de faire "Enregistrer au format PDF". 
    // On réutilise la même fonction propre.
    handlePrint();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header (Masqué à l'impression) */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-slate-900">{t('invoice')}</h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition font-semibold text-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('print')}
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition font-semibold text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t('download')}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content (Le contenu de la facture qui sera imprimé) */}
        <div ref={factureRef} className="p-8 bg-white print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Logo & Title */}
          <div className="text-center mb-8 pb-6 border-b-2 border-indigo-600">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🏫</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">{t('invoice')}</h1>
            <p className="text-sm text-slate-500">{invoiceNumber}</p>
          </div>

          {/* Creche & Invoice Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className={isArabic ? 'text-right' : 'text-left'}>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('creche')}</h3>
              <div className="space-y-2">
                <p className="text-lg font-bold text-slate-900">{creche?.nom}</p>
                <p className="text-sm text-slate-600">{creche?.adresse}</p>
              </div>
            </div>
            <div className={isArabic ? 'text-left' : 'text-right'}>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('invoice')}</h3>
              <div className="space-y-2 text-sm inline-block w-full">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">{t('number')}:</span>
                  <span className="font-semibold text-slate-900">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">{t('date')}:</span>
                  <span className="font-semibold text-slate-900">{invoiceDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Child & Parent Info */}
          <div className="grid grid-cols-2 gap-8 mb-8 p-6 bg-slate-50 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('child')}</h3>
              <p className="font-semibold text-slate-900">{enfant?.prenom} {enfant?.nom}</p>
              <p className="text-sm text-slate-600">{enfant?.dateNaissance} • {enfant?.genre}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('parent')}</h3>
              <p className="font-semibold text-slate-900">{parentInfo?.prenom} {parentInfo?.nom}</p>
              <p className="text-sm text-slate-600">{parentInfo?.telephone}</p>
              {parentInfo?.email && <p className="text-sm text-slate-600">{parentInfo?.email}</p>}
            </div>
          </div>

          {/* Invoice Table */}
          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-4 py-3 text-start text-sm font-semibold">{t('description')}</th>
                <th className="px-4 py-3 text-start text-sm font-semibold">{t('month')}</th>
                <th className="px-4 py-3 text-end text-sm font-semibold">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-4 py-4 text-slate-900 font-medium">{t('monthlyFee')}</td>
                <td className="px-4 py-4 text-slate-600">{paiement?.moisConcerne}</td>
                <td className="px-4 py-4 text-end">
                  <span className="font-bold text-lg text-indigo-600">
                    {paiement?.montant?.toLocaleString() || '0'} DA
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Total & Status */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div></div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                <span className="font-bold text-slate-900">{t('totalAmount')}:</span>
                <span className="text-2xl font-black text-indigo-600">
                  {paiement?.montant?.toLocaleString() || '0'} DA
                </span>
              </div>
              <div className={`px-4 py-3 rounded-lg text-sm font-bold text-center ${getStatusColor()}`}>
                {getStatusLabel().toUpperCase()}
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="border-t-2 border-slate-300 pt-8 grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-12">{t('signature')}</p>
              <div className="h-20 border-b border-slate-400"></div>
              <p className="text-xs text-slate-600 mt-2 font-semibold">{creche?.nom}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-12">{t('signature')}</p>
              <div className="h-20 border-b border-slate-400"></div>
              <p className="text-xs text-slate-600 mt-2 font-semibold">{parentInfo?.nom}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} RAWDATI - Plateforme de Gestion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
