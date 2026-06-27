import React, { useRef } from 'react';
import { Download, X, Printer } from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement, Enfant } from '../types';

// Register fonts for pdfMake
pdfMake.vfs = pdfFonts.pdfMake.vfs;

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
    return translations[language][key] || translations.fr[key];
  };

  const getStatusColor = () => {
    if (paiement.statut === 'Payé') return 'text-green-600 bg-green-50';
    if (paiement.statut === 'En attente') return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  const getStatusLabel = () => {
    if (paiement.statut === 'Payé') return t('paid');
    if (paiement.statut === 'En attente') return t('pending');
    return t('late');
  };

  const parentInfo = enfant.parents[0] || {};
  const invoiceNumber = `FAC-${paiement.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR');

  const handleDownloadPDF = () => {
    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Roboto' },
      content: [
        { text: t('invoice'), fontSize: 28, bold: true, alignment: 'center', marginBottom: 5 },
        { text: invoiceNumber, fontSize: 12, alignment: 'center', color: '#666', marginBottom: 20 },
        {
          columns: [
            { text: t('creche') + '\n' + creche.nom + '\n' + creche.adresse, fontSize: 10 },
            { text: t('number') + ': ' + invoiceNumber + '\n' + t('date') + ': ' + invoiceDate, fontSize: 10, alignment: 'right' },
          ],
          marginBottom: 20,
        },
        {
          table: {
            widths: ['50%', '50%'],
            body: [
              [
                { text: t('child') + ': ' + enfant.prenom + ' ' + enfant.nom, fontSize: 10 },
                { text: t('parent') + ': ' + parentInfo.prenom + ' ' + parentInfo.nom, fontSize: 10 },
              ],
            ],
          },
          marginBottom: 20,
        },
        {
          table: {
            headerRows: 1,
            widths: ['50%', '25%', '25%'],
            body: [
              [
                { text: t('description'), bold: true, color: '#fff', fillColor: '#4f46e5' },
                { text: t('month'), bold: true, color: '#fff', fillColor: '#4f46e5' },
                { text: t('amount'), bold: true, color: '#fff', fillColor: '#4f46e5', alignment: 'right' },
              ],
              [t('monthlyFee'), paiement.moisConcerne, { text: paiement.montant + ' DA', alignment: 'right', bold: true }],
            ],
          },
          marginBottom: 20,
        },
        { text: t('totalAmount') + ': ' + paiement.montant + ' DA', fontSize: 12, bold: true, marginBottom: 10 },
        { text: paiement.statut, fontSize: 11, bold: true, alignment: 'center', marginBottom: 20 },
        { text: t('signature') + '________ ' + creche.nom, fontSize: 9, marginBottom: 10 },
        { text: t('signature') + '________ ' + parentInfo.nom, fontSize: 9 },
      ],
    };

    pdfMake.createPdf(docDefinition).download(`facture_${enfant.nom}_${paiement.moisConcerne}.pdf`);
  };

  const handlePrint = () => {
    if (!factureRef.current) return;
    const printWindow = window.open('', '', 'height=800,width=900');
    if (printWindow) {
      printWindow.document.write(factureRef.current.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">{t('invoice')}</h2>
          <div className="flex gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition font-semibold text-sm cursor-pointer">
              <Printer className="w-4 h-4" /> {t('print')}
            </button>
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition font-semibold text-sm cursor-pointer">
              <Download className="w-4 h-4" /> {t('download')}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>
        <div ref={factureRef} className="p-8 bg-white">
          <div className="text-center mb-8 pb-6 border-b-2 border-indigo-600">
            <h1 className="text-3xl font-black text-slate-900 mb-1">{t('invoice')}</h1>
            <p className="text-sm text-slate-500">{invoiceNumber}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('creche')}</h3>
              <p className="text-lg font-bold text-slate-900">{creche.nom}</p>
              <p className="text-sm text-slate-600">{creche.adresse}</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('invoice')}</h3>
              <div className="flex justify-between text-sm"><span>{t('number')}:</span><span className="font-semibold">{invoiceNumber}</span></div>
              <div className="flex justify-between text-sm"><span>{t('date')}:</span><span className="font-semibold">{invoiceDate}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8 p-6 bg-slate-50 rounded-xl">
            <div><h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('child')}</h3><p className="font-semibold">{enfant.prenom} {enfant.nom}</p></div>
            <div><h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('parent')}</h3><p className="font-semibold">{parentInfo.prenom} {parentInfo.nom}</p><p className="text-sm text-slate-600">{parentInfo.telephone}</p></div>
          </div>
          <table className="w-full mb-8"><thead><tr className="bg-indigo-600 text-white"><th className="px-4 py-3 text-left text-sm font-semibold">{t('description')}</th><th className="px-4 py-3 text-left text-sm font-semibold">{t('month')}</th><th className="px-4 py-3 text-right text-sm font-semibold">{t('amount')}</th></tr></thead><tbody><tr className="border-b"><td className="px-4 py-4">{t('monthlyFee')}</td><td className="px-4 py-4">{paiement.moisConcerne}</td><td className="px-4 py-4 text-right font-bold text-indigo-600">{paiement.montant} DA</td></tr></tbody></table>
          <div className="grid grid-cols-2 gap-8 mb-8"><div></div><div><div className="flex justify-between p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200"><span className="font-bold">{t('totalAmount')}:</span><span className="text-2xl font-black text-indigo-600">{paiement.montant} DA</span></div></div></div>
          <div className={`px-4 py-3 rounded-lg text-sm font-bold text-center mb-8 ${getStatusColor()}`}>{getStatusLabel()}</div>
          <div className="border-t-2 border-slate-300 pt-8 grid grid-cols-2 gap-8"><div><p className="text-xs text-slate-500 font-semibold uppercase mb-12">{t('signature')}</p><div className="h-20 border-b border-slate-400"></div></div><div><p className="text-xs text-slate-500 font-semibold uppercase mb-12">{t('signature')}</p><div className="h-20 border-b border-slate-400"></div></div></div>
        </div>
      </div>
    </div>
  );
}
