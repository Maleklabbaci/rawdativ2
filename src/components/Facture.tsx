import React, { useRef } from 'react';
import { Download, X, Printer } from 'lucide-react';
import html2pdf from 'html2pdf.js';
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

  const handleDownloadPDF = () => {
    if (!factureRef.current) return;

    const element = factureRef.current;
    const opt = {
      margin: 10,
      filename: `facture_${enfant.nom}_${paiement.moisConcerne}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    html2pdf().set(opt).from(element).save();
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

  const parentInfo = enfant.parents[0] || {};
  const invoiceNumber = `FAC-${paiement.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
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

        {/* Content */}
        <div ref={factureRef} className="p-8 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Logo & Title */}
          <div className="text-center mb-8 pb-6 border-b-2 border-indigo-600">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-black text-indigo-600">🏫</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">{t('invoice')}</h1>
            <p className="text-sm text-slate-500">{invoiceNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Creche Info */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('creche')}</h3>
              <div className="space-y-2">
                <p className="text-lg font-bold text-slate-900">{creche.nom}</p>
                <p className="text-sm text-slate-600">{creche.adresse}</p>
                {user?.nomCreche && <p className="text-sm text-slate-600 font-semibold">{user.nomCreche}</p>}
              </div>
            </div>

            {/* Invoice Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('invoice')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('number')}:</span>
                  <span className="font-semibold text-slate-900">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('date')}:</span>
                  <span className="font-semibold text-slate-900">{invoiceDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Child & Parent Info */}
          <div className="grid grid-cols-2 gap-8 mb-8 p-6 bg-slate-50 rounded-xl">
            {/* Enfant */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('child')}</h3>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {enfant.prenom} {enfant.nom}
                </p>
                <p className="text-slate-600">
                  {enfant.dateNaissance} • {enfant.genre}
                </p>
              </div>
            </div>

            {/* Parent */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('parent')}</h3>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {parentInfo.prenom} {parentInfo.nom}
                </p>
                <p className="text-slate-600">{parentInfo.telephone}</p>
                {parentInfo.email && <p className="text-slate-600">{parentInfo.email}</p>}
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('description')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('month')}</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-4 text-slate-900 font-medium">{t('monthlyFee')}</td>
                <td className="px-4 py-4 text-slate-600">{paiement.moisConcerne}</td>
                <td className="px-4 py-4 text-right">
                  <span className="font-bold text-lg text-indigo-600">
                    {paiement.montant.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR')} DA
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
                  {paiement.montant.toLocaleString(language === 'ar' ? 'ar-DZ' : 'fr-FR')} DA
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
              <p className="text-xs text-slate-600 mt-2 font-semibold">{creche.nom}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase mb-12">{t('signature')}</p>
              <div className="h-20 border-b border-slate-400"></div>
              <p className="text-xs text-slate-600 mt-2 font-semibold">{parentInfo.nom}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-500">
            <p>© {new Date().getFullYear()} RAWDATI - Plateforme de Gestion des Crèches</p>
            <p className="mt-1">Generated on {invoiceDate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
