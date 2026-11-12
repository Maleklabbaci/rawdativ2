import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, UserCheck } from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { approveParentLinkRequest, loadParentLinkRequests, rejectParentLinkRequest, type ParentLinkRequest } from '../utils/parentPortal';

export default function ParentChildRequests({ childId, childName, crecheId, isArabic }: { childId: string; childName: string; crecheId: string; isArabic: boolean }) {
  const db = useDb();
  const { confirm } = useConfirmDialog();
  const [requests, setRequests] = useState<ParentLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const all = await loadParentLinkRequests(crecheId);
      if (mounted.current) { setRequests(all.filter(r => r.status === 'pending' && r.requestedChildId === childId)); setError(false); }
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setLoading(false); }
  }, [childId, crecheId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, [refresh]);
  const decide = async (request: ParentLinkRequest, accept: boolean) => {
    if (busy) return;
    const agreed = await confirm({
      title: accept ? (isArabic ? 'تأكيد ربط الولي' : 'Confirmer la liaison') : (isArabic ? 'رفض الطلب' : 'Refuser la demande'),
      message: accept
        ? (isArabic ? `هل تحققتِ من هوية ${request.parentPrenom} ${request.parentNom} وعلاقته بالطفل ${childName}؟` : `Avez-vous vérifié l’identité de ${request.parentPrenom} ${request.parentNom} et son lien avec ${childName} ?`)
        : (isArabic ? 'هل تريدين رفض طلب الربط؟' : `Refuser la demande de ${request.parentPrenom} ${request.parentNom} ?`),
      confirmLabel: accept ? (isArabic ? 'تأكيد الربط' : 'Confirmer la liaison') : (isArabic ? 'رفض' : 'Refuser'),
      variant: accept ? 'primary' : 'danger',
    });
    if (!agreed) return;
    setBusy(request.id); setResult('');
    try {
      if (accept) { await approveParentLinkRequest({ requestId: request.id, expectedRequestedChildId: childId, enfantIds: [childId], enfants: db.enfants, presences: db.presences, paiements: db.paiements, repas: db.repas, activites: db.activites }); await db.refreshAll(); }
      else await rejectParentLinkRequest(request.id, '', childId);
      setResult(accept ? (isArabic ? 'تم تأكيد الربط.' : 'Liaison confirmée.') : (isArabic ? 'تم رفض الطلب.' : 'Demande refusée.'));
      await refresh();
    } catch { setResult(isArabic ? 'لم يتم تأكيد العملية. حدّثي قبل إعادة المحاولة.' : 'Décision non confirmée. Actualisez avant de réessayer.'); await refresh(); }
    finally { setBusy(''); }
  };
  return <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4" aria-label={isArabic ? 'طلبات ربط الولي' : 'Demandes de liaison parent'}>
    <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><UserCheck size={16} className="text-indigo-600"/>{isArabic ? 'طلبات ربط الولي' : 'Demandes de liaison parent'}</h3><button type="button" onClick={() => void refresh()} aria-label={isArabic ? 'تحديث الطلبات' : 'Actualiser les demandes'} className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-100"><RefreshCw size={16}/></button></div>
    {loading ? <p className="mt-2 text-xs text-slate-500">{isArabic ? 'جاري التحميل...' : 'Chargement...'}</p> : error ? <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{isArabic ? 'تعذر تحميل الطلبات. تحققي من الاتصال.' : 'Impossible de charger les demandes. Vérifiez la connexion.'}</p> : requests.length === 0 ? <p className="mt-2 text-xs text-slate-500">{isArabic ? 'لا توجد طلبات عبر الرمز الشخصي لهذا الطفل.' : 'Aucune demande par QR personnel pour cet enfant.'}</p> : <div className="mt-3 space-y-2">{requests.map(req => <div key={req.id} className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-sm font-bold text-slate-900">{req.parentPrenom} {req.parentNom}</p><p className="mt-1 text-xs text-slate-600">{req.parentLien} · {req.parentTelephone}</p><p className="mt-1 text-xs text-slate-500">{isArabic ? 'أُرسلت في ‏' : 'Envoyée le ‏'}{Number.isNaN(new Date(req.createdAt).getTime()) ? req.createdAt : new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', {dateStyle: 'full', timeStyle: 'medium'}).format(new Date(req.createdAt))}</p><p className="mt-2 text-xs text-amber-700">{isArabic ? 'تحققي من هوية الولي قبل الموافقة.' : 'Vérifiez l’identité du parent avant de valider.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void decide(req,true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isArabic ? 'قبول' : 'Accepter'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void decide(req,false)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">{isArabic ? 'رفض' : 'Refuser'}</button></div></div>)}</div>}
    {result && <p role="status" className="mt-2 text-xs font-semibold text-slate-700">{result}</p>}
  </section>;
}
