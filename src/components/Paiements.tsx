import { useReminderPreflight } from '../hooks/useReminderPreflight';
import InvoiceCorrections from './InvoiceCorrections';
import FinanceReviewWarning from './FinanceReviewWarning';
import InvoicePeriodReview from './InvoicePeriodReview';
import {
  INVOICE_PAYMENT_METHODS,
  formatInvoiceStatusLabel,
  formatPaymentMethodLabel,
  hasInvalidFinanceDetails,
  invoicePeriod,
  localizeInvoicePeriodText,
  reminderBlockReason,
  reminderContext,
} from '../utils/financePeriod';
import { financeErrorMessage } from '../utils/financeError';
import { spreadsheetCsvCell } from '../utils/csv';
import FinanceUnavailable from './FinanceUnavailable';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  X,
  CreditCard,
  Search,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  HelpCircle,
  FileText,
  Edit,
  Copy,
  MessageCircle,
  Download,
  Sparkles,
  Wallet,
  Receipt,
  Ban,
} from 'lucide-react';
import { buildPaymentReceiptPdf } from '../utils/paymentReceiptPdf';
import InAppPdfViewerModal, { type InAppPdfViewerSource } from './InAppPdfViewerModal';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import InvoiceInstallmentsModal, { useInvoiceInstallments } from './InvoiceInstallmentsModal';
import { Enfant, Paiement } from '../types';
import { formatCurrency } from '../utils/format';
import { motion, AnimatePresence } from 'motion/react';
import Facture from './Facture';
import BatchMonthlyInvoicesModal from './BatchMonthlyInvoicesModal';
import EnfantDetails from './EnfantDetails';
import { useIsMobileViewport } from '../hooks/useMobileViewport';

const normalizeAlgerianWhatsApp = (raw?: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;

  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
};

const findWhatsAppPhone = (enfant: Enfant | undefined) => {
  if (!enfant) return null;
  return (enfant.parents || [])
    .map(parent => normalizeAlgerianWhatsApp(parent.telephone))
    .find((value): value is string => Boolean(value)) || null;
};

const buildWhatsAppRelanceMessage = (paiement: RichPaiement, enfant: Enfant | undefined, isArabic: boolean) => {
  if (!enfant) return '';
  const childName = `${enfant.prenom} ${enfant.nom}`;
  const dueDate = paiement.dateEcheance || (isArabic ? 'غير محدد' : 'non précisée');
  const originalPeriod = invoicePeriod(paiement);
  const period = isArabic
    ? originalPeriod.replace(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi, month => ({ janvier: 'جانفي', février: 'فيفري', mars: 'مارس', avril: 'أفريل', mai: 'ماي', juin: 'جوان', juillet: 'جويلية', août: 'أوت', septembre: 'سبتمبر', octobre: 'أكتوبر', novembre: 'نوفمبر', décembre: 'ديسمبر' }[month.toLowerCase()] ?? month))
    : originalPeriod;
  return isArabic
    ? `السلام عليكم، نرجو التواصل مع إدارة الروضة للتحقق من الفاتورة المسجلة باسم ${childName} للفترة ${period} بمبلغ ${formatCurrency(paiement.montant)}. تاريخ الاستحقاق المسجل: ${dueDate}. شكراً لكم.`
    : `Bonjour,\n\nMerci de contacter la direction pour vérifier la facture enregistrée pour ${childName}, période ${period}, montant ${formatCurrency(paiement.montant)}. Échéance enregistrée : ${dueDate}.\n\nCordialement,\nLa direction de Rawdha+`;
};

const buildWhatsAppRelanceLink = (paiement: RichPaiement, enfant: Enfant | undefined, isArabic: boolean) => {
  const phone = findWhatsAppPhone(enfant);
  const message = buildWhatsAppRelanceMessage(paiement, enfant, isArabic);
  if (!phone || !message) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

interface RichPaiement extends Paiement {
  moyenPaiement?: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
  dateEcheance?: string;
  reductionCode?: string;
  notes?: string;
  typeFacture?: 'Mensuel' | 'Annuel';
}

const PAYMENT_METHODS = INVOICE_PAYMENT_METHODS;

export default function Paiements() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { showToast } = useToast();

  const {
    financialDataReady,
    paiements: allDbPaiements,
    enfants: allEnfantsData,
    addPaiement,
    updatePaiement, // Utilisation de l'update depuis le DbContext
    invoiceReviewAction,
  } = useDb();

  const { user, creche } = useAuth();
  const { activeProfile, hasPagePermission } = useWorkspaceProfile();
  const canManageInvoices = hasPagePermission('paiements', 'manage');
  const canRecordInstallments = hasPagePermission('paiements', 'installments');
  const canRemindParents = hasPagePermission('paiements', 'remind');
  const {
    byInvoiceId: installmentsByInvoice,
    paidSumByInvoiceId,
    todaySummary,
    addInstallment,
    removeInstallment,
  } = useInvoiceInstallments(user?.id);
  const [installmentTarget, setInstallmentTarget] = useState<RichPaiement | null>(null);
  const isDirecteur = user?.role === 'directeur';
  const enfantsData = isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData;
  const enfantById = useMemo(() => new Map(enfantsData.map(e => [e.id, e])), [enfantsData]);
  const enfantIdsVisibles = useMemo(() => new Set(enfantsData.map(e => e.id)), [enfantsData]);
  const dbPaiements = useMemo(
    () => (isDirecteur ? allDbPaiements.filter(p => enfantIdsVisibles.has(p.enfantId)) : allDbPaiements),
    [allDbPaiements, enfantIdsVisibles, isDirecteur]
  );
  const reminderState = useMemo(() => reminderContext(dbPaiements), [dbPaiements]);
  const suspectedIds = reminderState.suspectedIds;
  const invalidDetailsCount = useMemo(() => dbPaiements.filter(hasInvalidFinanceDetails).length, [dbPaiements]);
  const reminderCheck = useReminderPreflight(dbPaiements, enfantsData, financialDataReady);
  const today = new Date();
  const currentMonthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${currentMonthLabel}-${String(today.getDate()).padStart(2, '0')}`;

  const paiements: RichPaiement[] = useMemo(() => dbPaiements.map((p: any) => ({
    ...p,
    // Une facture en attente dont l’échéance est passée devient automatiquement un retard à l’affichage.
    // Le statut enregistré n’est pas modifié tant que la direction ne valide pas l’encaissement.
    statut: p.statut === 'En attente' && p.dateEcheance && p.dateEcheance < todayKey ? 'Retard' : p.statut,
    moyenPaiement: p.moyenPaiement,
    // Une facture ancienne sans échéance reste sans échéance : on ne fabrique pas
    // une date 2026 qui donnerait une information fausse à la directrice.
    dateEcheance: p.dateEcheance || undefined,
    reductionCode: p.reductionCode,
    typeFacture: p.typeFacture
  })), [dbPaiements, todayKey]);

  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [dossierEnfant, setDossierEnfant] = useState<Enfant | null>(null);
  const isMobileViewport = useIsMobileViewport();
  const [editingPaiementId, setEditingPaiementId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Paiement | null>(null);
  const [formError, setFormError] = useState('');
  const [selectedPaiement, setSelectedPaiement] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterStatut, setFilterStatut] = useState('Tous');
  const [showFacture, setShowFacture] = useState(false);
  const [selectedFacturePaiement, setSelectedFacturePaiement] = useState<any | null>(null);
  const [receiptViewerSource, setReceiptViewerSource] = useState<InAppPdfViewerSource | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Paiement | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingInvoice, setCancellingInvoice] = useState(false);

  const handleOpenReceiptPdf = async (p: Paiement) => {
    try {
      const enfant = enfantById.get(p.enfantId);
      const built = await buildPaymentReceiptPdf({
        paiement: p,
        enfant,
        creche,
        installments: installmentsByInvoice.get(p.id) || [],
        recordedBy: activeProfile?.name,
      });
      setReceiptViewerSource({
        title: isArabic ? `وصل الدفع ${built.receiptNumber}` : `Reçu ${built.receiptNumber}`,
        fileName: built.fileName,
        mimeType: 'application/pdf',
        bytes: built.bytes,
        pageCount: built.pageCount,
      });
    } catch {
      showToast(isArabic ? 'تعذر إنشاء وصل PDF.' : 'Impossible de générer le reçu PDF.', 'error');
    }
  };

  const handleConfirmCancelInvoice = async () => {
    if (!cancelTarget || !cancelReason.trim() || cancellingInvoice || typeof invoiceReviewAction !== 'function') return;
    const stored = dbPaiements.find(item => item.id === cancelTarget.id);
    if (!stored) return;
    setCancellingInvoice(true);
    try {
      await invoiceReviewAction({
        requestId: `finance_cancel_${crypto.randomUUID()}`,
        action: 'cancel_invoice',
        expected: stored,
        reason: cancelReason.trim(),
      });
      setCancelTarget(null);
      setCancelReason('');
      showToast(
        isArabic ? 'تم إلغاء الفاتورة محاسبياً مع حفظ أثرها.' : 'Facture annulée avec conservation de sa trace.',
        'success'
      );
    } catch (err) {
      showToast(financeErrorMessage(err, isArabic), 'error');
    } finally {
      setCancellingInvoice(false);
    }
  };
  const [copiedPaiementId, setCopiedPaiementId] = useState<string | null>(null);
  const [whatsappPreview, setWhatsappPreview] = useState<{ invoiceId: string; invoiceSnapshot: string; phone: string; childName: string; message: string } | null>(null);
  const [previewInvalidated, setPreviewInvalidated] = useState(false);
  const [quickUpdatingPaiementId, setQuickUpdatingPaiementId] = useState<string | null>(null);
  const isAccountPending = user?.role === 'directeur' && user.approvalStatus === 'pending';
  const isReadOnly = isAccountPending || !canManageInvoices;

  // Local revalidation only: another device can still change the server afterwards.
  const previewPayment = whatsappPreview && paiements.find(item => item.id === whatsappPreview.invoiceId);
  const previewStored = whatsappPreview && dbPaiements.find(item => item.id === whatsappPreview.invoiceId);
  const previewChild = previewPayment && enfantsData.find(item => item.id === previewPayment.enfantId);
  const previewCurrent = !!whatsappPreview && financialDataReady && !!previewPayment && !!previewStored && !!previewChild
    && reminderBlockReason(previewPayment, reminderState) === null
    && JSON.stringify(previewStored) === whatsappPreview.invoiceSnapshot
    && findWhatsAppPhone(previewChild) === whatsappPreview.phone
    && `${previewChild.prenom} ${previewChild.nom}` === whatsappPreview.childName
    && buildWhatsAppRelanceMessage(previewPayment, previewChild, isArabic) === whatsappPreview.message;
  useEffect(() => {
    if (whatsappPreview && !previewCurrent) { setWhatsappPreview(null); setPreviewInvalidated(true); }
  }, [whatsappPreview, previewCurrent]);

  const handleCopyRelance = async (paiement: RichPaiement, enfant?: Enfant) => {
    if (!financialDataReady || reminderBlockReason(paiement, reminderState) !== null || !enfant) return;
    const stored = dbPaiements.find(item => item.id === paiement.id);
    if (!stored || !await reminderCheck.verify(stored, enfant)) return;
    const message = buildWhatsAppRelanceMessage(paiement, enfant, isArabic);
    try {
      await navigator.clipboard.writeText(message);
      setCopiedPaiementId(paiement.id);
      window.setTimeout(() => setCopiedPaiementId(null), 2200);
      showToast(
        isArabic ? 'تم نسخ رسالة التذكير. يمكنك لصقها في واتساب.' : 'Relance copiée. Vous pouvez la coller dans WhatsApp.',
        'success'
      );
    } catch {
      showToast(
        isArabic ? 'تعذر نسخ رسالة التذكير.' : 'La relance n’a pas pu être copiée automatiquement.',
        'error'
      );
    }
  };

  const handleQuickPaymentChange = async (paiement: RichPaiement, selection: string) => {
    if (isReadOnly || quickUpdatingPaiementId) return;
    setQuickUpdatingPaiementId(paiement.id);
    try {
      const expected = dbPaiements.find(item => item.id === paiement.id);
      if (!expected) throw new Error('finance_changed');
      if (selection.startsWith('Payé:')) {
        const moyenPaiement = selection.replace('Payé:', '') as NonNullable<RichPaiement['moyenPaiement']>;
        await updatePaiement(paiement.id, { statut: 'Payé', moyenPaiement }, expected);
      } else {
        await updatePaiement(paiement.id, {
          statut: selection as RichPaiement['statut'],
          moyenPaiement: null,
        }, expected);
      }
    } catch (error) {
      console.error('Modification rapide facture:', error);
      showToast(financeErrorMessage(error, isArabic), 'error');
    } finally {
      setQuickUpdatingPaiementId(null);
    }
  };

  const paymentSelectionValue = (paiement: RichPaiement) => paiement.statut === 'Payé'
    ? `Payé:${paiement.moyenPaiement || ''}`
    : typeof paiement.statut === 'string' ? paiement.statut : '';

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (whatsappPreview) {
        setWhatsappPreview(null);
      } else if (selectedPaiement) {
        setSelectedPaiement(null);
      } else if (showModal && !savingRef.current) {
        setShowModal(false);
        setEditingPaiementId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [whatsappPreview, selectedPaiement, showModal]);

  const [formData, setFormData] = useState({
    enfantId: enfantsData[0]?.id || '',
    montant: creche?.tuitionFeeRate ?? 0,
    statut: 'En attente' as 'Payé' | 'En attente' | 'Retard',
    typeFacture: 'Mensuel' as '' | 'Mensuel' | 'Annuel',
    moisConcerne: currentMonthLabel,
    moyenPaiement: '' as '' | 'Espèces' | 'Chèque' | 'Virement' | 'Carte',
    dateEcheance: '',
    reductionCode: '',
    notes: ''
  });

  // Déclenche l'édition d'une facture existante
  const handleEditClick = (p: RichPaiement) => {
    setEditingPaiementId(p.id);
    setEditingSnapshot(dbPaiements.find(item => item.id === p.id) || null);
    setFormError('');
    setFormData({
      enfantId: p.enfantId,
      montant: p.montant,
      statut: dbPaiements.find(item => item.id === p.id)?.statut || p.statut,
      typeFacture: p.typeFacture || '',
      moisConcerne: p.moisConcerne,
      moyenPaiement: p.moyenPaiement || '',
      dateEcheance: p.dateEcheance || '',
      reductionCode: p.reductionCode || '',
      notes: p.notes || ''
    });
    setShowModal(true);
  };

  const editingCurrent = editingPaiementId ? dbPaiements.find(item => item.id === editingPaiementId) : undefined;
  const editingOutdated = !!editingPaiementId && (!editingSnapshot || !editingCurrent || suspectedIds.has(editingPaiementId) || JSON.stringify(editingSnapshot) !== JSON.stringify(editingCurrent));
  const legacyPaidWithoutMethod = !!editingPaiementId
    && editingSnapshot?.statut === 'Payé'
    && !(editingSnapshot as RichPaiement)?.moyenPaiement;

  const handleAjouterOuModifier = async () => {
    if (savingRef.current || !financialDataReady || editingOutdated || isReadOnly) return;
    if (!formData.enfantId || !Number.isFinite(formData.montant) || formData.montant <= 0 || !formData.moisConcerne.trim()) {
      showToast(isArabic ? 'اختر الطفل وأدخل مبلغاً صحيحاً وفترة الفاتورة.' : 'Choisissez un enfant et renseignez un montant valide et une période.', 'error');
      return;
    }
    if (formData.statut === 'Payé' && !formData.moyenPaiement && !legacyPaidWithoutMethod) {
      setFormError(isArabic ? 'حدد وسيلة الدفع المصرّح بها عند اختيار حالة «مدفوعة».' : 'Précisez le moyen de règlement déclaré lorsqu’une facture est marquée payée.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      const effectiveMethod = formData.statut === 'Payé' ? (formData.moyenPaiement || null) : null;
      const mutable = {
        montant: formData.montant,
        statut: formData.statut,
        moyenPaiement: effectiveMethod,
        dateEcheance: formData.dateEcheance || null,
        notes: formData.notes || null,
      };
      if (editingPaiementId) {
        if (!editingSnapshot) throw new Error('finance_changed');
        await updatePaiement(editingPaiementId, mutable, editingSnapshot);
      } else {
        const validPeriod = formData.typeFacture === 'Mensuel' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(formData.moisConcerne) : formData.typeFacture === 'Annuel' && /^\d{4}$/.test(formData.moisConcerne);
        if (!validPeriod || formData.moisConcerne.startsWith('0000')) throw new Error('finance_invalid_period');
        await addPaiement({
          enfantId: formData.enfantId,
          montant: formData.montant,
          statut: formData.statut,
          typeFacture: formData.typeFacture,
          moisConcerne: formData.moisConcerne,
          periodeCle: `${formData.typeFacture === 'Mensuel' ? 'M' : 'A'}:${formData.moisConcerne}`,
          ...(effectiveMethod ? { moyenPaiement: effectiveMethod } : {}),
          ...(formData.dateEcheance ? { dateEcheance: formData.dateEcheance } : {}),
          ...(formData.notes ? { notes: formData.notes } : {}),
        });
      }
      setShowModal(false);
      setEditingPaiementId(null);
      setFormData({ enfantId: '', montant: creche?.tuitionFeeRate ?? 0, statut: 'En attente', typeFacture: 'Mensuel', moisConcerne: currentMonthLabel, moyenPaiement: '', dateEcheance: '', reductionCode: '', notes: '' });
    } catch (error) {
      setFormError(financeErrorMessage(error, isArabic));
    } finally { savingRef.current = false; setSaving(false); }
  };

  // Mathématiques de synthèse financière
  const totalPaid = paiements.filter(p => p.statut === 'Payé').reduce((sum, p) => sum + p.montant, 0);
  const totalPending = paiements.filter(p => p.statut === 'En attente').reduce((sum, p) => sum + p.montant, 0);
  const totalLate = paiements.filter(p => p.statut === 'Retard').reduce((sum, p) => sum + p.montant, 0);
  const recoveryRate = Math.round((totalPaid / (totalPaid + totalPending + totalLate)) * 100) || 0;

  const displayPaymentPeriod = (value: string) => localizeInvoicePeriodText(value, isArabic);

  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const filteredPaiements = useMemo(() => paiements.filter(p => {
    const enfant = enfantById.get(p.enfantId);
    const childLabel = enfant ? `${enfant.prenom} ${enfant.nom}` : (isArabic ? 'الطفل غير متاح' : 'Enfant non disponible');
    const matchesSearch = !normalizedSearch || [
      childLabel,
      invoicePeriod(p),
      localizeInvoicePeriodText(invoicePeriod(p), isArabic),
      p.moisConcerne || '',
      p.id || '',
      formatPaymentMethodLabel(p.moyenPaiement, isArabic, ''),
    ].some(field => field.toLowerCase().includes(normalizedSearch));
    const matchesStatut = filterStatut === 'Tous' || p.statut === filterStatut;

    return matchesSearch && matchesStatut;
  }), [enfantById, filterStatut, isArabic, normalizedSearch, paiements]);

  const handleExportCsv = () => {
    if (!filteredPaiements.length || invalidDetailsCount > 0) return;
    const headers = isArabic
      ? ['المعرّف', 'الطفل', 'الفترة المعتمدة', 'النص الأصلي', 'النوع', 'المبلغ (دج)', 'الحالة المسجلة', 'وسيلة الدفع المصرّح بها', 'تاريخ الاستحقاق', 'طبيعة البيانات']
      : ['Référence', 'Enfant', 'Période retenue', 'Libellé original', 'Type', 'Montant DZD', 'Statut affiché', 'Mode déclaré', 'Échéance', 'Nature du statut'];
    const rows = filteredPaiements.map(p => {
      const enfant = enfantsData.find(e => e.id === p.enfantId);
      const childLabel = enfant ? `${enfant.prenom} ${enfant.nom}` : (isArabic ? 'الطفل غير متاح' : 'Enfant non disponible');
      const periodType = typeof p.periodeCle === 'string' && p.periodeCle.startsWith('A:')
        ? (isArabic ? 'سنة ميلادية' : 'Année civile')
        : typeof p.periodeCle === 'string' && p.periodeCle.startsWith('M:')
        ? (isArabic ? 'شهري' : 'Mensuel')
        : p.typeFacture || '—';
      return [
        p.id,
        childLabel,
        invoicePeriod(p),
        p.moisConcerne || '',
        periodType,
        typeof p.montant === 'number' && Number.isFinite(p.montant) ? p.montant : '',
        formatInvoiceStatusLabel(p.statut, isArabic),
        formatPaymentMethodLabel(p.moyenPaiement, isArabic),
        p.dateEcheance || '',
        isArabic ? 'تصريح إداري (ليس وصل قبض)' : 'Statut déclaratif (pas un justificatif de paiement)',
      ];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(spreadsheetCsvCell).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facturation-rawdha-${todayKey}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!financialDataReady) return <FinanceUnavailable />;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* En-tête épuré & actions directes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isArabic ? 'الفواتير والمدفوعات' : 'Factures & règlements'}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5">
            {isArabic
              ? 'إنشاء ومتابعة الفواتير الشهرية والسنوية؛ لا تُحسب التخفيضات تلقائياً.'
              : 'Suivi des cotisations et échéances ; les remises ne sont pas calculées automatiquement.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={isReadOnly}
            className="min-h-9! w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (isReadOnly) return;
              setEditingPaiementId(null);
              setEditingSnapshot(null);
              setFormError('');
              setFormData({ enfantId: '', montant: creche?.tuitionFeeRate ?? 0, statut: 'En attente', typeFacture: 'Mensuel', moisConcerne: currentMonthLabel, moyenPaiement: '', dateEcheance: '', reductionCode: '', notes: '' });
              setShowModal(true);
            }}
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>{isArabic ? 'إصدار فاتورة جديدة' : 'Créer une facture'}</span>
          </button>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={!filteredPaiements.length || invalidDetailsCount > 0}
              onClick={handleExportCsv}
              className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={15} className="shrink-0 text-slate-500" />
              <span className="truncate">{isArabic ? 'تصدير CSV' : 'Exporter CSV'}</span>
            </button>
            <button
              type="button"
              disabled={isReadOnly || !enfantsData.some(child => child.statut === 'Actif')}
              onClick={() => setShowBatchModal(true)}
              className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Calendar size={15} className="shrink-0 text-indigo-600" />
              <span className="truncate">{isArabic ? 'تحضير فواتير الشهر' : 'Préparer le mois'}</span>
            </button>
          </div>
        </div>
      </div>

      {isAccountPending && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
          {isArabic ? 'حسابك في وضع القراءة فقط إلى حين موافقة الإدارة.' : 'Votre compte reste en lecture seule jusqu’à validation par l’administration.'}
        </p>
      )}
      {!isAccountPending && !canManageInvoices && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
          {isArabic
            ? 'هذا الحساب يمتلك صلاحية الاطلاع على الفواتير دون تعديلها أو إصدارها.'
            : 'Ce profil dispose d’un accès en consultation sur les factures (création et modification désactivées).'}
        </p>
      )}

      <FinanceReviewWarning count={dbPaiements.filter(p => !p.periodeCle).length} suspected={dbPaiements.filter(p => suspectedIds.has(p.id)).length} invalid={invalidDetailsCount} />

      {/* Synthèse financière compacte */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500 break-words">{isArabic ? 'فواتير بحالة مدفوعة' : 'Factures marquées payées'}</p>
          <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 tabular-nums break-words">{invalidDetailsCount ? '—' : formatCurrency(totalPaid)}</p>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500 break-words">{isArabic ? 'في الانتظار' : 'En attente'}</p>
          <p className="text-sm sm:text-lg font-bold text-amber-700 mt-0.5 tabular-nums break-words">{invalidDetailsCount ? '—' : formatCurrency(totalPending)}</p>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500 break-words">{isArabic ? 'فواتير متأخرة' : 'Factures en retard'}</p>
          <p className="text-sm sm:text-lg font-bold text-rose-600 mt-0.5 tabular-nums break-words">{invalidDetailsCount ? '—' : formatCurrency(totalLate)}</p>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-[11px] font-medium text-slate-500 break-words">{isArabic ? 'نسبة الاسترداد' : 'Taux payé'}</p>
          <p className="text-sm sm:text-lg font-bold text-indigo-600 mt-0.5 tabular-nums break-words">{invalidDetailsCount ? '—' : `${recoveryRate}%`}</p>
        </div>
      </div>

      {/* Suivi quotidien des versements déclarés (Caisse du jour sur 1 ligne nette) */}
      <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">
              {isArabic ? 'الدفعات والتسبيقات المصرح بها اليوم' : 'Versements & acomptes déclarés aujourd’hui'}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {todaySummary.count === 0
                ? isArabic
                  ? 'لم يُسجَّل أي وصل اليوم'
                  : 'Aucun bon enregistré aujourd’hui'
                : isArabic
                  ? `${todaySummary.count} وصل · نقداً: ${formatCurrency(todaySummary.cash)}`
                  : `${todaySummary.count} bon(s) · Espèces : ${formatCurrency(todaySummary.cash)}`}
            </p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-800 tabular-nums">
          {formatCurrency(todaySummary.total)}
        </span>
      </div>

      <InvoicePeriodReview invoices={dbPaiements} children={enfantsData} readOnly={isReadOnly} />
      <InvoiceCorrections invoices={dbPaiements} children={enfantsData} readOnly={isReadOnly} />

      {/* Barre de Recherche et Filtres */}
      <div className="min-w-0 bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث باسم الطفل أو الفترة أو رقم الفاتورة...' : 'Rechercher un enfant, une période ou une référence...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-9 pe-9 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label={isArabic ? 'مسح البحث' : 'Effacer la recherche'}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full md:w-auto shrink-0">
          {[
            { key: 'Tous', label: isArabic ? 'الكل' : 'Tous', count: paiements.length, color: 'text-slate-600 hover:text-slate-900' },
            { key: 'Payé', label: isArabic ? 'مدفوعة' : 'Payées', count: paiements.filter(p => p.statut === 'Payé').length, color: 'text-slate-600 hover:text-emerald-700' },
            { key: 'En attente', label: isArabic ? 'في الانتظار' : 'En attente', count: paiements.filter(p => p.statut === 'En attente').length, color: 'text-slate-600 hover:text-amber-700' },
            { key: 'Retard', label: isArabic ? 'متأخرة' : 'En retard', count: paiements.filter(p => p.statut === 'Retard').length, color: 'text-slate-600 hover:text-rose-700' },
            ...(paiements.some(p => p.statut === 'Annulé')
              ? [{ key: 'Annulé', label: isArabic ? 'ملغاة' : 'Annulées', count: paiements.filter(p => p.statut === 'Annulé').length, color: 'text-slate-500 hover:text-slate-800' }]
              : []),
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatut(tab.key)}
              className={`min-h-9! px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition cursor-pointer text-center tabular-nums ${
                filterStatut === tab.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : `bg-slate-50 ring-1 ring-inset ring-slate-200/80 ${tab.color}`
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Cartes verticales sur téléphone (<=767px) ou Tableau des factures sur tablette/ordinateur */}
      {isMobileViewport ? (
        <div className="space-y-3" role="region" aria-label={isArabic ? 'قائمة الفواتير' : 'Liste des factures'}>
          {filteredPaiements.length > 0 ? (
            filteredPaiements.map((p) => {
              const enfant = enfantById.get(p.enfantId);
              const isQuickUpdating = quickUpdatingPaiementId === p.id;
              const underReview = suspectedIds.has(p.id);
              const reminderBlocked = reminderBlockReason(p, reminderState);
              const isLateDisplay = p.statut === 'Retard';
              const isCancelled = p.statut === 'Annulé';
              const statusAccent = isCancelled
                ? 'border-s-slate-400 opacity-75'
                : p.statut === 'Payé'
                ? 'border-s-emerald-500'
                : isLateDisplay
                  ? 'border-s-rose-500'
                  : 'border-s-amber-500';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPaiement(p)}
                  className={`rawdha-card-modern rounded-2xl border border-slate-200/75 border-s-4 ${statusAccent} bg-white p-4 shadow-2xs space-y-3 cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xs flex items-center justify-center font-black text-xs shrink-0">
                        {enfant ? `${enfant.prenom[0] || ''}${enfant.nom[0] || ''}` : '??'}
                      </div>
                      <div className="min-w-0">
                        {enfant ? (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              setDossierEnfant(enfant);
                            }}
                            className="max-w-full truncate text-start text-sm font-extrabold text-slate-900 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                          >
                            {enfant.prenom} {enfant.nom}
                          </button>
                        ) : (
                          <p className="truncate text-sm font-extrabold text-slate-900">
                            {isArabic ? 'الطفل غير متاح' : 'Enfant non disponible'}
                          </p>
                        )}
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {displayPaymentPeriod(invoicePeriod(p))}
                          {enfant?.groupeAge ? ` · ${enfant.groupeAge}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-black text-slate-950 tabular-nums">
                        {typeof p.montant === 'number' && Number.isFinite(p.montant) ? formatCurrency(p.montant) : '—'}
                      </p>
                      {p.statut === 'Payé' ? (
                        <p className="text-[11px] font-bold text-emerald-700">
                          {formatPaymentMethodLabel(p.moyenPaiement, isArabic)}
                        </p>
                      ) : (
                        <p className={`text-[11px] font-bold ${isLateDisplay ? 'text-rose-600' : 'text-amber-700'}`}>
                          {p.dateEcheance || (isArabic ? 'بدون استحقاق' : 'Sans échéance')}
                        </p>
                      )}
                      {p.statut !== 'Payé' && (paidSumByInvoiceId.get(p.id) || 0) > 0 && (
                        <p className="mt-0.5 text-[10px] font-extrabold text-emerald-700 tabular-nums">
                          {isArabic
                            ? `مدفوع: ${formatCurrency(paidSumByInvoiceId.get(p.id) || 0)} · باقي: ${formatCurrency(Math.max(0, (Number(p.montant) || 0) - (paidSumByInvoiceId.get(p.id) || 0)))}`
                            : `Versé : ${formatCurrency(paidSumByInvoiceId.get(p.id) || 0)} · Reste : ${formatCurrency(Math.max(0, (Number(p.montant) || 0) - (paidSumByInvoiceId.get(p.id) || 0)))}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {underReview && <p className="text-xs font-bold text-rose-700">{isArabic ? 'اشتباه تكرار قيد المراجعة' : 'Doublon suspect à vérifier'}</p>}
                  {reminderBlocked === 'period' && <p className="text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: راجع الفترة' : 'Rappel suspendu : période à vérifier'}</p>}
                  {reminderBlocked === 'sibling-period' && <p className="text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: فترة فاتورة أخرى للطفل تحتاج مراجعة' : 'Rappel suspendu : période d’une autre facture de l’enfant à vérifier'}</p>}
                  {reminderBlocked === 'details' && <p className="text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: تحقق من المبلغ والحالة' : 'Rappel suspendu : montant ou statut à vérifier'}</p>}

                  <div onClick={event => event.stopPropagation()}>
                    {isCancelled ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 truncate">
                        {isArabic ? 'ملغاة محاسبياً' : 'Annulée'}
                        {p.motifAnnulation ? ` · ${p.motifAnnulation}` : ''}
                      </div>
                    ) : (
                      <select
                        value={paymentSelectionValue(p)}
                        disabled={isReadOnly || isQuickUpdating || underReview}
                        onChange={event => void handleQuickPaymentChange(p, event.target.value)}
                        aria-label={isArabic ? 'تعديل حالة الفاتورة وطريقة الدفع' : 'Modifier le statut et le moyen de règlement'}
                        className={`w-full cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          p.statut === 'Payé'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.statut === 'En attente'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {!['Payé','En attente','Retard'].includes(p.statut) && <option value={p.statut || ''} disabled>{isArabic ? 'حالة غير معروفة' : 'Statut inconnu'}{typeof p.statut === 'string' && p.statut ? ` : ${p.statut}` : ''}</option>}
                        {p.statut === 'Payé' && p.moyenPaiement && !(PAYMENT_METHODS as readonly string[]).includes(p.moyenPaiement) && <option value={`Payé:${p.moyenPaiement}`} disabled>{isArabic ? `مدفوعة — ${p.moyenPaiement}` : `Payé — ${p.moyenPaiement}`}</option>}
                        <option value="Payé:" disabled>{isArabic ? 'مدفوعة — الوسيلة غير محددة' : 'Payé — moyen non précisé'}</option>
                        <option value="En attente">{isArabic ? 'قيد الانتظار' : 'En attente'}</option>
                        <option value="Retard">{isArabic ? 'متأخرة' : 'En retard'}</option>
                        {PAYMENT_METHODS.map(method => <option key={method} value={`Payé:${method}`}>{isArabic ? `مدفوعة — ${formatPaymentMethodLabel(method, true)}` : `Payé — ${method}`}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5" onClick={event => event.stopPropagation()}>
                    {(p.statut === 'Payé' || (paidSumByInvoiceId.get(p.id) || 0) > 0) && !isCancelled && (
                      <button
                        type="button"
                        className="min-h-8! inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap transition cursor-pointer disabled:opacity-40"
                        disabled={underReview || hasInvalidFinanceDetails(p)}
                        onClick={() => void handleOpenReceiptPdf(p)}
                        title={isArabic ? 'وصل الدفع PDF' : 'Reçu de paiement PDF'}
                        aria-label={isArabic ? 'وصل الدفع PDF' : 'Reçu de paiement PDF'}
                      >
                        <Receipt size={14} className="shrink-0" />
                        <span>{isArabic ? 'وصل PDF' : 'Reçu'}</span>
                      </button>
                    )}
                    {canRecordInstallments && !isCancelled && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-40"
                        disabled={underReview || hasInvalidFinanceDetails(p)}
                        onClick={() => setInstallmentTarget(p)}
                        title={isArabic ? 'تسجيل دفعة جزئية أو وصل' : 'Enregistrer un acompte / bon de versement'}
                        aria-label={isArabic ? 'تسجيل دفعة جزئية أو وصل' : 'Enregistrer un acompte / bon de versement'}
                      >
                        <Wallet size={15} />
                        <span>{isArabic ? 'تسبيق' : 'Acompte'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer disabled:opacity-40"
                      disabled={underReview || hasInvalidFinanceDetails(p)}
                      onClick={() => {
                        setSelectedFacturePaiement(p);
                        setShowFacture(true);
                      }}
                      title={isArabic ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture'}
                      aria-label={isArabic ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture'}
                    >
                      <FileText size={15} />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer disabled:opacity-40"
                      disabled={underReview || isReadOnly}
                      onClick={() => handleEditClick(p)}
                      title={isArabic ? 'تعديل الفاتورة' : 'Modifier la facture'}
                      aria-label={isArabic ? 'تعديل الفاتورة' : 'Modifier la facture'}
                    >
                      <Edit size={15} />
                    </button>
                    {reminderBlocked === null && canRemindParents && (
                      <>
                        {buildWhatsAppRelanceLink(p, enfant, isArabic) && (
                          <button
                            type="button"
                            disabled={reminderCheck.busy}
                            onClick={async (event) => {
                              event.stopPropagation();
                              const phone = findWhatsAppPhone(enfant);
                              const rawPhone = enfant?.parents.find(parent => normalizeAlgerianWhatsApp(parent.telephone) === phone)?.telephone;
                              const stored = dbPaiements.find(item => item.id === p.id);
                              if (phone && rawPhone && enfant && stored && reminderBlockReason(p, reminderState) === null && financialDataReady
                                && await reminderCheck.verify(stored, enfant, rawPhone)) {
                                setPreviewInvalidated(false);
                                setWhatsappPreview({
                                  invoiceId: p.id, invoiceSnapshot: JSON.stringify(stored), phone,
                                  childName: `${enfant.prenom} ${enfant.nom}`,
                                  message: buildWhatsAppRelanceMessage(p, enfant, isArabic),
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                            title={isArabic ? 'معاينة التذكير قبل فتح واتساب' : 'Prévisualiser avant WhatsApp'}
                            aria-label={isArabic ? 'معاينة التذكير قبل فتح واتساب' : 'Prévisualiser avant WhatsApp'}
                          >
                            <MessageCircle size={15} />
                            <span>WA</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={`inline-flex items-center rounded-xl border px-2.5 py-2 text-xs font-bold transition cursor-pointer ${
                            copiedPaiementId === p.id
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50'
                          }`}
                          disabled={reminderCheck.busy}
                          onClick={() => void handleCopyRelance(p, enfant)}
                          title={isArabic ? 'نسخ رسالة التذكير' : 'Copier une relance'}
                          aria-label={isArabic ? 'نسخ رسالة التذكير' : 'Copier une relance'}
                        >
                          <Copy size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-400">
              <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
              <p className="font-extrabold">{isArabic ? 'لا توجد فواتير مطابقة' : 'Aucun état de facturation disponible'}</p>
              {(searchTerm || filterStatut !== 'Tous') && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setFilterStatut('Tous'); }}
                  className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                >
                  {isArabic ? 'إعادة ضبط الفلاتر' : 'Réinitialiser les filtres'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <p className="px-4 pt-3 text-xs text-slate-500 xl:hidden">{isArabic ? 'مرر الجدول أفقياً لرؤية كل الأعمدة.' : 'Faites défiler le tableau horizontalement pour voir toutes les colonnes.'}</p>
        <div className="mobile-scroll-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" role="region" tabIndex={0} aria-label={isArabic ? 'جدول الفواتير' : 'Tableau des factures'}>
          <table className="min-w-[760px] w-full text-start border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-5">{isArabic ? 'الطفل' : 'Enfant'}</th>
                <th className="p-5">{isArabic ? 'النوع والفترة' : 'Type / Période'}</th>
                <th className="p-5">{isArabic ? 'القيمة' : 'Montant'}</th>
                <th className="p-5">{isArabic ? 'التفاصيل' : 'Mode / Échéance'}</th>
                <th className="p-5">{isArabic ? 'الوضعية' : 'Statut'}</th>
                <th className="p-5 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {filteredPaiements.length > 0 ? (
                filteredPaiements.map((p) => {
                  const enfant = enfantsData.find(e => e.id === p.enfantId);

                  const isQuickUpdating = quickUpdatingPaiementId === p.id;
                  const underReview = suspectedIds.has(p.id);
                  const reminderBlocked = reminderBlockReason(p, reminderState);
                  const isLateDisplay = p.statut === 'Retard';
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 transition cursor-pointer"
                      onClick={() => setSelectedPaiement(p)}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {enfant ? `${enfant.prenom[0] || ''}${enfant.nom[0] || ''}` : '??'}
                          </div>
                          <div>
                            {enfant ? (
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();
                                  setDossierEnfant(enfant);
                                }}
                                className="text-start text-slate-900 font-extrabold hover:text-indigo-600 hover:underline cursor-pointer"
                              >
                                {enfant.prenom} {enfant.nom}
                              </button>
                            ) : (
                              <p className="text-slate-900 font-extrabold">{isArabic ? 'الطفل غير متاح' : 'Enfant non disponible'}</p>
                            )}
                            <p className="text-xs text-slate-400 font-semibold">{enfant?.groupeAge || (isArabic ? 'غير محدد' : 'Non renseigné')}</p>
                            {underReview && <p className="mt-1 text-xs font-bold text-rose-700">{isArabic ? 'اشتباه تكرار قيد المراجعة' : 'Doublon suspect à vérifier'}</p>}
                            {reminderBlocked === 'period' && <p className="mt-1 text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: راجع الفترة' : 'Rappel suspendu : période à vérifier'}</p>}
                            {reminderBlocked === 'sibling-period' && <p className="mt-1 text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: فترة فاتورة أخرى للطفل تحتاج مراجعة' : 'Rappel suspendu : période d’une autre facture de l’enfant à vérifier'}</p>}
                            {reminderBlocked === 'details' && <p className="mt-1 text-xs font-bold text-amber-700">{isArabic ? 'التذكير معلّق: تحقق من المبلغ والحالة' : 'Rappel suspendu : montant ou statut à vérifier'}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="p-5 whitespace-nowrap text-slate-600 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-slate-900 leading-none">{displayPaymentPeriod(invoicePeriod(p))}</p>
                            {p.periodeCle && p.moisConcerne !== invoicePeriod(p) && <p className="mt-1 text-[10px] text-slate-500">{isArabic ? 'النص الأصلي' : 'Libellé original'} : {p.moisConcerne}</p>}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {typeof p.periodeCle === 'string' && p.periodeCle.startsWith('A:') ? (isArabic ? 'سنة ميلادية' : 'Année civile') : typeof p.periodeCle === 'string' && p.periodeCle.startsWith('M:') ? (isArabic ? 'شهري' : 'Mensuel') : p.typeFacture === 'Annuel' ? (isArabic ? 'سنوي (أصلي)' : 'Annuel (original)') : p.typeFacture === 'Mensuel' ? (isArabic ? 'شهري (أصلي)' : 'Mensuel (original)') : (isArabic ? 'غير محدد' : 'Non précisé')}
                            </span>
                          </div>
                        </span>
                      </td>

                      <td className="p-5 whitespace-nowrap">
                        <p className="text-slate-950 font-black">{typeof p.montant === 'number' && Number.isFinite(p.montant) ? formatCurrency(p.montant) : '—'}</p>
                        {p.statut !== 'Payé' && (paidSumByInvoiceId.get(p.id) || 0) > 0 && (
                          <p className="mt-0.5 text-[11px] font-bold text-emerald-700 tabular-nums">
                            {isArabic
                              ? `مدفوع ${formatCurrency(paidSumByInvoiceId.get(p.id) || 0)} · باقي ${formatCurrency(Math.max(0, (Number(p.montant) || 0) - (paidSumByInvoiceId.get(p.id) || 0)))}`
                              : `Versé ${formatCurrency(paidSumByInvoiceId.get(p.id) || 0)} · Reste ${formatCurrency(Math.max(0, (Number(p.montant) || 0) - (paidSumByInvoiceId.get(p.id) || 0)))}`}
                          </p>
                        )}
                        {p.reductionCode && p.reductionCode !== 'Aucun' && (
                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                            {p.reductionCode}
                          </span>
                        )}
                      </td>

                      <td className="p-5">
                        {p.statut === 'Payé' ? (
                          <div>
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{formatPaymentMethodLabel(p.moyenPaiement, isArabic)}</span>
                            </p>
                          </div>
                        ) : (
                          <p className={`text-xs font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 border ${
                            isLateDisplay
                              ? 'text-rose-600 bg-rose-50/60 border-rose-100'
                              : 'text-amber-700 bg-amber-50/60 border-amber-100'
                          }`}>
                            <Clock className={`w-3.5 h-3.5 shrink-0 ${isLateDisplay ? 'text-rose-500' : 'text-amber-500'}`} />
                            <span>{isArabic ? 'الاستحقاق' : 'Échéance'}: {p.dateEcheance || (isArabic ? 'غير محدد' : 'Non précisée')}</span>
                          </p>
                        )}
                      </td>

                      <td className="p-5" onClick={event => event.stopPropagation()}>
                        {p.statut === 'Annulé' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                            <Ban size={13} className="shrink-0" />
                            <span>{isArabic ? 'ملغاة' : 'Annulée'}</span>
                          </span>
                        ) : (
                          <select
                            value={paymentSelectionValue(p)}
                            disabled={isReadOnly || isQuickUpdating || underReview}
                            onChange={event => void handleQuickPaymentChange(p, event.target.value)}
                            aria-label={isArabic ? 'تعديل حالة الفاتورة وطريقة الدفع' : 'Modifier le statut et le moyen de règlement'}
                            className={`min-w-[156px] cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold leading-none outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            p.statut === 'Payé'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : p.statut === 'En attente'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {!['Payé','En attente','Retard'].includes(p.statut) && <option value={p.statut || ''} disabled>{isArabic ? 'حالة غير معروفة' : 'Statut inconnu'}{typeof p.statut === 'string' && p.statut ? ` : ${p.statut}` : ''}</option>}
                            {p.statut === 'Payé' && p.moyenPaiement && !(PAYMENT_METHODS as readonly string[]).includes(p.moyenPaiement) && <option value={`Payé:${p.moyenPaiement}`} disabled>{isArabic ? `مدفوعة — ${p.moyenPaiement}` : `Payé — ${p.moyenPaiement}`}</option>}
                            <option value="Payé:" disabled>{isArabic ? 'مدفوعة — الوسيلة غير محددة' : 'Payé — moyen non précisé'}</option>
                            <option value="En attente">{isArabic ? 'قيد الانتظار' : 'En attente'}</option>
                            <option value="Retard">{isArabic ? 'متأخرة' : 'En retard'}</option>
                            {PAYMENT_METHODS.map(method => <option key={method} value={`Payé:${method}`}>{isArabic ? `مدفوعة — ${formatPaymentMethodLabel(method, true)}` : `Payé — ${method}`}</option>)}
                          </select>
                        )}
                        {isQuickUpdating && <p className="mt-1 text-[10px] font-bold text-slate-400">{isArabic ? 'جارٍ الحفظ…' : 'Enregistrement…'}</p>}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {(p.statut === 'Payé' || (paidSumByInvoiceId.get(p.id) || 0) > 0) && p.statut !== 'Annulé' && (
                            <button
                              type="button"
                              className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition cursor-pointer disabled:opacity-40"
                              disabled={underReview || hasInvalidFinanceDetails(p)}
                              onClick={() => void handleOpenReceiptPdf(p)}
                              title={isArabic ? 'وصل الدفع PDF' : 'Reçu de paiement PDF'}
                              aria-label={isArabic ? 'وصل الدفع PDF' : 'Reçu de paiement PDF'}
                            >
                              <Receipt className="h-4 w-4 shrink-0" />
                            </button>
                          )}
                          {canRecordInstallments && p.statut !== 'Annulé' && (
                            <button
                              type="button"
                              className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition cursor-pointer disabled:opacity-40"
                              disabled={underReview || hasInvalidFinanceDetails(p)}
                              onClick={() => setInstallmentTarget(p)}
                              title={isArabic ? 'تسجيل دفعة جزئية أو وصل' : 'Enregistrer un acompte / bon de versement'}
                              aria-label={isArabic ? 'تسجيل دفعة جزئية أو وصل' : 'Enregistrer un acompte / bon de versement'}
                            >
                              <Wallet className="h-4 w-4 shrink-0" />
                            </button>
                          )}

                          <button
                            type="button"
                            className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer disabled:opacity-40"
                            disabled={underReview || hasInvalidFinanceDetails(p)}
                            onClick={() => {
                              setSelectedFacturePaiement(p);
                              setShowFacture(true);
                            }}
                            title={isArabic ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture'}
                            aria-label={isArabic ? 'عرض بيان الفاتورة' : 'Voir l’état de la facture'}
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                          </button>

                          {/* BOUTON MODIFIER */}
                          <button
                            type="button"
                            className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50/70 text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition cursor-pointer disabled:opacity-40"
                            disabled={underReview || isReadOnly}
                            onClick={() => handleEditClick(p)}
                            title={isArabic ? 'تعديل الفاتورة' : 'Modifier la facture'}
                            aria-label={isArabic ? 'تعديل الفاتورة' : 'Modifier la facture'}
                          >
                            <Edit className="h-4 w-4 shrink-0" />
                          </button>

                          {reminderBlocked === null && canRemindParents && (
                            <>
                              {buildWhatsAppRelanceLink(p, enfant, isArabic) && (
                                <button
                                  type="button"
                                  disabled={reminderCheck.busy}
                                  onClick={async (event) => {
                                    event.stopPropagation();
                                    const phone = findWhatsAppPhone(enfant);
                                    const rawPhone = enfant?.parents.find(parent => normalizeAlgerianWhatsApp(parent.telephone) === phone)?.telephone;
                                    const stored = dbPaiements.find(item => item.id === p.id);
                                    if (phone && rawPhone && enfant && stored && reminderBlockReason(p, reminderState) === null && financialDataReady
                                      && await reminderCheck.verify(stored, enfant, rawPhone)) {
                                      setPreviewInvalidated(false);
                                      setWhatsappPreview({
                                        invoiceId: p.id, invoiceSnapshot: JSON.stringify(stored), phone,
                                        childName: `${enfant.prenom} ${enfant.nom}`,
                                        message: buildWhatsAppRelanceMessage(p, enfant, isArabic),
                                      });
                                    }
                                  }}
                                  className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 cursor-pointer disabled:opacity-40"
                                  title={isArabic ? 'معاينة التذكير قبل فتح واتساب' : 'Prévisualiser avant WhatsApp'}
                                  aria-label={isArabic ? 'معاينة التذكير قبل فتح واتساب' : 'Prévisualiser avant WhatsApp'}
                                >
                                  <MessageCircle className="h-4 w-4 shrink-0" />
                                </button>
                              )}
                              <button
                                type="button"
                                className={`min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border transition cursor-pointer disabled:opacity-40 ${copiedPaiementId === p.id ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50'}`}
                                disabled={reminderCheck.busy}
                                onClick={() => void handleCopyRelance(p, enfant)}
                                title={isArabic ? 'نسخ رسالة التذكير' : 'Copier une relance'}
                                aria-label={isArabic ? 'نسخ رسالة التذكير' : 'Copier une relance'}
                              >
                                <Copy className="h-4 w-4 shrink-0" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                    <p className="font-extrabold">{isArabic ? 'لا توجد فواتير مطابقة' : 'Aucun état de facturation disponible'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(searchTerm || filterStatut !== 'Tous')
                        ? (isArabic ? 'عدّل معايير البحث أو الفلترة لعرض الفواتير.' : 'Modifiez la recherche ou le filtre de statut pour afficher les factures.')
                        : (isArabic ? 'اضغط على إصدار فاتورة للبدء.' : 'Engagez une nouvelle facturation en cliquant sur le bouton d\'émission.')}
                    </p>
                    {(searchTerm || filterStatut !== 'Tous') && (
                      <button
                        type="button"
                        onClick={() => { setSearchTerm(''); setFilterStatut('Tous'); }}
                        className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                      >
                        {isArabic ? 'إعادة ضبط الفلاتر' : 'Réinitialiser les filtres'}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {reminderCheck.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-900">{reminderCheck.error}</p>}
      {reminderCheck.busy && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-xs font-bold text-indigo-900">{isArabic ? 'جارٍ التحقق من البيانات…' : 'Vérification préalable en cours…'}</p>}
      {previewInvalidated && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">{isArabic ? 'أُغلقت المعاينة لأن البيانات المحلية تغيرت أو أصبحت غير متاحة. أعد التحميل والتحقق قبل إعداد رسالة جديدة.' : 'Aperçu fermé : les données locales ont changé ou sont indisponibles. Rechargez et vérifiez avant de préparer un nouveau message.'}</p>}
      {whatsappPreview && previewCurrent && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setWhatsappPreview(null)}>
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"
            dir={isArabic ? 'rtl' : 'ltr'}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{isArabic ? 'مراجعة قبل واتساب' : 'Aperçu avant WhatsApp'}</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">{isArabic ? `رسالة إلى ${whatsappPreview.childName}` : `Message pour ${whatsappPreview.childName}`}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">{whatsappPreview.phone}</p>
              </div>
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={isArabic ? 'إغلاق' : 'Fermer'}><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-xs font-bold text-amber-800">{isArabic ? 'التحقق لحظي وقد تتغير البيانات بعده من جهاز آخر. راجع الفاتورة والتحصيل قبل التواصل؛ واتساب خدمة خارجية.' : 'La vérification est ponctuelle : un autre appareil peut modifier les données ensuite. Vérifiez la facture et les encaissements avant de contacter la famille ; WhatsApp est un service externe.'}</p>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{whatsappPreview.message}</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">{isArabic ? 'إلغاء' : 'Annuler'}</button>
              <a
                href={`https://wa.me/${whatsappPreview.phone}?text=${encodeURIComponent(whatsappPreview.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsappPreview(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />{isArabic ? 'فتح واتساب' : 'Ouvrir WhatsApp'}
              </a>
            </div>
          </motion.div>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{isArabic ? 'الحالة المسجلة ليست إثباتاً للدفع؛ راجع الوثائق وأعد تحميل البيانات قبل أي تذكير أو نسخ. توليد الفواتير تلقائياً وحذفها متوقفان. يجب مراجعة الفواتير القديمة للطفل قبل إنشاء فاتورة جديدة؛ الفواتير المتعارضة تحتاج معالجة منفصلة لم تكتمل بعد. الفترات الجديدة شهرية أو حسب السنة الميلادية.' : 'Les statuts enregistrés ne prouvent pas un encaissement ; vérifiez les pièces et rechargez les données avant toute relance ou copie. La génération automatique et la suppression sont suspendues. Les factures anciennes doivent être rapprochées avant toute nouvelle création pour l’enfant ; le traitement des doublons reste à construire. Les nouvelles périodes utilisent le mois ou l’année civile.'}</div>
      {/* Modal Ajout & Edition */}
      <AnimatePresence>
        {showModal && (
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 pt-2 sm:pt-4 cursor-pointer overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (savingRef.current) return;
              setShowModal(false);
              setEditingPaiementId(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="mobile-safe-modal bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[calc(100dvh-1rem)] mt-0 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center gap-3 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">
                    {editingPaiementId
                      ? (isArabic ? 'تعديل تفاصيل الفاتورة' : 'Modifier la Facture')
                      : (isArabic ? 'إصدار فاتورة جديدة' : 'Création de Facture')
                    }
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    {isArabic ? 'أدخل المبلغ النهائي يدوياً؛ لا يتم حساب الخصومات تلقائياً.' : 'Saisissez le montant final : les remises ne sont pas calculées automatiquement.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                  onClick={() => {
                    if (savingRef.current) return;
                    setShowModal(false);
                    setEditingPaiementId(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Type de Facturation (Mensuel / Annuel) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'نوع الفاتورة *' : 'Type de Facturation *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'Mensuel', label: isArabic ? 'شهري' : 'Mensuelle' },
                      { key: 'Annuel', label: isArabic ? 'سنوي (السنة الميلادية)' : 'Annuelle (année civile)' }
                    ].map(type => (
                      <button
                        key={type.key}
                        type="button"
                        disabled={!!editingPaiementId}
                        onClick={() => {
                          const isAnnuel = type.key === 'Annuel';
                          setFormData({
                            ...formData,
                            typeFacture: type.key as any,
                            montant: isAnnuel ? 0 : (creche?.tuitionFeeRate ?? 0),
                            moisConcerne: isAnnuel
                              ? String(today.getFullYear())
                              : currentMonthLabel
                          });
                        }}
                        className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center disabled:cursor-not-allowed disabled:opacity-60 ${
                          formData.typeFacture === type.key
                            ? 'bg-indigo-600 text-white border-transparent'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choix de l'enfant */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'الطفل المستفيد *' : 'Sélectionner l\'Enfant Récepteur *'}
                  </label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800 disabled:opacity-70"
                    value={formData.enfantId}
                    disabled={!!editingPaiementId}
                    onChange={e => setFormData({...formData, enfantId: e.target.value})}
                  >
                    <option value="">{isArabic ? 'اختر الطفل' : 'Choisir un enfant'}</option>
                    {enfantsData.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                  </select>
                </div>

                {/* Montant & Période */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'مبلغ الفاتورة (دج) *' : 'Montant Principal (DZD) *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder={isArabic ? 'مثال: 12000' : 'Ex. : 12000'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800"
                      value={formData.montant || ''}
                      onChange={e => setFormData({...formData, montant: Number(e.target.value) || 0})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {formData.typeFacture === 'Annuel'
                        ? (isArabic ? 'السنة الميلادية المعنية *' : 'Année civile concernée *')
                        : (isArabic ? 'الشهر المعني *' : 'Période Facturée (Mois) *')
                      }
                    </label>
                    <input type={!editingPaiementId && formData.typeFacture === 'Mensuel' ? 'month' : 'text'} placeholder={formData.typeFacture === 'Annuel' ? 'AAAA' : 'AAAA-MM'} disabled={!!editingPaiementId} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold disabled:opacity-70" value={formData.moisConcerne} onChange={e => setFormData({...formData, moisConcerne: e.target.value})} />
                    {editingPaiementId && <p className="mt-1 text-xs text-slate-500">{isArabic ? 'لا يمكن تعديل الطفل والفترة لحماية التاريخ.' : 'Enfant et période non modifiables pour protéger l’historique.'}</p>}
                  </div>
                </div>

                {/* Choix du statut */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'حالة الفاتورة المصرّح بها *' : 'Statut d\'Émission *'}
                  </label>
                  <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2">
                    {[
                      { key: 'Payé', label: isArabic ? 'مسجلة مدفوعة' : 'Déjà Réglé', activeBg: 'bg-emerald-600 text-white border-transparent' },
                      { key: 'En attente', label: isArabic ? 'قيد الانتظار' : 'En attente', activeBg: 'bg-amber-500 text-white border-transparent' },
                      { key: 'Retard', label: isArabic ? 'متأخرة' : 'En Retard', activeBg: 'bg-rose-600 text-white border-transparent' }
                    ].map(status => (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => {
                          const nextStatut = status.key as 'Payé' | 'En attente' | 'Retard';
                          setFormError('');
                          setFormData({
                            ...formData,
                            statut: nextStatut,
                            moyenPaiement: nextStatut === 'Payé' ? formData.moyenPaiement : '',
                          });
                        }}
                        className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          formData.statut === status.key
                            ? status.activeBg
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remise & Mode de règlement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <p className="rounded-xl bg-amber-50/80 border border-amber-100 p-3 text-xs font-medium text-amber-800">
                    {isArabic ? 'أدخل المبلغ النهائي يدوياً؛ لا يتم حساب الخصومات أو الدفعات الجزئية تلقائياً.' : 'Saisissez le montant final manuellement ; aucune remise ni paiement partiel n’est calculé automatiquement.'}
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {formData.statut === 'Payé'
                        ? (isArabic ? 'وسيلة الدفع المصرّح بها *' : 'Mode de règlement déclaré *')
                        : (isArabic ? 'وسيلة الدفع (عند التسديد)' : 'Mode de règlement (si payé)')}
                    </label>
                    <select
                      disabled={formData.statut !== 'Payé'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.moyenPaiement}
                      onChange={e => {
                        setFormError('');
                        setFormData({...formData, moyenPaiement: e.target.value as any});
                      }}
                    >
                      <option value="">{formData.statut === 'Payé' ? (isArabic ? 'اختر وسيلة الدفع' : 'Choisir un mode') : (isArabic ? 'غير مطبق قبل الدفع' : 'Non applicable avant règlement')}</option>
                      {PAYMENT_METHODS.map(method => (
                        <option key={method} value={method}>
                          {formatPaymentMethodLabel(method, isArabic)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date d'échéance & Notes */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {isArabic ? 'تاريخ استحقاق الفاتورة' : 'Date limite de paiement'}
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.dateEcheance}
                      onChange={e => setFormData({...formData, dateEcheance: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      {isArabic ? 'ملاحظات إضافية' : 'Notes administratives'}
                    </label>
                    <input
                      type="text"
                      placeholder={isArabic ? 'مرجع التحويل أو رقم الشيك أو ملاحظة داخلية...' : 'Référence de virement, n° de chèque ou note interne...'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

              </div>

              {editingOutdated && <p role="alert" className="mx-6 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{isArabic ? 'تغيرت الفاتورة أو أصبحت مرتبطة باشتباه. أغلق النموذج وراجع البيانات قبل إعادة فتحه.' : 'La facture a changé ou est liée à un soupçon. Fermez ce formulaire et vérifiez les données avant de le rouvrir.'}</p>}
              {formError && <p role="alert" className="mx-6 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{formError}</p>}
              {/* Pied de page actions */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  disabled={saving}
                  onClick={() => {
                    if (savingRef.current) return;
                    setShowModal(false);
                    setEditingPaiementId(null);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md disabled:opacity-50"
                  disabled={saving || !financialDataReady || editingOutdated || isReadOnly}
                  onClick={() => void handleAjouterOuModifier()}
                >
                  {editingPaiementId ? (isArabic ? 'حفظ التعديلات' : 'Enregistrer les modifications') : t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fiche détaillée de la facture (au clic sur une ligne) */}
      <AnimatePresence>
        {selectedPaiement && (() => {
          const enfant = enfantsData.find(e => e.id === selectedPaiement.enfantId);
          const reductionStr = selectedPaiement.reductionCode && selectedPaiement.reductionCode !== 'Aucun' ? selectedPaiement.reductionCode : null;
          const selectedUnderReview = suspectedIds.has(selectedPaiement.id);
          const selectedInvalidDetails = hasInvalidFinanceDetails(selectedPaiement);

          return (
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 pt-2 sm:pt-4 cursor-pointer overflow-y-auto"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedPaiement(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="mobile-safe-modal bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[calc(100dvh-1rem)] mt-0 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-6 bg-slate-50 border-b border-dashed border-slate-200 text-slate-800 relative flex-shrink-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{isArabic ? 'بيان الفاتورة — ليس إثبات دفع' : 'ÉTAT DE FACTURE — PAS UN JUSTIFICATIF'}</span>
                      <h4 className="text-lg font-black text-slate-900 mt-1 break-all">
                        {isArabic ? `المعرّف: ${selectedPaiement.id || '—'}` : `Réf. ${selectedPaiement.id || '—'}`}
                      </h4>
                    </div>
                    <button
                      type="button"
                      aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                      onClick={() => setSelectedPaiement(null)}
                      className="p-1.5 rounded-lg bg-slate-200/50 hover:bg-slate-200/80 text-slate-500 transition cursor-pointer shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-slate-950 rounded-full" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-slate-950 rounded-full" />
                </div>

                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2">{isArabic ? 'الطفل والقسم' : 'Bénéficiaire / Élève'}</span>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                        {enfant ? `${enfant.prenom[0] || ''}${enfant.nom[0] || ''}` : '??'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 leading-none break-words">
                          {enfant ? `${enfant.prenom} ${enfant.nom}` : (isArabic ? 'الطفل غير متاح' : 'Enfant non disponible')}
                        </p>
                        <p className="text-[11px] text-slate-500 font-bold mt-1">
                          {isArabic ? 'القسم' : 'Groupe d’âge'} : {enfant?.groupeAge || (isArabic ? 'غير محدد' : 'Non renseigné')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-slate-100 py-4 text-xs font-bold text-slate-500">
                    <div className="flex justify-between gap-2">
                      <span>{isArabic ? 'النوع الأصلي المسجل' : 'Type original enregistré'}:</span>
                      <span className="text-slate-800 font-extrabold text-end">
                        {selectedPaiement.typeFacture === 'Annuel' ? (isArabic ? 'سنوي' : 'Annuel') : selectedPaiement.typeFacture === 'Mensuel' ? (isArabic ? 'شهري' : 'Mensuel') : (isArabic ? 'غير محدد' : 'Non précisé')}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>{isArabic ? 'الفترة المعنية' : 'Période administrative'}:</span>
                      <span className="text-slate-800 font-extrabold text-end">{displayPaymentPeriod(invoicePeriod(selectedPaiement))}</span>
                    </div>
                    {reductionStr && (
                      <div className="flex justify-between gap-2 text-indigo-600">
                        <span>{isArabic ? 'وصف الخصم المسجل' : 'Libellé de remise enregistré'}:</span><span className="text-end">{reductionStr}</span>
                      </div>
                    )}
                    <p className="text-xs text-amber-700">{isArabic ? 'الخصم غير محسوب آلياً؛ تحقق من المبلغ المسجل.' : 'Remise non calculée automatiquement ; vérifiez le montant enregistré.'}</p>
                    <div className="flex justify-between gap-2 text-slate-800 text-sm font-black pt-3 border-t border-dashed border-slate-200">
                      <span>{isArabic ? 'المبلغ المسجل' : 'Montant enregistré'}:</span>
                      <span className="text-indigo-600 text-base text-end">{typeof selectedPaiement.montant === 'number' && Number.isFinite(selectedPaiement.montant) ? formatCurrency(selectedPaiement.montant) : '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'وسيلة الدفع المصرّح بها' : 'Mode déclaré'}</span>
                      <span className="font-extrabold text-slate-800">{formatPaymentMethodLabel(selectedPaiement.moyenPaiement, isArabic)}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'تاريخ الاستحقاق' : 'Date limite'}</span>
                      <span className="font-extrabold text-slate-800">{selectedPaiement.dateEcheance || (isArabic ? 'غير محدد' : 'Non précisée')}</span>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <span className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest leading-none border shadow-xs ${
                      selectedPaiement.statut === 'Payé'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedPaiement.statut === 'En attente'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        selectedPaiement.statut === 'Payé' ? 'bg-emerald-500' : selectedPaiement.statut === 'En attente' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      {selectedPaiement.statut === 'Payé'
                        ? (isArabic ? 'مسجلة بحالة مدفوعة' : 'STATUT ENREGISTRÉ : PAYÉ')
                        : formatInvoiceStatusLabel(selectedPaiement.statut, isArabic)}
                    </span>
                  </div>

                  {selectedPaiement.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-500 italic text-center break-words">
                      « {selectedPaiement.notes} »
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap justify-end gap-2 flex-shrink-0">
                  {selectedPaiement.statut !== 'Annulé' && (selectedPaiement.statut === 'Payé' || (paidSumByInvoiceId.get(selectedPaiement.id) || 0) > 0) && (
                    <button
                      type="button"
                      disabled={selectedUnderReview || selectedInvalidDetails}
                      onClick={() => {
                        const target = selectedPaiement;
                        setSelectedPaiement(null);
                        void handleOpenReceiptPdf(target);
                      }}
                      className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 whitespace-nowrap transition hover:bg-emerald-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Receipt size={14} />
                      <span>{isArabic ? 'وصل PDF' : 'Reçu PDF'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={selectedUnderReview || selectedInvalidDetails}
                    onClick={() => {
                      const target = selectedPaiement;
                      setSelectedPaiement(null);
                      setSelectedFacturePaiement(target);
                      setShowFacture(true);
                    }}
                    className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 whitespace-nowrap transition hover:bg-indigo-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileText size={14} />
                    <span>{isArabic ? 'طباعة / PDF' : 'Imprimer / PDF'}</span>
                  </button>
                  {selectedPaiement.statut !== 'Annulé' && typeof invoiceReviewAction === 'function' && (
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => {
                        const target = selectedPaiement;
                        setSelectedPaiement(null);
                        setCancelReason('');
                        setCancelTarget(target);
                      }}
                      className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 whitespace-nowrap transition hover:bg-rose-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Ban size={14} />
                      <span>{isArabic ? 'إلغاء' : 'Annuler'}</span>
                    </button>
                  )}
                  {selectedPaiement.statut !== 'Annulé' && (
                    <button
                      type="button"
                      disabled={selectedUnderReview || isReadOnly}
                      onClick={() => {
                        const target = selectedPaiement;
                        setSelectedPaiement(null);
                        handleEditClick(target);
                      }}
                      className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 whitespace-nowrap transition hover:bg-amber-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Edit size={14} />
                      <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPaiement(null)}
                    className="min-h-9! rounded-xl bg-slate-200/80 px-4 py-2 text-xs font-bold text-slate-700 whitespace-nowrap transition hover:bg-slate-300/80 cursor-pointer"
                  >
                    {isArabic ? 'إغلاق' : 'Fermer'}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal d'Affichage & Impression de la Facture PDF */}
      {showFacture && selectedFacturePaiement && (
        <Facture
          paiement={selectedFacturePaiement}
          enfant={enfantsData.find(e => e.id === selectedFacturePaiement.enfantId)}
          onClose={() => {
            setShowFacture(false);
            setSelectedFacturePaiement(null);
          }}
        />
      )}

      <BatchMonthlyInvoicesModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        enfants={enfantsData}
        paiements={dbPaiements}
        defaultFeeRate={creche?.tuitionFeeRate ?? 0}
        defaultMonth={currentMonthLabel}
        isReadOnly={isReadOnly}
        addPaiement={addPaiement}
      />

      {dossierEnfant && (
        <EnfantDetails
          enfant={enfantsData.find(e => e.id === dossierEnfant.id) || dossierEnfant}
          onClose={() => setDossierEnfant(null)}
        />
      )}

      {installmentTarget && (
        <InvoiceInstallmentsModal
          paiement={paiements.find(item => item.id === installmentTarget.id) || installmentTarget}
          enfant={enfantsData.find(e => e.id === installmentTarget.enfantId)}
          creche={creche}
          installments={installmentsByInvoice.get(installmentTarget.id) || []}
          readOnly={isReadOnly}
          recordedBy={activeProfile?.name}
          isArabic={isArabic}
          onAddInstallment={addInstallment}
          onRemoveInstallment={removeInstallment}
          onCompleteInvoice={async (finalMethod) => {
            const stored = dbPaiements.find(item => item.id === installmentTarget.id);
            if (!stored || stored.statut === 'Payé') return;
            await updatePaiement(
              stored.id,
              {
                montant: stored.montant,
                statut: 'Payé',
                moyenPaiement: finalMethod,
                dateEcheance: stored.dateEcheance || null,
                notes: stored.notes || null,
              },
              stored
            );
          }}
          onClose={() => setInstallmentTarget(null)}
        />
      )}
      {receiptViewerSource && (
        <InAppPdfViewerModal
          documentSource={receiptViewerSource}
          isArabic={isArabic}
          onClose={() => setReceiptViewerSource(null)}
        />
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center bg-slate-950/65 p-0 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          dir={isArabic ? 'rtl' : 'ltr'}
          onClick={() => !cancellingInvoice && setCancelTarget(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-black text-slate-900">
                {isArabic ? 'إلغاء الفاتورة محاسبياً' : 'Annuler cette facture'}
              </h3>
              <button
                type="button"
                disabled={cancellingInvoice}
                onClick={() => setCancelTarget(null)}
                aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                className="min-h-8! rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              {isArabic
                ? 'تُستبعد الفاتورة من المجاميع مع حفظ أثرها في السجل.'
                : 'La facture sort des totaux tout en restant tracée dans l’historique.'}
            </p>
            <label className="block text-xs font-bold text-slate-700">
              {isArabic ? 'سبب الإلغاء *' : 'Motif de l’annulation *'}
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value.slice(0, 300))}
                placeholder={isArabic ? 'مثال: خطأ في المبلغ أو فاتورة مكررة' : 'Ex : erreur de montant ou doublon'}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-rose-500 focus:bg-white"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={cancellingInvoice}
                onClick={() => setCancelTarget(null)}
                className="min-h-9! rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 whitespace-nowrap cursor-pointer"
              >
                {isArabic ? 'تراجع' : 'Fermer'}
              </button>
              <button
                type="button"
                disabled={cancellingInvoice || !cancelReason.trim()}
                onClick={() => void handleConfirmCancelInvoice()}
                className="min-h-9! inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-black text-white whitespace-nowrap transition disabled:opacity-40 cursor-pointer"
              >
                <Ban size={14} />
                <span>{cancellingInvoice ? (isArabic ? 'جارٍ الحفظ…' : 'Annulation…') : (isArabic ? 'تأكيد الإلغاء' : 'Confirmer l’annulation')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
