import { useEffect, useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import type { PickupAuthorization, PickupAuthorizationDraft } from '../types';

/** Explicit registry declarations only; never equates a contact with an authorization. */
export default function PickupAuthorizations({ childId, compact = false, onRecordsChange }: { childId: string; compact?: boolean; onRecordsChange?: (records: PickupAuthorization[] | null) => void }) {
  const db = useDb();
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const ar = language === 'ar';
  const text = (fr: string, arabic: string) => ar ? arabic : fr;
  const [open, setOpen] = useState(!compact);
  const [records, setRecords] = useState<PickupAuthorization[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const dbRef = useRef(db);
  dbRef.current = db;
  const [draft, setDraft] = useState({ nom: '', lien: '', telephone: '', referenceAutorisation: '' });
  const [attested, setAttested] = useState(false);
  const requestId = useRef<string | null>(null);

  const reload = async () => {
    const current = ++sequence.current;
    setLoading(true); setError(''); setRecords(null); onRecordsChange?.(null);
    try {
      const result = await dbRef.current.listPickupAuthorizations(childId);
      if (current === sequence.current) { setRecords(result); onRecordsChange?.(result); }
    } catch {
      if (current === sequence.current) setError(text('Registre indisponible. Ne déduisez aucune autorisation de cette erreur ; réessayez ou vérifiez le dossier autrement.', 'السجل غير متاح. لا تستنتج وجود ترخيص من هذا الخطأ؛ أعد المحاولة أو تحقق من الملف بطريقة أخرى.'));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (open) void reload();
    return () => { sequence.current++; };
    // The provider methods change identity on render; reload only for child/open changes.
  }, [childId, open]);

  const create = async () => {
    if (busyRef.current || !draft.nom.trim() || !draft.lien.trim() || !draft.referenceAutorisation.trim() || !attested) return;
    busyRef.current = true; setBusy(true); setError('');
    const id = requestId.current || (requestId.current = `pickup_${crypto.randomUUID()}`);
    try {
      await dbRef.current.createPickupAuthorization(childId, { ...draft, id } as PickupAuthorizationDraft);
      requestId.current = null;
      setDraft({ nom: '', lien: '', telephone: '', referenceAutorisation: '' }); setAttested(false);
      await reload();
    } catch {
      setError(text('Enregistrement non confirmé. Actualisez le registre et vérifiez avant de réessayer ; ne créez pas de doublon.', 'لم يتم تأكيد الحفظ. حدّث السجل وتحقق قبل إعادة المحاولة لتجنب التكرار.'));
    } finally { busyRef.current = false; setBusy(false); }
  };
  const revoke = async (record: PickupAuthorization) => {
    if (busyRef.current) return;
    const ok = await confirm({
      title: text('Révoquer cette déclaration ?', 'إلغاء هذا التصريح؟'),
      message: text('Elle restera dans l’historique. Vérifiez aussi le document et les consignes de la crèche.', 'سيبقى التصريح في السجل. تحقق أيضاً من الوثيقة وتعليمات الروضة.'),
      confirmLabel: text('Révoquer', 'إلغاء الترخيص'), variant: 'danger',
    });
    if (!ok || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await dbRef.current.revokePickupAuthorization(childId, record.id); await reload(); }
    catch { setRecords(null); setError(text('Révocation non confirmée. Actualisez le registre et vérifiez le dossier avant toute remise.', 'لم يتم تأكيد الإلغاء. حدّث السجل وتحقق من الملف قبل أي تسليم.')); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
    {compact && <button type="button" className="text-xs font-black text-indigo-700 underline" onClick={() => { if (open) onRecordsChange?.(null); setOpen(value => !value); }}>{open ? text('Masquer le registre de retrait', 'إخفاء سجل الاستلام') : text('Consulter le registre de retrait', 'عرض سجل الاستلام')}</button>}
    {open && <>
      <h3 className="text-sm font-black text-amber-950">{text('Personnes déclarées pour le retrait', 'الأشخاص المصرّح بهم للاستلام')}</h3>
      <p className="text-xs font-semibold text-amber-900">{text('Déclarations saisies par la crèche : la validité du document n’est pas vérifiée automatiquement. Avant chaque remise, actualisez et vérifiez identité, autorisation et consignes auprès du responsable. Les contacts ne sont pas automatiquement autorisés.', 'تصريحات تسجلها الروضة دون تحقق آلي من صلاحية الوثيقة. قبل كل تسليم، حدّث السجل وتحقق من الهوية والترخيص والتعليمات مع المسؤول. جهات الاتصال ليست مخولة تلقائياً.')}</p>
      <button type="button" onClick={() => void reload()} disabled={loading || busy} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">{text('Actualiser le registre', 'تحديث السجل')}</button>
      {loading && <p role="status" className="text-xs">{text('Chargement…', 'جار التحميل…')}</p>}
      {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
      {records && <>
        {records.length === 0 ? <p className="text-xs font-bold text-slate-600">{text('Aucune déclaration enregistrée.', 'لا توجد تصريحات مسجلة.')}</p> : <ul className="space-y-2">{records.map(record => <li key={record.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{record.nom} · {record.lien}</strong><span className={record.revokedAt ? 'font-bold text-rose-700' : 'font-bold text-amber-800'}>{record.revokedAt ? text('Révoquée', 'ملغاة') : text('Déclarée active', 'مصرّح بها كفعالة')}</span></div>
          {record.telephone && <p className="mt-1">{record.telephone}</p>}
          <p className="mt-1 break-words">{text('Référence déclarée', 'المرجع المسجل')}: {record.referenceAutorisation}</p>
          <p className="mt-1 break-words text-slate-500">{text('Enregistré', 'تاريخ التسجيل')}: {record.createdAt} · {record.createdBy}</p>
          {record.revokedAt && <p className="mt-1 break-words text-rose-700">{text('Révoqué', 'تاريخ الإلغاء')}: {record.revokedAt} · {record.revokedBy}</p>}
          {!compact && !record.revokedAt && <button type="button" disabled={busy || loading} onClick={() => void revoke(record)} className="mt-2 rounded-lg border border-rose-200 px-3 py-2 font-bold text-rose-700 disabled:opacity-50">{text('Révoquer', 'إلغاء الترخيص')}</button>}
        </li>)}</ul>}
        {!compact && <div className="space-y-2 border-t border-amber-200 pt-3">
          <h4 className="text-xs font-black">{text('Ajouter une déclaration', 'إضافة تصريح')}</h4>
          <p className="text-xs text-slate-600">{text('Pour corriger une entrée, révoquez-la puis ajoutez-en une nouvelle. Aucun parent ou contact n’est ajouté automatiquement.', 'لتصحيح تصريح ألغِه ثم أضف تصريحاً جديداً. لا يُضاف أي ولي أو جهة اتصال تلقائياً.')}</p>
          {(() => {
            const child = db.enfants.find(item => item.id === childId);
            const candidates = (child?.parents || []).filter(parent => {
              const fullName = `${parent.prenom || ''} ${parent.nom || ''}`.trim();
              if (!fullName) return false;
              return !(records || []).some(rec => !rec.revokedAt && rec.nom.trim().toLowerCase() === fullName.toLowerCase());
            });
            if (candidates.length === 0) return null;
            return (
              <div className="rounded-xl border border-amber-200/80 bg-white/80 p-2.5 space-y-1.5">
                <p className="text-[11px] font-bold text-slate-600">
                  {text('Gain de temps : préremplir depuis le dossier (il restera à saisir la pièce vérifiée)', 'اختصار للوقت: ملء الاسم والهاتف من الملف (مع إدخال مرجع الوثيقة وتأكيد التحقق)')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {candidates.map(parent => {
                    const fullName = `${parent.prenom || ''} ${parent.nom || ''}`.trim();
                    return (
                      <button
                        key={parent.id || fullName}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setDraft(prev => ({
                            ...prev,
                            nom: fullName,
                            lien: parent.lien || prev.lien,
                            telephone: parent.telephone || prev.telephone,
                          }))
                        }
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer disabled:opacity-50"
                      >
                        + {fullName}{parent.lien ? ` (${parent.lien})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <fieldset disabled={busy} className="grid gap-2">
            <label className="text-xs font-bold">{text('Nom complet *', 'الاسم الكامل *')}<input maxLength={200} value={draft.nom} onChange={e => setDraft({ ...draft, nom: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
            <label className="text-xs font-bold">{text('Lien avec l’enfant *', 'صلة القرابة *')}<input maxLength={100} value={draft.lien} onChange={e => setDraft({ ...draft, lien: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
            <label className="text-xs font-bold">{text('Téléphone (facultatif)', 'الهاتف (اختياري)')}<input maxLength={60} value={draft.telephone} onChange={e => setDraft({ ...draft, telephone: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
            <label className="text-xs font-bold">{text('Référence de l’autorisation vérifiée *', 'مرجع الترخيص الذي تم التحقق منه *')}<input maxLength={500} value={draft.referenceAutorisation} onChange={e => setDraft({ ...draft, referenceAutorisation: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
            <label className="flex gap-2 text-xs font-bold"><input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} />{text('Je déclare avoir vérifié la désignation auprès du responsable et le document de référence.', 'أصرّح أنني تحققت من التعيين مع المسؤول ومن الوثيقة المرجعية.')}</label>
            <button type="button" onClick={() => void create()} disabled={busy || !attested || !draft.nom.trim() || !draft.lien.trim() || !draft.referenceAutorisation.trim()} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{text('Enregistrer la déclaration', 'حفظ التصريح')}</button>
          </fieldset>
        </div>}
      </>}
    </>}
  </section>;
}
