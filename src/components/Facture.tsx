import { formatPaymentMethodLabel, invoicePeriod, localizeInvoicePeriodText } from '../utils/financePeriod';
import { formatCurrency } from '../utils/format';
import { useEffect, useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement, Enfant, Parent } from '../types';

interface FactureProps {
  paiement: Paiement;
  enfant?: Enfant;
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

const resolveSafeLogoUrl = (raw?: string) => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '/rawdah-logo.png';
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) {
    return trimmed;
  }
  return '/rawdah-logo.png';
};

export default function Facture({ paiement, enfant, onClose }: FactureProps) {
  const { language } = useLanguage();
  const { creche } = useAuth();
  const factureRef = useRef<HTMLDivElement>(null);
  const isArabic = language === 'ar';
  const [printError, setPrintError] = useState(false);
  const [receiptStyle, setReceiptStyle] = useState<ReceiptStyle>('kids');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    { id: 'premium', name: isArabic ? 'الأزرق الليلي' : 'Bleu nuit', color: '#1d2f5f' },
    { id: 'kids', name: isArabic ? 'روضة الأطفال' : 'Jardin d’enfants', color: '#10a9b7' },
    { id: 'pastel', name: isArabic ? 'ألوان هادئة' : 'Pastel doux', color: '#51ae8d' },
  ];

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      fr: {
        invoice: 'ÉTAT DE FACTURE (NON JUSTIFICATIF)',
        number: 'Identifiant',
        date: 'Date',
        creche: 'Établissement',
        address: 'Adresse',
        child: 'Enfant',
        parent: 'Parent/Tuteur',
        phone: 'Téléphone',
        email: 'Email',
        description: 'Description',
        amount: 'Montant',
        status: 'Statut enregistré',
        month: 'Période concernée',
        totalAmount: 'Montant de la facture',
        signature: 'Signature & Tampon',
        download: 'Imprimer / PDF',
        print: 'Imprimer',
        paid: 'Statut enregistré : Payé',
        pending: 'En attente',
        late: 'Retard',
        paymentMethod: 'Mode de règlement déclaré',
        monthlyFee: 'Montant facturé',
      },
      ar: {
        invoice: 'بيان فاتورة (ليس إثبات دفع)',
        number: 'المعرّف',
        date: 'التاريخ',
        creche: 'المؤسسة',
        address: 'العنوان',
        child: 'الطفل',
        parent: 'الوالد/الوصي',
        phone: 'الهاتف',
        email: 'البريد الإلكتروني',
        description: 'الوصف',
        amount: 'المبلغ',
        status: 'الحالة المسجلة',
        month: 'الفترة المعنية',
        totalAmount: 'مبلغ الفاتورة',
        signature: 'التوقيع والختم',
        download: 'طباعة / PDF',
        print: 'طباعة',
        paid: 'الحالة المسجلة: مدفوع',
        pending: 'قيد الانتظار',
        late: 'متأخر',
        paymentMethod: 'طريقة الدفع المصرّح بها',
        monthlyFee: 'المبلغ المفوتر',
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
    if (paiement?.statut === 'Retard') return t('late');
    return isArabic ? 'حالة غير معروفة' : 'Statut inconnu';
  };

  const parentInfo: Partial<Parent> = enfant?.parents?.[0] || {};
  const childFullName = enfant
    ? `${enfant.prenom || ''} ${enfant.nom || ''}`.trim() || (isArabic ? 'الطفل غير متاح' : 'Enfant non disponible')
    : (isArabic ? 'الطفل غير متاح' : 'Enfant non disponible');
  const parentFullName = `${parentInfo?.prenom || ''} ${parentInfo?.nom || ''}`.trim()
    || (isArabic ? 'ولي غير مسجل' : 'Parent non renseigné');
  const crecheAddress = creche?.adresse?.trim() || (isArabic ? 'العنوان غير محدد' : 'Adresse non renseignée');
  const logoSrc = resolveSafeLogoUrl(creche?.logoUrl);
  const formattedAmount = typeof paiement?.montant === 'number' && Number.isFinite(paiement.montant)
    ? formatCurrency(paiement.montant)
    : '—';
  const periodLabel = localizeInvoicePeriodText(invoicePeriod(paiement), isArabic);
  const methodLabel = formatPaymentMethodLabel(
    (paiement as Paiement & { moyenPaiement?: string })?.moyenPaiement,
    isArabic
  );
  const dueDateLabel = (paiement as Paiement & { dateEcheance?: string })?.dateEcheance || (isArabic ? 'غير محدد' : 'Non précisée');
  const invoiceNumber = paiement?.id || '—';
  const invoiceDate = new Date().toLocaleDateString(
    language === 'ar' ? 'ar-DZ' : 'fr-FR'
  );
  const nonReceiptDisclaimer = isArabic
    ? 'تنبيه: هذا البيان يعرض البيانات المسجلة في التطبيق ولا يُعد وصل قبض أو إثبات دفع محاسبي.'
    : 'Note importante : cet état reflète les données déclarées dans l’application et ne constitue ni un reçu d’encaissement ni un justificatif comptable.';

  const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
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
<title>${escapeHtml(t('invoice'))} - ${escapeHtml(invoiceNumber)}</title>
<style>
  :root { ${cssVars} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${isArabic ? "'Tahoma', Arial, sans-serif" : "Arial, sans-serif"};
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
  .logo-circle { width: 46px; height: 46px; background: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden; flex-shrink: 0; }
  .logo-circle img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
  .row-between { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin-bottom: 3px; }
  .row-between span:first-child { color: #475569; }
  .row-between span:last-child { font-weight: 600; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; overflow: hidden; border-radius: 9px; }
  thead tr { background: var(--primary); color: #ffffff; }
  th { padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: ${align1}; }
  th:last-child { text-align: ${align2}; }
  td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  td:last-child { text-align: ${align2}; }
  .amount-cell { font-weight: 800; font-size: 14px; color: var(--primary); }
  .status-badge { padding: 7px; border-radius: 8px; font-size: 11px; font-weight: 800; text-align: center; text-transform: uppercase; background: ${status.bg}; color: ${status.text}; margin-top: 8px; }
  .disclaimer { padding: 8px 12px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 10px; font-weight: 700; margin-bottom: 12px; }
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
  .brand-row { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 12px 16px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--header-bg); }
  .brand-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand-copy { min-width: 0; }
  .brand-kicker { font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--secondary); }
  .brand-name { font-size: 18px; font-weight: 900; color: var(--header-text); margin-top: 2px; }
  .brand-address { font-size: 10px; color: var(--header-muted); margin-top: 2px; }
  .meta-card { min-width: 210px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.92); box-shadow: 0 2px 8px rgba(79,70,229,.08); }
  .meta-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--primary); margin-bottom: 7px; }
  .compact-grid { gap: 14px; margin-bottom: 12px; }
  .section-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; background: var(--panel-bg); }
  .payment-card { border-color: var(--secondary); background: var(--payment-bg); }
  .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--primary); margin-bottom: 8px; }
  .payment-card .section-title { color: var(--secondary); }
  .detail-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1px solid var(--border); padding: 4px 0; font-size: 10px; }
  .detail-row:last-child { border-bottom: 0; }
  .detail-row span { color: #64748b; }
  .detail-row strong { color: var(--ink); text-align: ${align2}; }
  .amount-strip { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 10px 14px; margin: 12px 0; border-radius: 12px; background: var(--amount-bg); border: 1px solid var(--border); }
  .thanks { font-size: 11px; font-weight: 700; color: #475569; }
  .invoice-total-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .07em; }
  .invoice-total-value { font-size: 18px; font-weight: 900; color: var(--primary); margin-top: 2px; }
  .signature-card { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.88); }
  .signature-card .sign-label { margin-bottom: 16px; }
  @page { size: A4 landscape; margin: 5mm; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand-row">
      <div class="brand-left">
        <div class="logo-circle"><img src="${escapeHtml(logoSrc)}" alt="Logo Rawdha+" /></div>
        <div class="brand-copy">
          <div class="brand-kicker">Rawdha+ • ${isArabic ? 'حضانة وروضة' : 'Crèche & maternelle'}</div>
          <div class="brand-name">${escapeHtml(creche?.nom || 'Rawdha+')}</div>
          <div class="brand-address">${escapeHtml(crecheAddress)}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-title">${isArabic ? 'بيان فاتورة — ليس إثبات دفع' : 'État de facture — pas un justificatif de paiement'}</div>
        <div class="row-between"><span>${escapeHtml(t('number'))}:</span><span>${escapeHtml(invoiceNumber)}</span></div>
        <div class="row-between"><span>${isArabic ? 'تاريخ الطباعة' : 'Date d’impression'}:</span><span>${escapeHtml(invoiceDate)}</span></div>
      </div>
    </div>

    <div class="disclaimer">${escapeHtml(nonReceiptDisclaimer)}</div>

    <div class="grid2 compact-grid">
      <div class="section-card">
        <div class="section-title">${isArabic ? 'معلومات الطفل' : 'Informations de l’enfant'}</div>
        <div class="detail-row"><span>${isArabic ? 'الاسم واللقب' : 'Nom et prénom'}</span><strong>${escapeHtml(childFullName)}</strong></div>
        <div class="detail-row"><span>${isArabic ? 'الولي / الوصي' : 'Parent / tuteur'}</span><strong>${escapeHtml(parentFullName)}</strong></div>
        <div class="detail-row"><span>${isArabic ? 'تاريخ الميلاد' : 'Date de naissance'}</span><strong>${escapeHtml(enfant?.dateNaissance || '—')}</strong></div>
      </div>
      <div class="section-card payment-card">
        <div class="section-title">${isArabic ? 'تفاصيل الفاتورة' : 'Détails du règlement'}</div>
        <div class="detail-row"><span>${escapeHtml(t('paymentMethod'))}</span><strong>${escapeHtml(methodLabel)}</strong></div>
        <div class="detail-row"><span>${escapeHtml(t('month'))}</span><strong>${escapeHtml(periodLabel)}</strong></div>
        <div class="detail-row"><span>${isArabic ? 'تاريخ الاستحقاق' : 'Échéance'}</span><strong>${escapeHtml(dueDateLabel)}</strong></div>
        ${paiement.periodeCle && paiement.moisConcerne !== invoicePeriod(paiement) ? `<div class="detail-row"><span>${isArabic ? 'النص الأصلي' : 'Libellé original'}</span><strong>${escapeHtml(paiement.moisConcerne)}</strong></div>` : ''}
        <div class="status-badge">${escapeHtml(getStatusLabel())}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t('description'))}</th>
          <th>${escapeHtml(t('month'))}</th>
          <th>${escapeHtml(t('amount'))}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight:600;">${escapeHtml(t('monthlyFee'))}</td>
          <td style="color:#475569;">${escapeHtml(periodLabel)}</td>
          <td class="amount-cell">${escapeHtml(formattedAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="amount-strip">
      <span class="thanks">${isArabic ? 'شكراً لثقتكم' : 'Merci pour votre confiance'}</span>
      <div style="text-align:${align2};">
        <div class="invoice-total-label">${isArabic ? 'مبلغ الفاتورة' : 'Montant de la facture'}</div>
        <div class="invoice-total-value">${escapeHtml(formattedAmount)}</div>
      </div>
    </div>

    <div class="sign-block">
      <div class="signature-card">
        <div class="sign-label">${isArabic ? 'ختم وتوقيع الحضانة' : 'Cachet et signature de la crèche'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${escapeHtml(creche?.nom || '')}</div>
      </div>
      <div class="signature-card">
        <div class="sign-label">${isArabic ? 'توقيع الولي' : 'Signature du parent'}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${escapeHtml(parentFullName)}</div>
      </div>
    </div>

    <div class="footer">© ${new Date().getFullYear()} RAWDHA+ — ${isArabic ? 'منصة تسيير الروضة' : 'Plateforme de gestion de crèche'}</div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    setPrintError(false);
    const printWindow = window.open('', '_blank', 'height=900,width=800');
    if (!printWindow) { setPrintError(true); return; }
    let printed = false;
    const printOnce = () => {
      if (printed || printWindow.closed) return;
      printed = true;
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onload = () => window.setTimeout(printOnce, 250);
    printWindow.document.write(buildInvoiceHTML());
    printWindow.document.close();
    window.setTimeout(printOnce, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      dir={isArabic ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={t('invoice')}
      onClick={onClose}
    >
      <div
        className="mobile-safe-modal my-auto max-h-[calc(100dvh-1rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]"
        onClick={event => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">{t('invoice')}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="me-1 text-xs font-bold uppercase tracking-wide text-slate-500">{isArabic ? 'اختيار التصميم:' : 'Choisir le style :'}</span>
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
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('download')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={isArabic ? 'إغلاق' : 'Fermer'}
              className="rounded-xl p-2 transition hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {printError && <p role="alert" className="mx-4 mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{isArabic ? 'تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.' : 'Impossible d’ouvrir l’impression. Autorisez les fenêtres contextuelles puis réessayez.'}</p>}
        <div ref={factureRef} className="p-3 sm:p-6 print:p-0" style={{ fontFamily: 'Arial, sans-serif', background: theme.pageBackground }}>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-sm" style={{ background: theme.paper, borderColor: theme.border }}>
            <div className="px-4 py-5 sm:px-8" style={{ background: theme.headerBackground }}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-sky-100">
                    <img src={logoSrc} alt="Logo Rawdha+" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>Rawdha+ • {isArabic ? 'حضانة وروضة' : 'Crèche & maternelle'}</p>
                    <h1 className="mt-1 break-words text-xl font-black sm:text-3xl" style={{ color: theme.headerText }}>{creche?.nom || 'Rawdha+'}</h1>
                    <p className="mt-1 break-words text-sm" style={{ color: theme.headerMuted }}>{crecheAddress}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/90 px-4 py-4 text-start shadow-sm sm:min-w-[245px] sm:px-5" style={{ boxShadow: `0 0 0 1px ${theme.border}` }}>
                  <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: theme.primary }}>{isArabic ? 'بيان فاتورة — ليس إثبات دفع' : 'État de facture — pas un justificatif de paiement'}</p>
                  <p className="mt-2 break-all text-sm font-bold text-slate-900">{invoiceNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">{isArabic ? 'تاريخ الطباعة: ' : 'Date d’impression : '}{invoiceDate}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-8">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                {nonReceiptDisclaimer}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.border, background: theme.panelBackground }}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm" aria-hidden="true">🧒</span>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: theme.primary }}>{isArabic ? 'معلومات الطفل' : 'Informations de l’enfant'}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3 border-b border-sky-100 pb-2"><span className="text-slate-500">{isArabic ? 'الاسم واللقب' : 'Nom et prénom'}</span><strong className="break-words text-end text-slate-900">{childFullName}</strong></div>
                    <div className="flex justify-between gap-3 border-b border-sky-100 pb-2"><span className="text-slate-500">{isArabic ? 'الولي / الوصي' : 'Parent / tuteur'}</span><strong className="break-words text-end text-slate-900">{parentFullName}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">{isArabic ? 'تاريخ الميلاد' : 'Date de naissance'}</span><strong className="text-end text-slate-900">{enfant?.dateNaissance || '—'}</strong></div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: theme.secondary, background: theme.paymentBackground }}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm" aria-hidden="true">💳</span>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: theme.secondary }}>{isArabic ? 'تفاصيل الفاتورة' : 'Détails du règlement'}</h3>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('paymentMethod')}</p>
                      <p className="mt-1 font-bold text-slate-900">{methodLabel}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{isArabic ? 'الاستحقاق: ' : 'Échéance : '}{dueDateLabel}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('totalAmount')}</p>
                      <p className="mt-1 text-2xl font-black sm:text-3xl" style={{ color: theme.primary }}>{formattedAmount}</p>
                    </div>
                  </div>
                  {paiement.periodeCle && paiement.moisConcerne !== invoicePeriod(paiement) && <p className="mt-3 break-words text-xs text-slate-600">{isArabic ? 'النص الأصلي' : 'Libellé original'} : {paiement.moisConcerne}</p>}
                  <div className={`mt-4 rounded-xl px-4 py-2 text-center text-xs font-black uppercase tracking-widest ${getStatusColor()}`}>{getStatusLabel()}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.border }}>
                <div className="hidden grid-cols-[1fr_0.7fr_0.7fr] px-4 py-3 text-xs font-black uppercase tracking-wide text-white sm:grid sm:px-5" style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }}>
                  <span>{t('description')}</span><span>{t('month')}</span><span className="text-end">{t('amount')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 px-4 py-4 text-sm sm:grid-cols-[1fr_0.7fr_0.7fr] sm:items-center sm:px-5">
                  <strong className="text-slate-900">{t('monthlyFee')}</strong>
                  <span className="text-slate-600">{periodLabel}</span>
                  <strong className="sm:text-end" style={{ color: theme.primary }}>{formattedAmount}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:px-6" style={{ background: theme.amountBackground, boxShadow: `0 0 0 1px ${theme.border}` }}>
                <p className="text-sm font-semibold text-slate-600">{isArabic ? 'شكراً لثقتكم' : 'Merci pour votre confiance'}</p>
                <div className="text-end"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isArabic ? 'مبلغ الفاتورة' : 'Montant de la facture'}</p><p className="text-2xl font-black" style={{ color: theme.primary }}>{formattedAmount}</p></div>
              </div>

              <div className="grid gap-5 border-t border-dashed border-slate-300 pt-5 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{isArabic ? 'ختم وتوقيع الحضانة' : 'Cachet et signature de la crèche'}</p><div className="mt-10 border-b border-slate-400"></div><p className="mt-2 text-xs font-semibold text-slate-500">{creche?.nom}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{isArabic ? 'توقيع الولي' : 'Signature du parent'}</p><div className="mt-10 border-b border-slate-400"></div><p className="mt-2 break-words text-xs font-semibold text-slate-500">{parentFullName}</p></div>
              </div>

              <p className="text-center text-xs" style={{ color: theme.headerMuted }}>© {new Date().getFullYear()} RAWDHA+ — {isArabic ? 'منصة تسيير الروضة' : 'Plateforme de gestion de crèche'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
