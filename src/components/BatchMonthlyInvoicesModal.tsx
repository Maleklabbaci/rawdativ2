import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Sparkles, Users, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import type { Enfant, Paiement } from '../types';
import { financeErrorMessage } from '../utils/financeError';
import { localizeInvoicePeriodText, suspectedInvoiceIds } from '../utils/financePeriod';
import { formatCurrency } from '../utils/format';

interface BatchMonthlyInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  enfants: Enfant[];
  paiements: Paiement[];
  defaultFeeRate: number;
  defaultMonth: string;
  isReadOnly: boolean;
  addPaiement: (paiement: Omit<Paiement, 'id'>) => Promise<unknown>;
}

export default function BatchMonthlyInvoicesModal({
  isOpen,
  onClose,
  enfants,
  paiements,
  defaultFeeRate,
  defaultMonth,
  isReadOnly,
  addPaiement,
}: BatchMonthlyInvoicesModalProps) {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === 'ar';

  const [month, setMonth] = useState(defaultMonth);
  const [dueDate, setDueDate] = useState('');
  const [baseAmount, setBaseAmount] = useState(() => (defaultFeeRate > 0 ? String(defaultFeeRate) : ''));
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchReport, setBatchReport] = useState<{
    created: number;
    failures: Array<{ childName: string; message: string }>;
  } | null>(null);

  const suspected = useMemo(() => suspectedInvoiceIds(paiements), [paiements]);
  const activeChildren = useMemo(() => enfants.filter(child => child.statut === 'Actif'), [enfants]);

  const classified = useMemo(() => {
    const year = month.slice(0, 4);
    return activeChildren.map(child => {
      const childInvoices = paiements.filter(inv => inv.enfantId === child.id && inv.statut !== 'Annulé');
      const hasUnreviewedPeriod = childInvoices.some(inv => !inv.periodeCle);
      const hasSuspect = childInvoices.some(inv => suspected.has(inv.id));
      const alreadyExists = childInvoices.some(
        inv =>
          inv.periodeCle === `M:${month}` ||
          (year.length === 4 && inv.periodeCle === `A:${year}`) ||
          inv.moisConcerne === month
      );
      if (alreadyExists) {
        return { child, state: 'covered' as const, reason: isArabic ? 'فاتورة موجودة مسبقاً' : 'Facture déjà créée' };
      }
      if (hasSuspect || hasUnreviewedPeriod) {
        return {
          child,
          state: 'blocked' as const,
          reason: hasSuspect
            ? isArabic
              ? 'اشتباه تكرار قيد المراجعة'
              : 'Doublon suspect à vérifier d’abord'
            : isArabic
            ? 'فاتورة سابقة تحتاج تأكيد الفترة'
            : 'Ancienne facture à rapprocher d’abord',
        };
      }
      return { child, state: 'ready' as const, reason: '' };
    });
  }, [activeChildren, isArabic, month, paiements, suspected]);

  useEffect(() => {
    if (!isOpen) return;
    setMonth(defaultMonth);
    setDueDate('');
    const initialAmount = defaultFeeRate > 0 ? String(defaultFeeRate) : '';
    setBaseAmount(initialAmount);
    setBatchReport(null);
    setProgress(null);
  }, [defaultFeeRate, defaultMonth, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const nextSelected: Record<string, boolean> = {};
    const nextAmounts: Record<string, string> = {};
    for (const item of classified) {
      if (item.state === 'ready') {
        nextSelected[item.child.id] = true;
        nextAmounts[item.child.id] = customAmounts[item.child.id] ?? (defaultFeeRate > 0 ? String(defaultFeeRate) : '');
      }
    }
    setSelectedIds(nextSelected);
    setCustomAmounts(prev => ({ ...nextAmounts, ...prev }));
    // Recompute selection when month or child eligibility changes while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, month, activeChildren.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !runningRef.current) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const readyItems = classified.filter(item => item.state === 'ready');
  const chosenReady = readyItems.filter(item => selectedIds[item.child.id]);

  const applyBaseAmountToSelected = () => {
    const trimmed = baseAmount.trim();
    if (!trimmed) return;
    setCustomAmounts(prev => {
      const updated = { ...prev };
      for (const item of readyItems) {
        if (selectedIds[item.child.id]) updated[item.child.id] = trimmed;
      }
      return updated;
    });
  };

  const totalPreviewAmount = chosenReady.reduce((sum, item) => {
    const val = Number(customAmounts[item.child.id] ?? baseAmount);
    return Number.isFinite(val) && val > 0 ? sum + val : sum;
  }, 0);

  const handleGenerateBatch = async () => {
    if (runningRef.current || isReadOnly) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) {
      showToast(isArabic ? 'يرجى اختيار شهر صحيح.' : 'Veuillez choisir un mois valide (AAAA-MM).', 'error');
      return;
    }
    if (chosenReady.length === 0) {
      showToast(isArabic ? 'اختر طفلاً واحداً على الأقل.' : 'Sélectionnez au moins un enfant à facturer.', 'error');
      return;
    }
    for (const item of chosenReady) {
      const amount = Number(customAmounts[item.child.id] ?? baseAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast(
          isArabic
            ? `أدخل مبلغاً صحيحاً للطفل ${item.child.prenom} ${item.child.nom}.`
            : `Renseignez un montant supérieur à 0 DA pour ${item.child.prenom} ${item.child.nom}.`,
          'error'
        );
        return;
      }
    }

    runningRef.current = true;
    setRunning(true);
    setBatchReport(null);
    setProgress({ done: 0, total: chosenReady.length });

    let created = 0;
    const failures: Array<{ childName: string; message: string }> = [];

    try {
      for (let i = 0; i < chosenReady.length; i++) {
        const { child } = chosenReady[i];
        const amount = Number(customAmounts[child.id] ?? baseAmount);
        try {
          await addPaiement({
            enfantId: child.id,
            montant: amount,
            statut: 'En attente',
            typeFacture: 'Mensuel',
            moisConcerne: month,
            periodeCle: `M:${month}`,
            ...(dueDate ? { dateEcheance: dueDate } : {}),
          });
          created++;
        } catch (error) {
          failures.push({
            childName: `${child.prenom} ${child.nom}`,
            message: financeErrorMessage(error, isArabic),
          });
        }
        setProgress({ done: i + 1, total: chosenReady.length });
      }

      if (failures.length === 0) {
        showToast(
          isArabic
            ? `تم إنشاء ${created} فاتورة لشهر ${localizeInvoicePeriodText(month, true)}.`
            : `${created} facture(s) préparée(s) pour ${localizeInvoicePeriodText(month, false)}.`,
          'success'
        );
        onClose();
      } else {
        setBatchReport({ created, failures });
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={isArabic ? 'تحضير فواتير الشهر دفعة واحدة' : 'Préparer les factures du mois'}
      className="fixed inset-0 z-[1050] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 pt-3 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={() => {
        if (!runningRef.current) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-indigo-600 to-cyan-600 p-4 sm:p-5 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">
              {isArabic ? 'تحضير جماعي سريع وآمن' : 'Gain de temps · Sans doublon'}
            </p>
            <h2 className="mt-0.5 text-lg sm:text-xl font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0" />
              {isArabic ? 'تحضير فواتير الشهر دفعة واحدة' : 'Préparer les factures du mois'}
            </h2>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق' : 'Fermer'}
            className="rounded-xl bg-white/15 p-2 text-white hover:bg-white/25 transition cursor-pointer disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-bold text-slate-600">
              <span className="mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                {isArabic ? 'الشهر المعني *' : 'Mois à facturer *'}
              </span>
              <input
                type="month"
                disabled={running}
                value={month}
                onChange={event => setMonth(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </label>

            <label className="block text-xs font-bold text-slate-600">
              <span className="mb-1 block">{isArabic ? 'المبلغ الافتراضي (د.ج) *' : 'Tarif mensuel appliqué (DA) *'}</span>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  disabled={running}
                  value={baseAmount}
                  onChange={event => setBaseAmount(event.target.value)}
                  placeholder={isArabic ? 'أدخل المبلغ' : 'Ex: 12000'}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-black text-slate-900 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={running || !baseAmount.trim()}
                  onClick={applyBaseAmountToSelected}
                  className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100 cursor-pointer disabled:opacity-40"
                >
                  {isArabic ? 'تطبيق' : 'Appliquer'}
                </button>
              </div>
            </label>

            <label className="block text-xs font-bold text-slate-600">
              <span className="mb-1 block">{isArabic ? 'تاريخ الاستحقاق (اختياري)' : 'Échéance (facultatif)'}</span>
              <input
                type="date"
                disabled={running}
                value={dueDate}
                onChange={event => setDueDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-600" />
              {isArabic
                ? `${chosenReady.length} طفل محدد من أصل ${activeChildren.length} طفل نشط`
                : `${chosenReady.length} enfant(s) sélectionné(s) sur ${activeChildren.length} actif(s)`}
            </span>
            <div className="flex items-center gap-2">
              {readyItems.length > 0 && (
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    const allSelected = chosenReady.length === readyItems.length;
                    const next: Record<string, boolean> = {};
                    for (const item of readyItems) next[item.child.id] = !allSelected;
                    setSelectedIds(next);
                  }}
                  className="text-indigo-600 underline cursor-pointer"
                >
                  {chosenReady.length === readyItems.length
                    ? isArabic
                      ? 'إلغاء تحديد الكل'
                      : 'Tout décocher'
                    : isArabic
                    ? 'تحديد الكل'
                    : 'Tout cocher'}
                </button>
              )}
              <span className="rounded-lg bg-white px-2.5 py-1 font-black text-indigo-700 border border-slate-200">
                {formatCurrency(totalPreviewAmount)}
              </span>
            </div>
          </div>

          {batchReport && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs space-y-1.5">
              <p className="font-black text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                {isArabic
                  ? `تم إنشاء ${batchReport.created} فاتورة، وتعذّر إنشاء ${batchReport.failures.length}:`
                  : `${batchReport.created} facture(s) créée(s), ${batchReport.failures.length} non confirmée(s) :`}
              </p>
              <ul className="list-disc ps-5 space-y-0.5 text-amber-900 font-semibold">
                {batchReport.failures.map((item, idx) => (
                  <li key={idx}>
                    <strong>{item.childName}</strong> : {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {classified.length === 0 ? (
              <p className="p-6 text-center text-xs font-bold text-slate-400">
                {isArabic ? 'لا يوجد أطفال نشطون حالياً.' : 'Aucun enfant actif à facturer.'}
              </p>
            ) : (
              classified.map(({ child, state, reason }) => {
                const isReady = state === 'ready';
                const checked = Boolean(selectedIds[child.id]) && isReady;
                return (
                  <div
                    key={child.id}
                    className={`flex flex-wrap items-center justify-between gap-2.5 p-3 text-xs ${
                      isReady ? '' : 'bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isReady || running}
                        checked={checked}
                        onChange={event =>
                          setSelectedIds(prev => ({ ...prev, [child.id]: event.target.checked }))
                        }
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-slate-900">
                          {child.prenom} {child.nom}
                        </p>
                        <p className="truncate text-[11px] font-semibold text-slate-400">
                          {child.groupeAge}
                        </p>
                      </div>
                    </label>

                    {isReady ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={1}
                          disabled={!checked || running}
                          aria-label={
                            isArabic
                              ? `مبلغ فاتورة ${child.prenom} ${child.nom}`
                              : `Montant pour ${child.prenom} ${child.nom}`
                          }
                          value={customAmounts[child.id] ?? baseAmount}
                          onChange={event =>
                            setCustomAmounts(prev => ({ ...prev, [child.id]: event.target.value }))
                          }
                          placeholder="0"
                          className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-end text-xs font-black text-slate-900 outline-none focus:border-indigo-500 disabled:opacity-40"
                        />
                        <span className="text-[11px] font-bold text-slate-400">
                          {isArabic ? 'د.ج' : 'DA'}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                          state === 'covered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {state === 'covered' && <CheckCircle2 className="h-3 w-3" />}
                        {reason}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={running}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          >
            {isArabic ? 'إلغاء' : 'Annuler'}
          </button>
          <button
            type="button"
            disabled={running || isReadOnly || chosenReady.length === 0}
            onClick={() => void handleGenerateBatch()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {running && progress
              ? isArabic
                ? `جارٍ الإنشاء (${progress.done}/${progress.total})…`
                : `Création (${progress.done}/${progress.total})…`
              : isArabic
              ? `إنشاء ${chosenReady.length} فاتورة (${localizeInvoicePeriodText(month, true)})`
              : `Créer ${chosenReady.length} facture(s) (${localizeInvoicePeriodText(month, false)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
