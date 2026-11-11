import { formatInvoiceStatusLabel, localizeInvoicePeriodText, suspectedInvoiceIds } from '../utils/financePeriod';
import { useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { financeErrorMessage } from '../utils/financeError';
import { formatCurrency } from '../utils/format';
import type { Enfant, InvoicePeriodReview, Paiement } from '../types';

/** Manual classification only. No normalization, deletion, or duplicate resolution. */
export default function InvoicePeriodReview({ invoices, children, readOnly }: { invoices: Paiement[]; children: Enfant[]; readOnly: boolean }) {
  const { reviewInvoicePeriod, getInvoicePeriodReview } = useDb();
  const { language } = useLanguage(); const ar = language === 'ar';
  const t = (fr: string, arabic: string) => ar ? arabic : fr;
  const [snapshot, setSnapshot] = useState<Paiement | null>(null);
  const [type, setType] = useState<'' | 'M' | 'A'>('');
  const [period, setPeriod] = useState(''); const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false); const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false); const sequence = useRef(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<InvoicePeriodReview | null | undefined>(undefined);
  const remaining = invoices.filter(p => !p.periodeCle).length;
  const suspected = suspectedInvoiceIds(invoices);
  const childName = (id: string) => { const child=children.find(item=>item.id===id); return child ? `${child.prenom} ${child.nom}` : t('Enfant non disponible', 'الطفل غير متاح'); };
  const selectInvoice = (id: string) => {
    sequence.current++; setSnapshot(invoices.find(item=>item.id===id) || null); setType(''); setPeriod(''); setReason(''); setConfirmed(false); setAcknowledged(false); setError(''); setNotice(''); setHistory(undefined);
  };
  const loadHistory = async (id: string) => {
    const n=++sequence.current; setBusy(true); setError(''); setHistory(undefined);
    try { const result=await getInvoicePeriodReview(id); if (n===sequence.current) setHistory(result); }
    catch { if(n===sequence.current) setError(t('Historique indisponible. Réessayez : cela ne signifie pas qu’il est vide.', 'السجل غير متاح. أعد المحاولة؛ هذا لا يعني أنه فارغ.')); }
    finally { if(n===sequence.current) setBusy(false); }
  };
  const save = async () => {
    if (busyRef.current || !snapshot || readOnly) return;
    const valid = type === 'M' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(period) : type === 'A' && /^\d{4}$/.test(period);
    if (!valid || period.startsWith('0000') || !reason.trim() || !confirmed || !acknowledged) {
      setError(t('Choisissez une période valide, indiquez votre source et cochez les deux confirmations.', 'اختر فترة صحيحة واذكر المصدر وحدد مربعي التأكيد.')); return;
    }
    busyRef.current=true; setBusy(true); setError(''); setNotice('');
    try {
      const saved=await reviewInvoicePeriod(snapshot, `${type}:${period}`, reason.trim());
      setSnapshot(saved); setNotice(t('Période rapprochée. Le texte d’origine et les autres données sont conservés.', 'تمت مطابقة الفترة مع الاحتفاظ بالنص الأصلي وبقية البيانات.'));
      setType(''); setPeriod(''); setReason(''); setConfirmed(false); setAcknowledged(false); setHistory(undefined);
    } catch (err) { setError(financeErrorMessage(err, ar)); }
    finally { busyRef.current=false; setBusy(false); }
  };
  const otherInvoices = snapshot ? invoices.filter(p=>p.enfantId===snapshot.enfantId && p.id!==snapshot.id) : [];
  return <details className={`min-w-0 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 ${remaining > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200/80 bg-white shadow-2xs'}`}>
    <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-lg text-xs sm:text-sm font-bold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
      <span className="min-w-0 truncate">{t(`Périodes historiques · ${remaining} à examiner`, `مراجعة الفترات القديمة · ${remaining} للمراجعة`)}</span>
      <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${remaining > 0 ? 'bg-amber-200/80 text-amber-950' : 'bg-emerald-50 text-emerald-700'}`}>
        {remaining > 0 ? t(`${remaining} en attente`, `${remaining} للمراجعة`) : t('À jour', 'مكتمل')}
      </span>
    </summary>
    <p className="mt-3 text-xs font-semibold leading-5 text-amber-900">{t('Vérifiez la facture et les pièces disponibles avant de choisir. Une période absente ou invalide bloque aussi les rappels pour les autres factures de cet enfant, même si l’ancienne facture est marquée payée. Les périodes non revues bloquent les nouvelles factures pour cet enfant. Une facture douteuse ou en double doit rester non classée : ne choisissez jamais une autre période pour contourner un conflit.', 'راجع الفاتورة والوثائق المتاحة قبل الاختيار. الفترة الناقصة أو غير الصالحة تعلّق أيضاً تذكيرات الفواتير الأخرى لهذا الطفل، حتى لو كانت الفاتورة القديمة مسجلة كمدفوعة. الفترات غير المراجَعة تمنع إنشاء فواتير جديدة لهذا الطفل. اترك الفاتورة المشكوك فيها أو المكررة دون تصنيف؛ لا تختر فترة أخرى لتجاوز التعارض.')}</p>
    {readOnly && <p className="mt-2 rounded-xl bg-amber-100/80 px-3 py-2 text-xs font-bold text-amber-950">{t('Compte en lecture seule : consultation uniquement jusqu’à validation administrative.', 'الحساب في وضع القراءة فقط إلى حين موافقة الإدارة.')}</p>}
    <label className="mt-4 block text-xs font-bold text-slate-800">{t('Facture à examiner', 'الفاتورة المراد مراجعتها')}
      <select value={snapshot?.id || ''} disabled={busy} onChange={e=>selectInvoice(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500">
        <option value="">{t('Choisir une facture', 'اختر فاتورة')}</option>
        {invoices.map(item=><option key={item.id} value={item.id}>{childName(item.enfantId)} · {localizeInvoicePeriodText(item.moisConcerne || '—', ar)} · {item.periodeCle || t('à examiner', 'للمراجعة')} · {item.id}</option>)}
      </select>
    </label>
    {snapshot && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-bold text-slate-900">{childName(snapshot.enfantId)} · {typeof snapshot.montant === 'number' && Number.isFinite(snapshot.montant) ? formatCurrency(snapshot.montant) : '—'}</div>
      <p className="break-all text-xs text-slate-600">{t('Référence', 'المرجع')}: {snapshot.id}</p>
      <p className="break-words text-xs text-slate-700">{t('Libellé original', 'النص الأصلي')}: <strong>{snapshot.moisConcerne || '—'}</strong> · {t('Type original', 'النوع الأصلي')}: {snapshot.typeFacture === 'Annuel' ? t('Annuel', 'سنوي') : snapshot.typeFacture === 'Mensuel' ? t('Mensuel', 'شهري') : (snapshot.typeFacture || '—')} · {t('Statut enregistré', 'الحالة المسجلة')}: {formatInvoiceStatusLabel(snapshot.statut, ar)}</p>
      {otherInvoices.length > 0 && <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{t('Autres factures de cet enfant à comparer', 'فواتير أخرى لهذا الطفل للمقارنة')}</p><ul className="mt-1 max-h-36 space-y-1 overflow-auto text-xs text-slate-600">{otherInvoices.map(p=><li key={p.id} className="break-words">{p.moisConcerne || '—'} · {p.periodeCle || t('non revue', 'غير مراجعة')} · {formatInvoiceStatusLabel(p.statut, ar)} · {typeof p.montant === 'number' && Number.isFinite(p.montant) ? formatCurrency(p.montant) : '—'} · {p.id}</li>)}</ul></div>}
      {snapshot.periodeCle ? <div className="space-y-2 text-xs">
        <p className="font-bold text-emerald-800">{t('Période enregistrée', 'الفترة المسجلة')}: {snapshot.periodeCle}</p>
        <button type="button" disabled={busy} onClick={()=>void loadHistory(snapshot.id)} className="rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">{t('Voir la trace de revue', 'عرض سجل المراجعة')}</button>
        {history === null && <p>{t('Aucune trace de revue accessible pour cette facture ; elle peut avoir été créée directement avec une période.', 'لا يوجد سجل مراجعة متاح لهذه الفاتورة؛ قد تكون أُنشئت بفترة محددة.')}</p>}
        {history && <div className="space-y-1 rounded-xl bg-slate-50 p-3"><p>{t('Période choisie initialement', 'الفترة المختارة أولاً')}: {history.periodKey}</p><p className="break-words">{t('Source déclarée', 'المصدر المصرح به')}: {history.reason}</p><p className="break-all">{t('Compte et date serveur', 'الحساب وتاريخ الخادم')}: {history.reviewedBy} · {history.reviewedAt}</p><p className="break-words">{t('Libellé avant revue', 'النص قبل المراجعة')}: {String(history.originalData.moisConcerne || '—')}</p><details className="pt-1"><summary className="cursor-pointer font-bold">{t('Voir les données avant revue', 'عرض البيانات قبل المراجعة')}</summary><pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-white p-2 text-start">{JSON.stringify(history.originalData, null, 2)}</pre></details></div>}
      </div> : <div className="space-y-3">
        <p className="text-xs font-bold text-rose-700">{t('La période peut être corrigée avec justification dans le panneau de corrections. Une suspicion de doublon doit être examinée séparément.', 'يمكن تصحيح الفترة مع ذكر السبب في قسم التصحيحات. يجب فحص التكرار المحتمل بشكل منفصل.')}</p>
        {suspected.has(snapshot.id) && <p className="text-xs font-bold text-rose-700">{t('Facture liée à un soupçon : le rapprochement est suspendu.', 'الفاتورة مرتبطة باشتباه؛ المراجعة معلّقة.')}</p>}
        <fieldset disabled={busy || readOnly || suspected.has(snapshot.id)} className="min-w-0 grid gap-3">
          <label className="text-xs font-bold">{t('Type de période', 'نوع الفترة')}<select value={type} onChange={e=>{setType(e.target.value as ''|'M'|'A');setPeriod('')}} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 outline-none focus:border-indigo-500"><option value="">{t('Choisir', 'اختر')}</option><option value="M">{t('Mois', 'شهر')}</option><option value="A">{t('Année civile (janvier à décembre)', 'سنة ميلادية (جانفي إلى ديسمبر)')}</option></select></label>
          {type && <label className="text-xs font-bold">{type==='M' ? t('Mois concerné', 'الشهر المعني') : t('Année civile (AAAA)', 'السنة الميلادية (AAAA)')}<input type={type==='M'?'month':'text'} placeholder={type==='A'?'AAAA':undefined} value={period} onChange={e=>setPeriod(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-indigo-500" /></label>}
          <label className="text-xs font-bold">{t('Source ou justification de la vérification', 'مصدر أو مبرر المراجعة')}<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-indigo-500" /></label>
          <label className="flex items-start gap-2.5 text-xs font-bold text-slate-700"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" /><span>{t('Je confirme avoir vérifié la période et comparé les autres factures disponibles.', 'أؤكد أنني تحققت من الفترة وقارنت الفواتير الأخرى المتاحة.')}</span></label>
          <label className="flex items-start gap-2.5 text-xs font-bold text-rose-700"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" /><span>{t('Je comprends que ce choix est enregistré et qu’une correction ultérieure laisse une trace.', 'أفهم أن الاختيار يُسجل وأن أي تصحيح لاحق يترك أثراً.')}</span></label>
          <button type="button" onClick={()=>void save()} className="rounded-xl bg-indigo-700 px-4 py-3 text-xs font-black text-white transition hover:bg-indigo-800 disabled:opacity-50">{busy ? t('Enregistrement…', 'جار الحفظ…') : t('Confirmer la période', 'تأكيد الفترة')}</button>
        </fieldset>
      </div>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
    </div>}
  </details>;
}
