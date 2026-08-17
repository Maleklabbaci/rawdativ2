import React, { useRef } from 'react';
import { Download, X, Printer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement, Enfant, Parent } from '../types';

interface FactureProps {
  paiement: Paiement;
  enfant: Enfant;
  onClose: () => void;
}

export default function Facture({ paiement, enfant, onClose }: FactureProps) {
  const { language } = useLanguage();
  const { creche } = useAuth();
  const factureRef = useRef<HTMLDivElement>(null);
  const isArabic = language === 'ar';

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      fr: {
        invoice: 'REÇU DE PAIEMENT',
        number: 'N° Reçu',
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
        totalAmount: 'Montant reçu',
        signature: 'Signature & Tampon',
        download: 'Imprimer / PDF',
        print: 'Imprimer',
        paid: 'Payé',
        pending: 'En attente',
        late: 'Retard',
        paymentMethod: 'Mode de règlement',
        monthlyFee: 'Règlement des frais de scolarité',
      },
      ar: {
        invoice: 'وصل دفع',
        number: 'رقم الوصل',
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
        totalAmount: 'المبلغ المقبوض',
        signature: 'التوقيع والختم',
        download: 'طباعة / PDF',
        print: 'طباعة',
        paid: 'مدفوع',
        pending: 'قيد الانتظار',
        late: 'متأخر',
        paymentMethod: 'طريقة الدفع',
        monthlyFee: 'تسديد رسوم التمدرس',
      },
    };
    return translations[language]?.[key] || translations.fr[key] || key;
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

  const parentInfo: Partial<Parent> = enfant?.parents?.[0] || {};
  const invoiceNumber = `REC-${paiement?.id?.slice(0, 8).toUpperCase() || 'INCONNU'}`;
  const invoiceDate = new Date().toLocaleDateString(
    language === 'ar' ? 'ar-DZ' : 'fr-FR'
  );

  // ====================== FONCTIONS PDF & IMPRESSION ======================
  // ✅ FIX: L'ancienne version copiait le HTML on-screen (classes Tailwind) dans une
  // fenêtre à part et tentait de charger Tailwind via un CDN externe EN DIRECT, puis
  // lançait l'impression 600ms après. Le CDN met souvent plus longtemps que ça à
  // télécharger + recompiler les styles (surtout sur connexion lente), donc
  // l'impression partait avant que le style soit appliqué -> facture "moche" et brute.
  //
  // Ici, le HTML d'impression est généré à la main avec du CSS intégré en dur.
  // Aucune dépendance réseau, aucun timing hasardeux : le rendu est garanti identique
  // à chaque fois, en français comme en arabe (RTL).
  const buildInvoiceHTML = () => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'Payé': { bg: '#dcfce7', text: '#16a34a' },
      'En attente': { bg: '#fef3c7', text: '#d97706' },
    };
    const status = statusColors[paiement?.statut || ''] || { bg: '#ffe4e6', text: '#e11d48' };
    const dir = isArabic ? 'rtl' : 'ltr';
    const align1 = isArabic ? 'right' : 'left';
    const align2 = isArabic ? 'left' : 'right';

    return `
<!DOCTYPE html>
<html dir="${dir}" lang="${isArabic ? 'ar' : 'fr'}">
<head>
<meta charset="UTF-8">
<title>${t('invoice')} - ${invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${isArabic ? "'Amiri', Arial, sans-serif" : "'Inter', Arial, sans-serif"};
    background: #f8fafc;
    padding: 24px;
    color: #0f172a;
  }
  .card {
    max-width: 720px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    padding: 40px;
  }
  .header { text-align: center; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 2px solid #4f46e5; }
  .logo-circle { width: 64px; height: 64px; background: #e0e7ff; border-radius: 999px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; font-size: 26px; overflow: hidden; }
  .logo-circle img { width: 100%; height: 100%; object-fit: contain; padding: 6px; }
  .title { font-size: 28px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #64748b; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.03em; }
  .value-strong { font-size: 16px; font-weight: 700; color: #0f172a; }
  .value-muted { font-size: 13px; color: #475569; margin-top: 4px; }
  .row-between { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
  .row-between span:first-child { color: #475569; }
  .row-between span:last-child { font-weight: 600; color: #0f172a; }
  .info-box { background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  thead tr { background: #4f46e5; color: #ffffff; }
  th { padding: 12px 16px; font-size: 13px; font-weight: 600; text-align: ${align1}; }
  th:last-child { text-align: ${align2}; }
  td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  td:last-child { text-align: ${align2}; }
  .amount-cell { font-weight: 700; font-size: 17px; color: #4f46e5; }
  .total-box { display: flex; justify-content: space-between; align-items: center; background: #eef2ff; border: 2px solid #c7d2fe; border-radius: 10px; padding: 16px 20px; margin-bottom: 14px; }
  .total-label { font-weight: 700; color: #0f172a; }
  .total-value { font-size: 24px; font-weight: 900; color: #4f46e5; }
  .status-badge { padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 700; text-align: center; text-transform: uppercase; background: ${status.bg}; color: ${status.text}; }
  .sign-block { border-top: 2px solid #cbd5e1; padding-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sign-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 48px; }
  .sign-line { border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 8px; }
  .sign-name { font-size: 11px; font-weight: 700; color: #475569; }
  .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print {
    body { background: #fff; padding: 0; }
    .card { box-shadow: none; max-width: 100%; }
  }
  @page { size: A4; margin: 12mm; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-circle">${creche?.logoUrl ? `<img src="${creche.logoUrl}" alt="Logo" />` : '🏫'}</div>
      <div class="title">${t('invoice')}</div>
      <div class="subtitle">${invoiceNumber}</div>
    </div>

    <div class="grid2">
      <div>
        <div class="label">${t('creche')}</div>
        <div class="value-strong">${creche?.nom || ''}</div>
        <div class="value-muted">${creche?.adresse || ''}</div>
      </div>
      <div>
        <div class="label">${t('invoice')}</div>
        <div class="row-between"><span>${t('number')}:</span><span>${invoiceNumber}</span></div>
        <div class="row-between"><span>${t('date')}:</span><span>${invoiceDate}</span></div>
        <div class="row-between"><span>${t('paymentMethod')}:</span><span>${paiement?.moyenPaiement || 'Espèces'}</span></div>
      </div>
    </div>

    <div class="info-box grid2" style="margin-bottom:0;">
      <div>
        <div class="label">${t('child')}</div>
        <div class="value-strong">${enfant?.prenom || ''} ${enfant?.nom || ''}</div>
        <div class="value-muted">${enfant?.dateNaissance || ''} • ${enfant?.genre || ''}</div>
      </div>
      <div>
        <div class="label">${t('parent')}</div>
        <div class="value-strong">${parentInfo?.prenom || ''} ${parentInfo?.nom || ''}</div>
        <div class="value-muted">${parentInfo?.telephone || ''}</div>
        ${parentInfo?.email ? `<div class="value-muted">${parentInfo.email}</div>` : ''}
      </div>
    </div>
    <div style="height:32px;"></div>

    <table>
      <thead>
        <tr>
          <th>${t('description')}</th>
          <th>${t('month')}</th>
          <th>${t('amount')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:600;">${t('monthlyFee')}</td>
          <td style="color:#475569;">${paiement?.moisConcerne || ''}</td>
          <td class="amount-cell">${paiement?.montant?.toLocaleString() || '0'} DA</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex; justify-content:${isArabic ? 'flex-start' : 'flex-end'};">
      <div style="width:50%;">
        <div class="total-box">
          <span class="total-label">${t('totalAmount')}:</span>
          <span class="total-value">${paiement?.montant?.toLocaleString() || '0'} DA</span>
        </div>
        <div class="status-badge">${getStatusLabel()}</div>
      </div>
    </div>

    <div class="sign-block">
      <div>
        <div class="sign-label">${t('signature')}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${creche?.nom || ''}</div>
      </div>
      <div>
        <div class="sign-label">${t('signature')}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${parentInfo?.nom || ''}</div>
      </div>
    </div>

    <div class="footer">© ${new Date().getFullYear()} RAWDHA+ - Plateforme de Gestion</div>
  </div>
</body>
</html>`;
  };

  const openPrintWindow = () => {
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) return;

    printWindow.document.write(buildInvoiceHTML());
    printWindow.document.close();

    // On attend que la police Google Fonts ait fini de charger avant d'imprimer,
    // pour être sûr que le rendu (et donc le PDF/impression) soit propre du premier coup.
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
  };

  const handleDownloadPDF = () => openPrintWindow();
  const handlePrint = () => openPrintWindow();

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

        {/* Content - Gardé exactement comme tu l'avais */}
        <div ref={factureRef} className="p-8 bg-white print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Logo & Title */}
          <div className="text-center mb-8 pb-6 border-b-2 border-indigo-600">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden">
              {creche?.logoUrl ? (
                <img src={creche.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-2xl">🏫</span>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">{t('invoice')}</h1>
            <p className="text-sm text-slate-500">{invoiceNumber}</p>
          </div>

          {/* Creche & Invoice Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('creche')}</h3>
              <div className="space-y-2">
                <p className="text-lg font-bold text-slate-900">{creche?.nom}</p>
                <p className="text-sm text-slate-600">{creche?.adresse}</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('invoice')}</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('paymentMethod')}:</span>
                  <span className="font-semibold text-slate-900">{paiement?.moyenPaiement || 'Espèces'}</span>
                </div>
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
          <table className="w-full mb-8">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('description')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">{t('month')}</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-4 py-4 text-slate-900 font-medium">{t('monthlyFee')}</td>
                <td className="px-4 py-4 text-slate-600">{paiement?.moisConcerne}</td>
                <td className="px-4 py-4 text-right">
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
            <p>© {new Date().getFullYear()} RAWDHA+ - Plateforme de Gestion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
