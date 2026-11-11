import { useEffect, useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { reminderBlockReason, reminderContext } from '../utils/financePeriod';
import type { Enfant, Paiement } from '../types';

/** A point-in-time check, never a promise about a later external message. */
export function useReminderPreflight(invoices: Paiement[], children: Enfant[], ready: boolean) {
  const { checkInvoiceReminder } = useDb();
  const { language } = useLanguage();
  const current = useRef({ invoices, children, ready, language });
  current.current = { invoices, children, ready, language };
  const active = useRef(false); const mounted = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const verify = async (invoice: Paiement, child: Enfant, phone?: string): Promise<boolean> => {
    if (active.current || !ready) return false;
    active.current = true; setBusy(true); setError('');
    const expected = JSON.stringify(invoice); const expectedLanguage = language;
    try {
      await checkInvoiceReminder(invoice, child, phone);
      const latest = current.current;
      const actual = latest.invoices.find(item => item.id === invoice.id);
      const actualChild = latest.children.find(item => item.id === child.id);
      if (!mounted.current || !latest.ready || latest.language !== expectedLanguage || !actual || !actualChild
        || JSON.stringify(actual) !== expected || actual.enfantId !== actualChild.id
        || actualChild.nom !== child.nom || actualChild.prenom !== child.prenom
        || (phone && !actualChild.parents.some(parent => parent.telephone === phone))
        || reminderBlockReason(actual, reminderContext(latest.invoices)) !== null) throw new Error('finance_changed');
      return true;
    } catch {
      if (mounted.current) setError(language === 'ar'
        ? 'تعذر تأكيد التذكير. أعد التحميل وتحقق من الفاتورة وبيانات الاتصال قبل إعادة المحاولة.'
        : 'Rappel non confirmé. Rechargez et vérifiez la facture et les coordonnées avant de réessayer.');
      return false;
    } finally {
      active.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { verify, busy, error };
}
