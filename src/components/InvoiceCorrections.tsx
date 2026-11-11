import { useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { financeErrorMessage } from '../utils/financeError';
import { formatInvoiceStatusLabel, invoicePeriod, localizeInvoicePeriodText, suspectedInvoiceIds } from '../utils/financePeriod';
import { formatCurrency } from '../utils/format';
import type { Enfant, InvoiceReviewAction, InvoiceReviewEvent, Paiement } from '../types';

/** Corrections and suspicions are human declarations; no invoice is cancelled. */
export default function InvoiceCorrections({ invoices, children, readOnly }: { invoices: Paiement[]; children: Enfant[]; readOnly: boolean }) {
  const { invoiceReviewAction, listInvoiceReviewEvents } = useDb();
  const { language } = useLanguage(); const ar = language === 'ar'; const t = (fr: string, arabic: string) => ar ? arabic : fr;
  const [snapshot,setSnapshot] = useState<Paiement | null>(null); const [target,setTarget] = useState<Paiement | null>(null);
  const [action,setAction] = useState<InvoiceReviewAction['action'] | ''>(''); const [type,setType] = useState<''|'M'|'A'>('');
  const [period,setPeriod] = useState(''); const [reason,setReason] = useState(''); const [confirmed,setConfirmed] = useState(false);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [notice,setNotice] = useState('');
  const [events,setEvents] = useState<InvoiceReviewEvent[] | null>(null); const inFlight = useRef(false); const sequence=useRef(0);
  const suspicious = suspectedInvoiceIds(invoices);
  const suspiciousCount = invoices.filter(p => suspicious.has(p.id)).length;
  const name = (id: string) => { const child=children.find(c=>c.id===id); return child ? `${child.prenom} ${child.nom}` : t('Enfant indisponible','الطفل غير متاح'); };
  const label = (p: Paiement) => `${name(p.enfantId)} · ${localizeInvoicePeriodText(invoicePeriod(p), ar)} · ${typeof p.montant === 'number' && Number.isFinite(p.montant) ? formatCurrency(p.montant) : '—'} · ${formatInvoiceStatusLabel(p.statut, ar)} · ${p.id}`;
  const choose = (id: string) => { sequence.current++;setSnapshot(invoices.find(p=>p.id===id)||null);setTarget(null);setAction('');setType('');setPeriod('');setReason('');setConfirmed(false);setError('');setNotice('');setEvents(null); };
  const history = async () => {
    if(!snapshot || inFlight.current) return;
    const n=++sequence.current;setBusy(true);setError('');setEvents(null);
    try { const data=await listInvoiceReviewEvents(snapshot.id);if(n===sequence.current)setEvents(data); }
    catch { if(n===sequence.current)setError(t('Historique indisponible. Réessayez ; cela ne signifie pas qu’il est vide.','السجل غير متاح. أعد المحاولة؛ هذا لا يعني أنه فارغ.')); }
    finally { if(n===sequence.current)setBusy(false); }
  };
  const save = async () => {
    if(!snapshot || !action || readOnly || inFlight.current) return;
    const periodValid=type==='M' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(period) : type==='A' && /^\d{4}$/.test(period);
    if (!reason.trim() || !confirmed || (action==='correct_period' && (!periodValid || period.startsWith('0000'))) || (action==='flag_duplicate' && !target)) {
      setError(t('Complétez les champs et confirmez votre vérification.','أكمل الخانات وأكد المراجعة.'));return;
    }
    inFlight.current=true;setBusy(true);setError('');setNotice('');
    try {
      const saved=await invoiceReviewAction({requestId:`finance_review_${crypto.randomUUID()}`,action,expected:snapshot,
        ...(action==='correct_period'?{periodKey:`${type}:${period}`} : {}), ...(action==='flag_duplicate'&&target?{target}:{}),reason:reason.trim()});
      setSnapshot(saved);setNotice(action==='correct_period' ? t('Correction enregistrée avec sa trace.','تم حفظ التصحيح وسجله.') : action==='flag_duplicate' ? t('Soupçon enregistré : aucune facture ni aucun montant n’a été annulé.','تم تسجيل الاشتباه دون إلغاء أي فاتورة أو مبلغ.') : action==='cancel_invoice' ? t('Facture annulée comptablement avec conservation de sa trace.','تم إلغاء الفاتورة محاسبياً مع حفظ أثرها.') : t('Soupçon écarté avec sa justification.','تم رفع الاشتباه مع تسجيل السبب.'));
      setAction('');setTarget(null);setReason('');setType('');setPeriod('');setConfirmed(false);setEvents(null);
    } catch (err) { setError(financeErrorMessage(err,ar)); }
    finally { inFlight.current=false;setBusy(false); }
  };
  const related = snapshot ? invoices.filter(p=>p.doublonSuspect?.targetInvoiceId===snapshot.id) : [];
  const options=snapshot ? invoices.filter(p=>p.enfantId===snapshot.enfantId && p.id!==snapshot.id && !suspicious.has(p.id)) : [];
  return <details className={`min-w-0 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 ${suspiciousCount > 0 ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200/80 bg-white shadow-2xs'}`}>
    <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-lg text-xs sm:text-sm font-bold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
      <span className="min-w-0 truncate">{t('Corriger une période ou signaler un doublon suspect','تصحيح فترة أو الإبلاغ عن تكرار محتمل')}</span>
      {suspiciousCount > 0 ? (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-800">
          {t(`${suspiciousCount} soupçon(s)`, `${suspiciousCount} اشتباه`)}
        </span>
      ) : (
        <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
          {t('Outil', 'أداة')}
        </span>
      )}
    </summary>
    <p className="mt-3 text-xs font-semibold leading-5 text-indigo-950">{t('Un soupçon ne supprime ni n’annule une facture : les montants restent dans les totaux, qui doivent être vérifiés. Les deux factures sont mises en attente ; les rappels et modifications sont suspendus pour elles, ainsi que toute nouvelle création pour cet enfant. La détection automatique et l’annulation comptable restent à construire.', 'الاشتباه لا يحذف أو يلغي الفاتورة: تبقى المبالغ ضمن الإجماليات ويجب التحقق منها. تتوقف التعديلات والتذكيرات للفاتورتين وإنشاء فاتورة جديدة لهذا الطفل أثناء المراجعة. الكشف الآلي والإلغاء المحاسبي لم يكتملَا بعد.')}</p>
    {readOnly && <p className="mt-2 rounded-xl bg-indigo-100/80 px-3 py-2 text-xs font-bold text-indigo-950">{t('Compte en lecture seule : consultation uniquement jusqu’à validation administrative.', 'الحساب في وضع القراءة فقط إلى حين موافقة الإدارة.')}</p>}
    <label className="mt-4 block text-xs font-bold">{t('Facture concernée','الفاتورة المعنية')}<select value={snapshot?.id || ''} disabled={busy} onChange={e=>choose(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500"><option value="">{t('Choisir une facture','اختر فاتورة')}</option>{invoices.map(p=><option key={p.id} value={p.id}>{label(p)}{suspicious.has(p.id)?` · ${t('soupçon à vérifier','اشتباه قيد المراجعة')}`:''}</option>)}</select></label>
    {snapshot && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="break-words text-sm font-bold">{label(snapshot)}</p>
      <p className="break-words text-xs text-slate-600">{t('Libellé original','النص الأصلي')}: {snapshot.moisConcerne || '—'} · {t('Période actuelle','الفترة الحالية')}: {snapshot.periodeCle || '—'}</p>
      {suspicious.has(snapshot.id) && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{snapshot.doublonSuspect ? t(`Soupçon lié à ${snapshot.doublonSuspect.targetInvoiceId}. Ne l’écartez que si les justificatifs établissent que ce n’est pas un doublon.`, `اشتباه مرتبط بـ ${snapshot.doublonSuspect.targetInvoiceId}. لا ترفع الاشتباه إلا إذا أثبتت الوثائق عدم وجود تكرار.`) : t(`Cette facture est liée à un soupçon signalé depuis : ${related.map(p=>p.id).join(', ')}. Ouvrez cette facture pour consulter ou écarter le soupçon.`, `هذه الفاتورة مرتبطة باشتباه أبلغت عنه: ${related.map(p=>p.id).join('، ')}. افتح الفاتورة المبلِّغة للاطلاع على الاشتباه أو رفعه.`)}</p>}
      {suspicious.has(snapshot.id) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        <p className="font-black">{t('Revue manuelle avec le comptable', 'مراجعة يدوية مع المحاسب')}</p>
        <ol className="mt-1 list-inside list-decimal space-y-1">
          <li>{t('Conservez le soupçon et comparez les deux factures et leurs justificatifs.', 'أبقِ الاشتباه وقارن الفاتورتين والوثائق المرتبطة بهما.')}</li>
          <li>{t('Vérifiez séparément les encaissements réels ; le statut « Payé » ne constitue pas une preuve.', 'تحقق من المبالغ المقبوضة فعلياً بشكل مستقل؛ حالة «مدفوع» ليست إثباتاً.')}</li>
          <li>{t('Consultez le comptable et conservez son avis par un canal sûr. Si le doublon est confirmé ou incertain, laissez les factures en attente.', 'استشر المحاسب واحتفظ برأيه بطريقة آمنة. إذا تأكد التكرار أو بقي الشك، اترك الفاتورتين معلّقتين.')}</li>
        </ol>
        <p className="mt-1 font-bold">{t('Aucun avis du comptable n’est enregistré ou envoyé ici. L’application ne permet pas encore d’appliquer une annulation ou un remboursement.', 'لا يُسجَّل رأي المحاسب هنا ولا يُرسَل تلقائياً. التطبيق لا يتيح بعد تنفيذ الإلغاء أو الاسترجاع.')}</p>
      </div>}
      <button type="button" disabled={busy} onClick={()=>void history()} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">{t('Voir les corrections et signalements','عرض التصحيحات والإبلاغات')}</button>
      {events && (events.length===0 ? <p className="text-xs text-slate-600">{t('Aucun événement accessible pour cette facture.','لا توجد أحداث متاحة لهذه الفاتورة.')}</p> : <ul className="space-y-2">{events.map(event=><li key={event.requestId} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><p className="font-bold">{event.action==='correct_period'?t('Correction de période','تصحيح الفترة'):event.action==='flag_duplicate'?t('Doublon suspect','تكرار محتمل'):event.action==='cancel_invoice'?t('Annulation comptable','إلغاء محاسبي'):t('Soupçon écarté','رفع الاشتباه')}</p><p>{t('Avant','قبل')}: {String(event.beforeData.periodeCle || '—')} · {t('Après','بعد')}: {String(event.afterData.periodeCle || '—')}{event.targetInvoiceId ? ` · ${event.targetInvoiceId}` : ''}</p><p className="break-words">{t('Justification','السبب')}: {event.reason}</p><p className="break-all">{event.createdBy} · {event.createdAt} · {event.requestId}</p><details className="mt-1"><summary className="cursor-pointer font-bold">{t('Voir les données avant et après','عرض البيانات قبل وبعد')}</summary><pre dir="ltr" className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-white p-2 text-start">{JSON.stringify({before:event.beforeData,after:event.afterData,comparison:event.targetBefore},null,2)}</pre></details></li>)}</ul>)}
      <fieldset disabled={busy || readOnly} className="min-w-0 grid gap-3 border-t border-slate-100 pt-3">
        <label className="text-xs font-bold">{t('Action','الإجراء')}<select value={action} onChange={e=>{setAction(e.target.value as InvoiceReviewAction['action']|'');setTarget(null);setReason('');setConfirmed(false);setError('')}} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 outline-none focus:border-indigo-500"><option value="">{t('Choisir','اختر')}</option>{snapshot.periodeCle && !suspicious.has(snapshot.id) && snapshot.statut !== 'Annulé' && <option value="correct_period">{t('Corriger la période','تصحيح الفترة')}</option>}{!suspicious.has(snapshot.id) && snapshot.statut !== 'Annulé' && <option value="flag_duplicate">{t('Signaler un doublon suspect','الإبلاغ عن تكرار محتمل')}</option>}{snapshot.doublonSuspect && <option value="clear_suspicion">{t('Écarter le soupçon : ce ne sont pas des doublons','رفع الاشتباه: ليستا مكررتين')}</option>}{snapshot.statut !== 'Annulé' && <option value="cancel_invoice">{t('Annuler comptablement la facture','إلغاء الفاتورة محاسبياً')}</option>}</select></label>
        {action==='correct_period' && <><p className="text-xs text-amber-800">{t('La correction conserve l’ancienne valeur dans le journal mais ne prouve pas que la nouvelle période est correcte.','يحفظ السجل القيمة السابقة، لكنه لا يثبت صحة الفترة الجديدة.')}</p><label className="text-xs font-bold">{t('Type','النوع')}<select value={type} onChange={e=>{setType(e.target.value as ''|'M'|'A');setPeriod('')}} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 outline-none focus:border-indigo-500"><option value="">{t('Choisir','اختر')}</option><option value="M">{t('Mois','شهر')}</option><option value="A">{t('Année civile','سنة ميلادية')}</option></select></label>{type && <label className="text-xs font-bold">{t('Nouvelle période','الفترة الجديدة')}<input type={type==='M'?'month':'text'} value={period} placeholder={type==='A'?'AAAA':undefined} onChange={e=>setPeriod(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-indigo-500" /></label>}</>}
        {action==='flag_duplicate' && <label className="text-xs font-bold">{t('Autre facture du même enfant à comparer','الفاتورة الأخرى لنفس الطفل للمقارنة')}<select value={target?.id||''} onChange={e=>setTarget(options.find(p=>p.id===e.target.value)||null)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 outline-none focus:border-indigo-500"><option value="">{t('Choisir','اختر')}</option>{options.map(p=><option value={p.id} key={p.id}>{label(p)}</option>)}</select></label>}
        {action && <><label className="text-xs font-bold">{t('Source et justification','المصدر والسبب')}<textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 outline-none focus:border-indigo-500" /></label><label className="flex items-start gap-2.5 text-xs font-bold"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" /><span>{action==='clear_suspicion' ? t('Après vérification, je confirme que ces factures ne sont pas des doublons.','بعد التحقق أؤكد أن الفاتورتين ليستا مكررتين.') : t('Je confirme avoir vérifié les pièces et compris que les données et montants restent conservés.','أؤكد مراجعة الوثائق وأفهم أن البيانات والمبالغ ستبقى محفوظة.')}</span></label><button type="button" onClick={()=>void save()} className="rounded-xl bg-indigo-700 px-4 py-3 text-xs font-black text-white transition hover:bg-indigo-800 disabled:opacity-50">{busy?t('Enregistrement…','جار الحفظ…'):t('Enregistrer la décision','حفظ القرار')}</button></>}
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
    </div>}
  </details>;
}
