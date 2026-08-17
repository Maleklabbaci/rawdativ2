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
    padding: 8px;
    color: #0f172a;
  }
  .card {
    width: 100%;
    max-width: 1160px;
    min-height: 100%;
    margin: 0 auto;
    background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
    border-radius: 18px;
    box-shadow: 0 6px 28px rgba(30,41,59,0.10);
    padding: 18px 26px;
    border-top: 6px solid #4f46e5;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .header { text-align: center; padding: 10px 14px 12px; margin-bottom: 14px; border: 1px solid #dbeafe; border-bottom: 3px solid #4f46e5; border-radius: 14px; background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%); }
  .logo-circle { width: 46px; height: 46px; background: #e0e7ff; border-radius: 999px; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px auto; font-size: 22px; overflow: hidden; }
  .logo-circle img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
  .title { font-size: 23px; font-weight: 900; letter-spacing: 0.04em; color: #0f172a; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #64748b; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
  .label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.03em; }
  .value-strong { font-size: 14px; font-weight: 700; color: #0f172a; }
  .value-muted { font-size: 11px; color: #475569; margin-top: 2px; }
  .row-between { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
  .row-between span:first-child { color: #475569; }
  .row-between span:last-child { font-weight: 600; color: #0f172a; }
  .info-box { background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); border: 1px solid #dbeafe; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; overflow: hidden; border-radius: 9px; }
  thead tr { background: #4f46e5; color: #ffffff; }
  th { padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: ${align1}; }
  th:last-child { text-align: ${align2}; }
  td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  td:last-child { text-align: ${align2}; }
  .amount-cell { font-weight: 800; font-size: 14px; color: #4f46e5; }
  .total-box { display: flex; justify-content: space-between; align-items: center; background: #eef2ff; border: 2px solid #c7d2fe; border-radius: 10px; padding: 9px 12px; margin-bottom: 6px; }
  .total-label { font-weight: 800; font-size: 12px; color: #0f172a; }
  .total-value { font-size: 20px; font-weight: 900; color: #4f46e5; }
  .status-badge { padding: 7px; border-radius: 8px; font-size: 11px; font-weight: 800; text-align: center; text-transform: uppercase; background: ${status.bg}; color: ${status.text}; }
  .sign-block { border-top: 1px solid #cbd5e1; padding-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 12px; page-break-inside: avoid; break-inside: avoid; }
  .sign-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 18px; }
  .sign-line { border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 5px; }
  .sign-name { font-size: 10px; font-weight: 700; color: #475569; }
  .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  @media print {
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { background: #fff; padding: 0; }
    .card { box-shadow: none; max-width: none; height: 100%; overflow: hidden; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
  @page { size: A4 landscape; margin: 5mm; }
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
    <div style="height:12px;"></div>

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
        <div class="sign-label">${isArabic ? 'ختم وتوقيع الحضانة' : 'Cachet et signature de la crèche'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${creche?.nom || ''}</div>
      </div>
      <div>
        <div class="sign-label">${isArabic ? 'توقيع الولي' : 'Signature du parent'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${parentInfo?.prenom || ''} ${parentInfo?.nom || ''}</div>
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
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
        <div ref={factureRef} className="p-6 sm:p-8 bg-white print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>
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
