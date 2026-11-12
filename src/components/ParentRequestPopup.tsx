import { useEffect, useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { loadParentLinkRequests, approveParentLinkRequest, rejectParentLinkRequest, subscribeToParentPortalChanges, type ParentLinkRequest } from '../utils/parentPortal';

export default function ParentRequestPopup({ crecheId, isArabic, openRequests }: { crecheId: string; isArabic: boolean; openRequests: () => void }) {
 const db = useDb();
 const { confirm } = useConfirmDialog();
 const [pending, setPending] = useState<ParentLinkRequest[]>([]);
 const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const inFlight = useRef(false);
 useEffect(() => {
  let alive = true;
  const refresh = async () => {
   if (inFlight.current) return;
   inFlight.current = true;
   try { const rows = await loadParentLinkRequests(crecheId); if (alive) { setPending(rows.filter(r => r.status === 'pending')); setError(''); } }
   catch { if (alive) setError(isArabic ? 'تعذر تحديث طلبات الأولياء.' : 'Impossible d’actualiser les demandes parents.'); }
   finally { inFlight.current = false; }
  };
  void refresh();
  const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
  const focus = () => void refresh();
  window.addEventListener('focus', focus);
  const unsubscribe = subscribeToParentPortalChanges(focus);
  return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', focus); unsubscribe(); };
 }, [crecheId, isArabic]);
 const req = pending.filter(r => !dismissed.has(r.id)).sort((a,b) => a.createdAt.localeCompare(b.createdAt))[0];
 const child = req?.requestedChildId ? db.enfants.find(e => e.id === req.requestedChildId && e.crecheId === crecheId) : undefined;
 const dismiss = () => { if (req) setDismissed(prev => new Set([...prev, req.id])); };
 const decide = async (accept: boolean) => {
  if (!req || busy || !child) return;
  const ok = await confirm({ title: accept ? (isArabic ? 'تأكيد هوية الولي' : 'Vérifier l’identité du parent') : (isArabic ? 'رفض الطلب' : 'Refuser la demande'), message: accept ? (isArabic ? `هل تحققتِ من هوية ${req.parentPrenom} ${req.parentNom} وعلاقته بالطفل ${child.prenom} ${child.nom}؟` : `Avez-vous vérifié l’identité de ${req.parentPrenom} ${req.parentNom} et son lien avec ${child.prenom} ${child.nom} ?`) : (isArabic ? 'هل تريدين رفض الطلب؟' : 'Confirmer le refus de cette demande ?'), variant: accept ? 'primary' : 'danger', confirmLabel: accept ? (isArabic ? 'تأكيد' : 'Confirmer') : (isArabic ? 'رفض' : 'Refuser') });
  if (!ok) return;
  setBusy(true); setError('');
  try {
   if (accept) { await approveParentLinkRequest({ requestId: req.id, expectedRequestedChildId: child.id, enfantIds: [child.id], enfants: db.enfants, presences: db.presences, repas: db.repas, activites: db.activites, paiements: db.paiements }); await db.refreshAll(); }
   else await rejectParentLinkRequest(req.id, '', child.id);
   setPending(prev => prev.filter(r => r.id !== req.id));
  } catch { setError(isArabic ? 'لم يتم تأكيد العملية. تحققي من الطلب قبل إعادة المحاولة.' : 'Décision non confirmée. Vérifiez la demande avant de réessayer.'); }
  finally { setBusy(false); }
 };
 if (!req) return error ? <div role="alert" className="fixed bottom-20 right-4 z-[900] rounded-xl bg-amber-50 p-3 text-xs text-amber-900 shadow">{error}</div> : null;
 const date = new Date(req.createdAt);
 const when = Number.isNaN(date.getTime()) ? req.createdAt : new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', {dateStyle:'full',timeStyle:'medium'}).format(date);
 return <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-950/60 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="parent-request-title" className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"><div className="flex justify-between gap-3"><h2 id="parent-request-title" className="text-lg font-black">{isArabic ? 'طلب ربط ولي' : 'Nouvelle demande parent'}</h2><button type="button" onClick={dismiss} aria-label={isArabic ? 'إغلاق' : 'Fermer'} className="rounded-lg px-2 text-xl">×</button></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-500">{isArabic ? 'الطفل' : 'Enfant'}</dt><dd className="font-bold">{child ? `${child.prenom} ${child.nom}` : req.requestedChildId ? (isArabic ? 'الطفل غير متاح' : 'Enfant indisponible') : (req.requestedChildren.map(c => `${c.prenom} ${c.nom}`).join(', ') || '—')}</dd></div><div><dt className="text-xs text-slate-500">{isArabic ? 'الولي' : 'Parent'}</dt><dd className="font-bold">{req.parentPrenom} {req.parentNom} · {req.parentLien}</dd></div><div><dt className="text-xs text-slate-500">{isArabic ? 'الهاتف' : 'Téléphone'}</dt><dd>{req.parentTelephone}</dd></div><div><dt className="text-xs text-slate-500">{isArabic ? 'تاريخ ووقت الإرسال' : 'Envoyée le'}</dt><dd>{when}</dd></div></dl><p className="mt-4 text-xs font-semibold text-amber-800">{isArabic ? 'تحققي من هوية الولي وعلاقته بالطفل قبل القبول.' : 'Vérifiez l’identité du parent et son lien avec l’enfant avant d’accepter.'}</p>{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}<div className="mt-5 flex flex-wrap gap-2">{child ? <><button type="button" disabled={busy} onClick={() => void decide(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isArabic ? 'قبول' : 'Accepter'}</button><button type="button" disabled={busy} onClick={() => void decide(false)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">{isArabic ? 'رفض' : 'Refuser'}</button></> : <button type="button" onClick={() => { dismiss(); openRequests(); }} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">{isArabic ? 'التواصل ثم رمز الأولياء' : 'Communication → QR Parents'}</button>}<button type="button" onClick={dismiss} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-600">{isArabic ? 'لاحقاً' : 'Plus tard'}</button></div></div></div>;
}
