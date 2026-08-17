import { useRef, useState } from 'react';
import { Download, X, Printer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement, Enfant, Parent } from '../types';

interface FactureProps {
  paiement: Paiement;
  enfant: Enfant;
  onClose: () => void;
}

type ReceiptStyle = 'premium' | 'kids' | 'pastel';

type ReceiptTheme = {
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  pageBackground: string;
  paper: string;
  headerBackground: string;
  headerText: string;
  headerMuted: string;
  panelBackground: string;
  paymentBackground: string;
  amountBackground: string;
  ink: string;
};

export default function Facture({ paiement, enfant, onClose }: FactureProps) {
  const { language } = useLanguage();
  const { creche } = useAuth();
  const factureRef = useRef<HTMLDivElement>(null);
  const isArabic = language === 'ar';
  const [receiptStyle, setReceiptStyle] = useState<ReceiptStyle>('kids');

  const receiptThemes: Record<ReceiptStyle, ReceiptTheme> = {
    premium: {
      label: 'Bleu nuit premium',
      primary: '#1d2f5f',
      secondary: '#d5ad62',
      accent: '#e9c978',
      border: '#d8c18a',
      pageBackground: '#fffaf0',
      paper: '#fffdf7',
      headerBackground: 'linear-gradient(135deg, #17264d 0%, #263d78 100%)',
      headerText: '#fffaf0',
      headerMuted: '#f2dfab',
      panelBackground: '#fffaf0',
      paymentBackground: '#fff0f0',
      amountBackground: '#fffaf0',
      ink: '#1d2f5f',
    },
    kids: {
      label: 'Jardin d’enfants',
      primary: '#10a9b7',
      secondary: '#f56b59',
      accent: '#ffd34f',
      border: '#9cdee0',
      pageBackground: '#fffdf8',
      paper: '#ffffff',
      headerBackground: 'linear-gradient(135deg, #effdfd 0%, #fff8ee 100%)',
      headerText: '#12304f',
      headerMuted: '#456276',
      panelBackground: '#f3fcfc',
      paymentBackground: '#fff7e5',
      amountBackground: 'linear-gradient(90deg, #fff7df 0%, #ffffff 48%, #eafff3 100%)',
      ink: '#12304f',
    },
    pastel: {
      label: 'Pastel doux',
      primary: '#51ae8d',
      secondary: '#9a86c5',
      accent: '#d7b9e6',
      border: '#b9ddd4',
      pageBackground: '#f7fbff',
      paper: '#ffffff',
      headerBackground: 'linear-gradient(135deg, #eaf7ff 0%, #f3efff 100%)',
      headerText: '#38566a',
      headerMuted: '#617789',
      panelBackground: '#fbfffd',
      paymentBackground: '#f5fbf8',
      amountBackground: 'linear-gradient(90deg, #f1faf7 0%, #ffffff 50%, #f6f0ff 100%)',
      ink: '#38566a',
    },
  };
  const theme = receiptThemes[receiptStyle];
  const receiptStyleOptions: Array<{ id: ReceiptStyle; name: string; color: string }> = [
    { id: 'premium', name: 'Bleu nuit', color: '#1d2f5f' },
    { id: 'kids', name: 'Jardin d’enfants', color: '#10a9b7' },
    { id: 'pastel', name: 'Pastel doux', color: '#51ae8d' },
  ];

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
    const cssVars = `--primary:${theme.primary};--secondary:${theme.secondary};--accent:${theme.accent};--border:${theme.border};--page-bg:${theme.pageBackground};--paper:${theme.paper};--header-bg:${theme.headerBackground};--header-text:${theme.headerText};--header-muted:${theme.headerMuted};--panel-bg:${theme.panelBackground};--payment-bg:${theme.paymentBackground};--amount-bg:${theme.amountBackground};--ink:${theme.ink};`;

    return `
<!DOCTYPE html>
<html dir="${dir}" lang="${isArabic ? 'ar' : 'fr'}">
<head>
<meta charset="UTF-8">
<title>${t('invoice')} - ${invoiceNumber}</title>
<style>
  :root { ${cssVars} }
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${isArabic ? "'Amiri', Arial, sans-serif" : "'Inter', Arial, sans-serif"};
    background: var(--page-bg);
    padding: 8px;
    color: var(--ink);
  }
  .card {
    width: 100%;
    max-width: 1160px;
    min-height: 100%;
    margin: 0 auto;
    background: var(--paper);
    border-radius: 18px;
    box-shadow: 0 6px 28px rgba(30,41,59,0.10);
    padding: 18px 26px;
    border-top: 6px solid var(--primary);
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
  .brand-row { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 12px 16px; margin-bottom: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--header-bg); }
  .brand-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand-copy { min-width: 0; }
  .brand-kicker { font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--secondary); }
  .brand-name { font-size: 18px; font-weight: 900; color: var(--header-text); margin-top: 2px; }
  .brand-address { font-size: 10px; color: var(--header-muted); margin-top: 2px; }
  .meta-card { min-width: 210px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.92); box-shadow: 0 2px 8px rgba(79,70,229,.08); }
  .meta-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; color: var(--primary); margin-bottom: 7px; }
  .compact-grid { gap: 14px; margin-bottom: 12px; }
  .section-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; background: var(--panel-bg); }
  .payment-card { border-color: var(--secondary); background: var(--payment-bg); }
  .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--primary); margin-bottom: 8px; }
  .payment-card .section-title { color: var(--secondary); }
  .detail-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1px solid var(--border); padding: 4px 0; font-size: 10px; }
  .detail-row:last-child { border-bottom: 0; }
  .detail-row span { color: #64748b; }
  .detail-row strong { color: var(--ink); text-align: right; }
  .amount-strip { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 10px 14px; margin: 12px 0; border-radius: 12px; background: var(--amount-bg); border: 1px solid var(--border); }
  .thanks { font-size: 11px; font-weight: 700; color: #475569; }
  .received-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .07em; }
  .received-value { font-size: 18px; font-weight: 900; color: var(--primary); margin-top: 2px; }
  .signature-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.88); }
  .signature-card .sign-label { margin-bottom: 16px; }
  @page { size: A4 landscape; margin: 5mm; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand-row">
      <div class="brand-left">
        <div class="logo-circle">${creche?.logoUrl ? `<img src="${creche.logoUrl}" alt="Logo" />` : '<img src="/favicon.png" alt="Logo Rawdha+" />'}</div>
        <div class="brand-copy">
          <div class="brand-kicker">Rawdha+ • Crèche & maternelle</div>
          <div class="brand-name">${creche?.nom || 'Rawdha+'}</div>
          <div class="brand-address">${creche?.adresse || 'Adresse de l’établissement'}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-title">${isArabic ? 'إيصال الدفع' : 'Reçu de paiement'}</div>
        <div class="row-between"><span>${t('number')}:</span><span>${invoiceNumber}</span></div>
        <div class="row-between"><span>${t('date')}:</span><span>${invoiceDate}</span></div>
      </div>
    </div>

    <div class="grid2 compact-grid">
      <div class="section-card">
        <div class="section-title">${isArabic ? 'معلومات الطفل' : 'Informations de l’enfant'}</div>
        <div class="detail-row"><span>Nom et prénom</span><strong>${enfant?.prenom || ''} ${enfant?.nom || ''}</strong></div>
        <div class="detail-row"><span>Parent / tuteur</span><strong>${parentInfo?.prenom || ''} ${parentInfo?.nom || ''}</strong></div>
        <div class="detail-row"><span>Date de naissance</span><strong>${enfant?.dateNaissance || '—'}</strong></div>
      </div>
      <div class="section-card payment-card">
        <div class="section-title">${isArabic ? 'تفاصيل الدفع' : 'Détails du règlement'}</div>
        <div class="detail-row"><span>${t('paymentMethod')}</span><strong>${paiement?.moyenPaiement || 'Espèces'}</strong></div>
        <div class="detail-row"><span>${t('month')}</span><strong>${paiement?.moisConcerne || '—'}</strong></div>
        <div class="detail-row"><span>${isArabic ? 'الحالة' : 'Statut'}</span><strong>${getStatusLabel()}</strong></div>
      </div>
    </div>

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

    <div class="amount-strip">
      <span class="thanks">Merci pour votre confiance</span>
      <div style="text-align:${isArabic ? 'left' : 'right'};">
        <div class="received-label">${isArabic ? 'المبلغ المستلم' : 'Montant reçu'}</div>
        <div class="received-value">${paiement?.montant?.toLocaleString() || '0'} DA</div>
      </div>
    </div>

    <div class="sign-block">
      <div class="signature-card">
        <div class="sign-label">${isArabic ? 'ختم وتوقيع الحضانة' : 'Cachet et signature de la crèche'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${creche?.nom || ''}</div>
      </div>
      <div class="signature-card">
        <div class="sign-label">${isArabic ? 'توقيع الولي' : 'Signature du parent'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${parentInfo?.prenom || ''} ${parentInfo?.nom || ''}</div>
      </div>
    </div>

    <div class="footer">© ${new Date().getFullYear()} RAWDHA+ - Plateforme de gestion de crèche</div>
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
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('invoice')}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-500">Choisir le style :</span>
              {receiptStyleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReceiptStyle(option.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${receiptStyle === option.id ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  {option.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('print')}
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t('download')}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Aperçu du reçu personnalisé — style crèche, synchronisé avec l’impression */}
        <div ref={factureRef} className="p-4 sm:p-6 print:p-0" style={{ fontFamily: 'Arial, sans-serif', background: theme.pageBackground }}>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-sm" style={{ background: theme.paper, borderColor: theme.border }}>
            <div className="px-5 py-5 sm:px-8" style={{ background: theme.headerBackground }}>

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-sky-100">
                    {creche?.logoUrl ? (
                      <img src={creche.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <img src="/favicon.png" alt="Logo Rawdha+" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>Rawdha+ • Crèche & maternelle</p>
                    <h1 className="mt-1 text-2xl font-black sm:text-3xl" style={{ color: theme.headerText }}>{creche?.nom || 'Rawdha+'}</h1>
                    <p className="mt-1 text-sm" style={{ color: theme.headerMuted }}>{creche?.adresse || 'Adresse de l’établissement'}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/90 px-5 py-4 text-left shadow-sm sm:min-w-[245px]" style={{ boxShadow: `0 0 0 1px ${theme.border}` }}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: theme.primary }}>{isArabic ? 'إيصال الدفع' : 'Reçu de paiement'}</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{invoiceNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">{invoiceDate}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-8">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border p-5" style={{ borderColor: theme.border, background: theme.panelBackground }}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">🧒</span>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: theme.primary }}>{isArabic ? 'معلومات الطفل' : 'Informations de l’enfant'}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3 border-b border-sky-100 pb-2"><span className="text-slate-500">Nom et prénom</span><strong className="text-right text-slate-900">{enfant?.prenom} {enfant?.nom}</strong></div>
                    <div className="flex justify-between gap-3 border-b border-sky-100 pb-2"><span className="text-slate-500">Parent / tuteur</span><strong className="text-right text-slate-900">{parentInfo?.prenom} {parentInfo?.nom}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Date de naissance</span><strong className="text-right text-slate-900">{enfant?.dateNaissance || '—'}</strong></div>
                  </div>
                </div>

                <div className="rounded-2xl border p-5" style={{ borderColor: theme.secondary, background: theme.paymentBackground }}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">💳</span>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: theme.secondary }}>{isArabic ? 'تفاصيل الدفع' : 'Détails du règlement'}</h3>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('paymentMethod')}</p>
                      <p className="mt-1 font-bold text-slate-900">{paiement?.moyenPaiement || 'Espèces'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('totalAmount')}</p>
                      <p className="mt-1 text-3xl font-black" style={{ color: theme.primary }}>{paiement?.montant?.toLocaleString() || '0'} <span className="text-base">DA</span></p>
                    </div>
                  </div>
                  <div className={`mt-4 rounded-xl px-4 py-2 text-center text-xs font-black uppercase tracking-widest ${getStatusColor()}`}>{getStatusLabel()}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.border }}>
                <div className="grid grid-cols-[1fr_0.7fr_0.7fr] px-4 py-3 text-xs font-black uppercase tracking-wide text-white sm:px-5" style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }}>
                  <span>{t('description')}</span><span>{t('month')}</span><span className="text-right">{t('amount')}</span>
                </div>
                <div className="grid grid-cols-[1fr_0.7fr_0.7fr] items-center px-4 py-4 text-sm sm:px-5">
                  <strong className="text-slate-900">{t('monthlyFee')}</strong><span className="text-slate-600">{paiement?.moisConcerne || '—'}</span>                  <strong className="text-right" style={{ color: theme.primary }}>{paiement?.montant?.toLocaleString() || '0'} DA</strong>
                </div>
              </div>

              <div className="flex items-center justify-between gap-5 rounded-2xl p-4 sm:px-6" style={{ background: theme.amountBackground, boxShadow: `0 0 0 1px ${theme.border}` }}>
                <p className="text-sm font-semibold text-slate-600">Merci pour votre confiance</p>
                <div className="text-right"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Montant reçu</p><p className="text-2xl font-black" style={{ color: theme.primary }}>{paiement?.montant?.toLocaleString() || '0'} DA</p></div>
              </div>

              <div className="grid gap-5 border-t border-dashed border-slate-300 pt-5 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{isArabic ? 'ختم وتوقيع الحضانة' : 'Cachet et signature de la crèche'}</p><div className="mt-10 border-b border-slate-400"></div><p className="mt-2 text-xs font-semibold text-slate-500">{creche?.nom}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{isArabic ? 'توقيع الولي' : 'Signature du parent'}</p><div className="mt-10 border-b border-slate-400"></div><p className="mt-2 text-xs font-semibold text-slate-500">{parentInfo?.prenom} {parentInfo?.nom}</p></div>
              </div>

              <p className="text-center text-xs" style={{ color: theme.headerMuted }}>© {new Date().getFullYear()} RAWDHA+ — Plateforme de gestion de crèche</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
