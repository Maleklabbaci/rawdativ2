import type { Paiement } from '../types';

// A reviewed key takes precedence, but the original text is never erased.
export function invoicePeriod(invoice: Pick<Paiement, 'periodeCle' | 'moisConcerne'>): string {
  return (typeof invoice.periodeCle === 'string' && invoice.periodeCle.slice(2)) || (typeof invoice.moisConcerne === 'string' && invoice.moisConcerne) || '—';
}

// A suspected pair is not cancelled; both sides are held for review unless one side has been cancelled.
export function suspectedInvoiceIds(invoices: ReadonlyArray<Paiement>): Set<string> {
  const cancelledIds = new Set(
    invoices.filter(inv => inv.statut === 'Annulé').map(inv => inv.id)
  );
  const result = new Set<string>();
  for (const invoice of invoices) {
    if (!invoice.doublonSuspect || cancelledIds.has(invoice.id)) continue;
    const targetId = invoice.doublonSuspect.targetInvoiceId;
    if (typeof targetId === 'string' && cancelledIds.has(targetId)) continue;
    result.add(invoice.id);
    if (typeof targetId === 'string') result.add(targetId);
  }
  return result;
}

export function hasInvalidFinanceDetails(invoice: Paiement): boolean {
  return (invoice.statut !== 'Payé' && invoice.statut !== 'En attente' && invoice.statut !== 'Retard' && invoice.statut !== 'Annulé') || typeof invoice.montant !== 'number' || !Number.isFinite(invoice.montant) || invoice.montant <= 0;
}

export type ReminderBlockReason = 'paid' | 'cancelled' | 'duplicate' | 'period' | 'sibling-period' | 'details';
export type ReminderContext = { suspectedIds: ReadonlySet<string>; childrenWithUnknownPeriods: ReadonlySet<string> };

export function hasValidPeriodKey(key: unknown): key is string {
  return typeof key === 'string' && /^(M:\d{4}-(0[1-9]|1[0-2])|A:\d{4})$/.test(key) && key.slice(2, 6) !== '0000';
}

// Use the complete *visible* invoice set, including invoices marked paid. A
// missing period on any active sibling might refer to a period already classified.
export function reminderContext(invoices: ReadonlyArray<Paiement>): ReminderContext {
  const childrenWithUnknownPeriods = new Set<string>();
  for (const invoice of invoices) {
    if (invoice.statut === 'Annulé') continue;
    if (typeof invoice.enfantId === 'string' && invoice.enfantId && !hasValidPeriodKey(invoice.periodeCle)) childrenWithUnknownPeriods.add(invoice.enfantId);
  }
  return { suspectedIds: suspectedInvoiceIds(invoices), childrenWithUnknownPeriods };
}

// This is a minimum UI guard, not proof that a payment is due. Do not infer a
// missing period, amount or status from a legacy label.
export function reminderBlockReason(invoice: Paiement, context: ReminderContext): ReminderBlockReason | null {
  if (invoice.statut === 'Annulé') return 'cancelled';
  if (context.suspectedIds.has(invoice.id)) return 'duplicate';
  if (invoice.statut === 'Payé') return 'paid';
  if (!hasValidPeriodKey(invoice.periodeCle)) return 'period';
  if (context.childrenWithUnknownPeriods.has(invoice.enfantId)) return 'sibling-period';
  if (hasInvalidFinanceDetails(invoice)) return 'details';
  return null;
}

export const INVOICE_PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Carte'] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];

const PAYMENT_METHOD_LABELS: Record<InvoicePaymentMethod, { fr: string; ar: string }> = {
  Espèces: { fr: 'Espèces', ar: 'نقداً' },
  Chèque: { fr: 'Chèque', ar: 'شيك بنكي' },
  Virement: { fr: 'Virement', ar: 'تحويل بنكي / بريدي' },
  Carte: { fr: 'Carte', ar: 'بطاقة بنكية / CIB' },
};

export function formatPaymentMethodLabel(
  method: string | null | undefined,
  isArabic: boolean,
  emptyFallback?: string
): string {
  const trimmed = typeof method === 'string' ? method.trim() : '';
  if (!trimmed) return emptyFallback ?? (isArabic ? 'غير محدد' : 'Non précisé');
  const known = PAYMENT_METHOD_LABELS[trimmed as InvoicePaymentMethod];
  if (known) return isArabic ? known.ar : known.fr;
  return trimmed;
}

export function formatInvoiceStatusLabel(status: unknown, isArabic: boolean): string {
  if (status === 'Payé') return isArabic ? 'مدفوعة' : 'Payé';
  if (status === 'En attente') return isArabic ? 'قيد الانتظار' : 'En attente';
  if (status === 'Retard') return isArabic ? 'متأخرة' : 'En retard';
  if (status === 'Annulé') return isArabic ? 'ملغاة' : 'Annulée';
  const raw = typeof status === 'string' && status.trim() ? ` : ${status.trim()}` : '';
  return `${isArabic ? 'حالة غير معروفة' : 'Statut inconnu'}${raw}`;
}

const ARABIC_MONTH_LABELS: Record<string, string> = {
  janvier: 'جانفي',
  février: 'فيفري',
  mars: 'مارس',
  avril: 'أفريل',
  mai: 'ماي',
  juin: 'جوان',
  juillet: 'جويلية',
  août: 'أوت',
  septembre: 'سبتمبر',
  octobre: 'أكتوبر',
  novembre: 'نوفمبر',
  décembre: 'ديسمبر',
};

export function localizeInvoicePeriodText(value: string, isArabic: boolean): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '—') return '—';
  if (!isArabic) return `${trimmed.charAt(0).toLocaleUpperCase('fr-FR')}${trimmed.slice(1)}`;
  return trimmed.replace(
    /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi,
    month => ARABIC_MONTH_LABELS[month.toLowerCase()] ?? month
  );
}
