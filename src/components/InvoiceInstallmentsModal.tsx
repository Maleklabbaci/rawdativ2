import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { getCollectionDocument, setCollectionDocument, supabase } from '../supabase';
import type { Enfant, Paiement } from '../types';
import { formatCurrency } from '../utils/format';
import { formatPaymentMethodLabel, INVOICE_PAYMENT_METHODS, invoicePeriod } from '../utils/financePeriod';
import { buildPaymentReceiptPdf } from '../utils/paymentReceiptPdf';
import InAppPdfViewerModal, { type InAppPdfViewerSource } from './InAppPdfViewerModal';

export interface InvoiceInstallment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  enfantId: string;
  amount: number;
  method: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
  date: string;
  note?: string;
  recordedBy?: string;
  createdAt: string;
}

interface StoredInstallmentsDoc {
  version: number;
  nextSeq: number;
  items: InvoiceInstallment[];
}

function localTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizePhoneForWa(raw?: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;
  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
}

export function useInvoiceInstallments(crecheId?: string) {
  const isDemo = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true');
  const docId = crecheId ? `acomptes_${crecheId}` : '';
  const storageKey = crecheId ? `rawdha_acomptes_${crecheId}` : '';

  const [doc, setDoc] = useState<StoredInstallmentsDoc>({ version: 1, nextSeq: 1, items: [] });

  useEffect(() => {
    if (!crecheId) {
      setDoc({ version: 1, nextSeq: 1, items: [] });
      return;
    }

    let cancelled = false;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<StoredInstallmentsDoc>;
        if (Array.isArray(parsed.items)) {
          setDoc({
            version: 1,
            nextSeq: typeof parsed.nextSeq === 'number' && parsed.nextSeq >= 1 ? parsed.nextSeq : parsed.items.length + 1,
            items: parsed.items,
          });
        }
      }
    } catch {
      // Ignore storage error
    }

    if (isDemo || typeof (supabase as any)?.from !== 'function') return;

    (async () => {
      try {
        const remote = await getCollectionDocument<StoredInstallmentsDoc>('parametres', docId);
        if (!cancelled && remote && Array.isArray(remote.items)) {
          const normalized: StoredInstallmentsDoc = {
            version: 1,
            nextSeq: typeof remote.nextSeq === 'number' && remote.nextSeq >= 1 ? remote.nextSeq : remote.items.length + 1,
            items: remote.items,
          };
          setDoc(normalized);
          try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          } catch {
            // Ignore
          }
        }
      } catch {
        // Fallback cache local
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crecheId, docId, isDemo, storageKey]);

  const persist = useCallback(
    async (next: StoredInstallmentsDoc) => {
      setDoc(next);
      if (!crecheId) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      if (!isDemo && typeof (supabase as any)?.from === 'function') {
        await setCollectionDocument('parametres', docId, { id: docId, ...next });
      }
    },
    [crecheId, docId, isDemo, storageKey]
  );

  const addInstallment = useCallback(
    async (input: {
      invoiceId: string;
      enfantId: string;
      amount: number;
      method: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
      date: string;
      note?: string;
      recordedBy?: string;
    }): Promise<InvoiceInstallment> => {
      const year = (input.date || localTodayStr()).slice(0, 4);
      const seq = doc.nextSeq;
      const receiptNumber = `BV-${year}-${String(seq).padStart(4, '0')}`;
      const item: InvoiceInstallment = {
        id: `inst-${Date.now().toString(36)}-${seq}`,
        receiptNumber,
        invoiceId: input.invoiceId,
        enfantId: input.enfantId,
        amount: Math.round(input.amount),
        method: input.method,
        date: input.date || localTodayStr(),
        note: input.note?.trim() || undefined,
        recordedBy: input.recordedBy,
        createdAt: new Date().toISOString(),
      };
      const next: StoredInstallmentsDoc = {
        version: 1,
        nextSeq: seq + 1,
        items: [item, ...doc.items],
      };
      await persist(next);
      return item;
    },
    [doc.items, doc.nextSeq, persist]
  );

  const removeInstallment = useCallback(
    async (installmentId: string) => {
      const next: StoredInstallmentsDoc = {
        ...doc,
        items: doc.items.filter(item => item.id !== installmentId),
      };
      await persist(next);
    },
    [doc, persist]
  );

  const byInvoiceId = useMemo(() => {
    const map = new Map<string, InvoiceInstallment[]>();
    for (const item of doc.items) {
      const arr = map.get(item.invoiceId) || [];
      arr.push(item);
      map.set(item.invoiceId, arr);
    }
    return map;
  }, [doc.items]);

  const paidSumByInvoiceId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of doc.items) {
      map.set(item.invoiceId, (map.get(item.invoiceId) || 0) + (Number(item.amount) || 0));
    }
    return map;
  }, [doc.items]);

  const todayStr = localTodayStr();
  const todaySummary = useMemo(() => {
    const todayItems = doc.items.filter(item => item.date === todayStr);
    const total = todayItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const cash = todayItems
      .filter(item => item.method === 'Espèces')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return { count: todayItems.length, total, cash, other: total - cash, items: todayItems };
  }, [doc.items, todayStr]);

  return {
    installments: doc.items,
    byInvoiceId,
    paidSumByInvoiceId,
    todaySummary,
    addInstallment,
    removeInstallment,
  };
}

interface InvoiceInstallmentsModalProps {
  paiement: Paiement & { moyenPaiement?: string; dateEcheance?: string };
  enfant?: Enfant;
  creche?: { nom?: string } | null;
  installments: InvoiceInstallment[];
  readOnly?: boolean;
  recordedBy?: string;
  isArabic: boolean;
  onAddInstallment: (input: {
    invoiceId: string;
    enfantId: string;
    amount: number;
    method: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
    date: string;
    note?: string;
    recordedBy?: string;
  }) => Promise<InvoiceInstallment>;
  onRemoveInstallment: (id: string) => Promise<void>;
  onCompleteInvoice?: (method: 'Espèces' | 'Chèque' | 'Virement' | 'Carte') => Promise<void>;
  onClose: () => void;
}

export default function InvoiceInstallmentsModal({
  paiement,
  enfant,
  creche,
  installments,
  readOnly = false,
  recordedBy,
  isArabic,
  onAddInstallment,
  onRemoveInstallment,
  onCompleteInvoice,
  onClose,
}: InvoiceInstallmentsModalProps) {
  const totalInvoice = Math.max(0, Number(paiement.montant) || 0);
  const alreadyPaid = installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = Math.max(0, totalInvoice - alreadyPaid);

  const [amountInput, setAmountInput] = useState<string>(() => (remaining > 0 ? String(remaining) : ''));
  const [method, setMethod] = useState<'Espèces' | 'Chèque' | 'Virement' | 'Carte'>('Espèces');
  const [date, setDate] = useState<string>(localTodayStr);
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<InvoiceInstallment | null>(null);
  const [pdfViewerSource, setPdfViewerSource] = useState<InAppPdfViewerSource | null>(null);

  const handleOpenPdfReceipt = async (inst?: InvoiceInstallment) => {
    try {
      const built = await buildPaymentReceiptPdf({
        paiement,
        enfant,
        creche,
        installments,
        focusInstallment: inst,
        recordedBy: inst?.recordedBy || recordedBy,
      });
      setPdfViewerSource({
        title: isArabic ? `وصل الدفع ${built.receiptNumber}` : `Reçu ${built.receiptNumber}`,
        fileName: built.fileName,
        mimeType: 'application/pdf',
        bytes: built.bytes,
        pageCount: built.pageCount,
      });
    } catch {
      setError(isArabic ? 'تعذر إنشاء وصل PDF.' : 'Impossible de générer le reçu PDF.');
    }
  };

  const parentWaPhone = useMemo(() => {
    if (!enfant) return null;
    for (const parent of enfant.parents || []) {
      const normalized = normalizePhoneForWa(parent.telephone);
      if (normalized) return normalized;
    }
    return null;
  }, [enfant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || busy) return;
    setError('');
    const numericAmount = Math.round(Number(amountInput));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(isArabic ? 'يرجى إدخال مبلغ صحيح أكبر من صفر.' : 'Saisissez un montant valide supérieur à 0 DA.');
      return;
    }
    if (remaining > 0 && numericAmount > remaining) {
      setError(
        isArabic
          ? `المبلغ يتجاوز الباقي المستحق (${formatCurrency(remaining)}).`
          : `Le versement dépasse le reste à régler (${formatCurrency(remaining)}).`
      );
      return;
    }

    setBusy(true);
    try {
      const created = await onAddInstallment({
        invoiceId: paiement.id,
        enfantId: paiement.enfantId,
        amount: numericAmount,
        method,
        date,
        note,
        recordedBy,
      });

      const nextPaid = alreadyPaid + numericAmount;
      if (totalInvoice > 0 && nextPaid >= totalInvoice && paiement.statut !== 'Payé' && onCompleteInvoice) {
        await onCompleteInvoice(method);
      }

      const nextRem = Math.max(0, totalInvoice - nextPaid);
      setAmountInput(nextRem > 0 ? String(nextRem) : '');
      setNote('');
      setActiveReceipt(created);
    } catch {
      setError(
        isArabic ? 'تعذر تسجيل الدفعة حالياً.' : 'Impossible d’enregistrer ce versement pour le moment.'
      );
    } finally {
      setBusy(false);
    }
  };

  const buildReceiptWhatsAppHref = (inst: InvoiceInstallment) => {
    if (!parentWaPhone) return null;
    const childName = enfant ? `${enfant.prenom} ${enfant.nom}` : '';
    const newRemaining = Math.max(0, totalInvoice - alreadyPaid);
    const msg = isArabic
      ? `السلام عليكم، تؤكد إدارة ${creche?.nom || 'الروضة'} استلام دفعة مصرح بها رقم ${inst.receiptNumber} بمبلغ ${formatCurrency(inst.amount)} (${formatPaymentMethodLabel(inst.method, true)}) بتاريخ ${inst.date} الخاصة بالطفل(ة) ${childName} للفترة ${invoicePeriod(paiement)}. الباقي على الفاتورة: ${formatCurrency(newRemaining)}. شكراً لكم.`
      : `Bonjour,\n\nLa direction de ${creche?.nom || 'la crèche'} confirme l’enregistrement du bon de versement n° ${inst.receiptNumber} de ${formatCurrency(inst.amount)} (${inst.method}) le ${inst.date} pour ${childName} (période ${invoicePeriod(paiement)}).\nReste sur la facture : ${formatCurrency(newRemaining)}.\n\nCordialement.`;
    return `https://wa.me/${parentWaPhone}?text=${encodeURIComponent(msg)}`;
  };

  const handlePrintReceipt = (inst: InvoiceInstallment) => {
    setActiveReceipt(inst);
    setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    }, 80);
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:items-center sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                {isArabic ? 'التسبيقات والدفعات الجزئية' : 'Acomptes & versements'}
              </h2>
              <p className="text-xs text-slate-500">
                {enfant ? `${enfant.prenom} ${enfant.nom}` : ''} · {invoicePeriod(paiement)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق' : 'Fermer'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Synthèse Total / Versé / Reste */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">
              {isArabic ? 'إجمالي الفاتورة' : 'Total facture'}
            </p>
            <p className="mt-0.5 text-sm font-black text-slate-900 tabular-nums">
              {formatCurrency(totalInvoice)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3">
            <p className="text-[11px] font-semibold text-emerald-800">
              {isArabic ? 'المجموع المدفوع' : 'Déjà versé'}
            </p>
            <p className="mt-0.5 text-sm font-black text-emerald-700 tabular-nums">
              {formatCurrency(alreadyPaid)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3">
            <p className="text-[11px] font-semibold text-amber-900">
              {isArabic ? 'الباقي للدفع' : 'Reste à régler'}
            </p>
            <p className="mt-0.5 text-sm font-black text-amber-800 tabular-nums">
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        {/* Formulaire d’enregistrement d’un acompte */}
        {!readOnly && remaining > 0 && (
          <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <p className="text-xs font-extrabold text-slate-800">
              {isArabic ? 'تسجيل دفعة جديدة' : 'Enregistrer un nouveau versement'}
            </p>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  {isArabic ? 'المبلغ (د.ج) *' : 'Montant (DA) *'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={remaining > 0 ? remaining : undefined}
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  {isArabic ? 'الوسيلة *' : 'Mode *'}
                </label>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {INVOICE_PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>
                      {formatPaymentMethodLabel(m, isArabic)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">
                  {isArabic ? 'التاريخ *' : 'Date *'}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={isArabic ? 'ملاحظة اختيارية (مثال: دفعة أولى نقداً)' : 'Note facultative (ex. : 1re tranche remise par le père)'}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isArabic ? 'تأكيد وإصدار وصل' : 'Valider le versement'}</span>
              </button>
            </div>
          </form>
        )}

        {remaining === 0 && totalInvoice > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              {isArabic
                ? 'اكتمل سداد كامل مبلغ هذه الفاتورة.'
                : 'Le solde complet de cette facture a été réglé.'}
            </span>
          </div>
        )}

        {/* Historique des bons de versement */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            {isArabic ? 'سجل وصولات الدفع المرقمة' : 'Bons de versement enregistrés'} ({installments.length})
          </h3>

          {installments.length === 0 ? (
            <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">
              {isArabic ? 'لم يتم تسجيل أي دفعة جزئية بعد.' : 'Aucun versement partiel enregistré sur cette facture.'}
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
              {installments.map(inst => {
                const waHref = buildReceiptWhatsAppHref(inst);
                return (
                  <div
                    key={inst.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                          {inst.receiptNumber}
                        </span>
                        <span className="text-sm font-black text-slate-900 tabular-nums">
                          {formatCurrency(inst.amount)}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {formatPaymentMethodLabel(inst.method, isArabic)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {inst.date}
                        {inst.recordedBy ? ` · ${inst.recordedBy}` : ''}
                        {inst.note ? ` — ${inst.note}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleOpenPdfReceipt(inst)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap cursor-pointer"
                      >
                        <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(inst)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                      >
                        <span>{isArabic ? 'الوصل' : 'Bon'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(inst)}
                        aria-label={isArabic ? 'طباعة الوصل' : 'Imprimer le bon'}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void onRemoveInstallment(inst.id)}
                          aria-label={isArabic ? 'حذف الدفعة' : 'Supprimer ce versement'}
                          className="inline-flex items-center rounded-lg border border-rose-100 bg-rose-50/70 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Aperçu imprimable du Bon de versement déclaratif numéroté */}
        {activeReceipt && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 print:border-solid print:bg-white">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  {creche?.nom || 'RAWDHA+'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isArabic ? 'وصل استلام دفعة مصرح بها' : 'Bon de versement déclaratif'}
                </p>
              </div>
              <span className="font-mono text-xs font-black text-indigo-700">
                {activeReceipt.receiptNumber}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div>
                <span className="text-slate-500">{isArabic ? 'الطفل:' : 'Enfant :'}</span>{' '}
                <strong>{enfant ? `${enfant.prenom} ${enfant.nom}` : '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500">{isArabic ? 'التاريخ:' : 'Date :'}</span>{' '}
                <strong>{activeReceipt.date}</strong>
              </div>
              <div>
                <span className="text-slate-500">{isArabic ? 'المبلغ المستلم:' : 'Montant versé :'}</span>{' '}
                <strong className="text-emerald-700">{formatCurrency(activeReceipt.amount)}</strong>
              </div>
              <div>
                <span className="text-slate-500">{isArabic ? 'الباقي على الفاتورة:' : 'Reste sur facture :'}</span>{' '}
                <strong>{formatCurrency(remaining)}</strong>
              </div>
            </div>
          </div>
        )}
        {pdfViewerSource && (
          <InAppPdfViewerModal
            documentSource={pdfViewerSource}
            isArabic={isArabic}
            onClose={() => setPdfViewerSource(null)}
          />
        )}
      </div>
    </div>
  );
}
