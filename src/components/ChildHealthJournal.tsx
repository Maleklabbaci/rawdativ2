import { useEffect, useRef, useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { ChildHealthDraft, ChildHealthEvent, HealthEventType } from '../types';

const labels: Record<HealthEventType, [string, string]> = {
  medicament: ['Médicament administré', 'دواء أُعطي'],
  incident: ['Incident', 'حادث'],
  soin: ['Soin', 'عناية'],
  visite_medicale: ['Visite médicale', 'زيارة طبية'],
  visite_psychologique: ['Visite psychologique', 'زيارة نفسية'],
  rappel_medical: ['Échéance à suivre', 'موعد للمتابعة'],
  correction: ['Correction ou complément', 'تصحيح أو إضافة'],
};
const fields: Partial<Record<HealthEventType, { key: string; fr: string; ar: string; required?: boolean }[]>> = {
  medicament: [
    { key: 'medicament', fr: 'Médicament', ar: 'الدواء', required: true },
    { key: 'dose', fr: 'Dose déclarée', ar: 'الجرعة المسجلة' },
    { key: 'ordonnance', fr: 'Référence de prescription, si disponible', ar: 'مرجع الوصفة إن وجد' },
    { key: 'administrePar', fr: 'Personne ayant administré', ar: 'الشخص الذي أعطى الدواء' },
  ],
  incident: [
    { key: 'gravite', fr: 'Gravité décrite', ar: 'الخطورة المسجلة' },
    { key: 'localisation', fr: 'Lieu', ar: 'المكان' },
    { key: 'soinsDonnes', fr: 'Mesures prises', ar: 'الإجراءات المتخذة' },
    { key: 'parentsAvertis', fr: 'Information des parents (préciser si connue)', ar: 'إعلام الأولياء (حدد إن كان معلوماً)' },
  ],
  soin: [
    { key: 'soinsDonnes', fr: 'Mesures prises', ar: 'الإجراءات المتخذة' },
    { key: 'parentsAvertis', fr: 'Information des parents (préciser si connue)', ar: 'إعلام الأولياء (حدد إن كان معلوماً)' },
  ],
  visite_medicale: [{ key: 'praticien', fr: 'Professionnel', ar: 'المهني' }],
  visite_psychologique: [{ key: 'praticien', fr: 'Professionnel', ar: 'المهني' }],
};
type Form = { type: HealthEventType | ''; date: string; heure: string; description: string; extra: Record<string, string>; correctsId: string | null };
const emptyForm = (): Form => ({ type: '', date: '', heure: '', description: '', extra: {}, correctsId: null });

/** On-demand sensitive records, with no silent empty state or direct table writes. */
export default function ChildHealthJournal({ childId }: { childId: string }) {
  const db = useDb(); const dbRef = useRef(db); dbRef.current = db;
  const { language } = useLanguage(); const ar = language === 'ar';
  const text = (fr: string, arabic: string) => ar ? arabic : fr;
  const [records, setRecords] = useState<ChildHealthEvent[] | null>(null);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [form, setForm] = useState<Form>(emptyForm);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<ChildHealthDraft | null>(null);
  const inFlight = useRef(false); const sequence = useRef(0);

  const reload = async () => {
    const n = ++sequence.current; setLoading(true); setError(''); setRecords(null);
    try {
      const result = await dbRef.current.listChildHealthEvents(childId);
      if (n !== sequence.current) return;
      setRecords(result);
      if (pending.current && result.some(entry => entry.id === pending.current?.id)) {
        pending.current = null; setUncertain(false); setForm(emptyForm());
        setNotice(text('L’entrée a été retrouvée dans le registre.', 'تم العثور على الإدخال في السجل.'));
      }
    } catch {
      if (n === sequence.current) setError(text('Registre de santé indisponible. Réessayez ; ceci ne signifie pas que le dossier est vide.', 'سجل الصحة غير متاح. أعد المحاولة؛ هذا لا يعني أن الملف فارغ.'));
    } finally { if (n === sequence.current) setLoading(false); }
  };
  useEffect(() => { void reload(); return () => { sequence.current++; }; }, [childId]);

  const save = async () => {
    if (inFlight.current) return;
    let attempt = pending.current;
    if (!attempt) {
      if (!form.type || !form.date || !form.description.trim() || (form.type === 'medicament' && !form.extra.medicament?.trim()) || (form.type === 'correction' && !form.correctsId)) return;
      const detail: Record<string, string> = { description: form.description.trim() };
      for (const field of fields[form.type] || []) if (form.extra[field.key]?.trim()) detail[field.key] = form.extra[field.key].trim();
      attempt = { id: `health_${crypto.randomUUID()}`, type: form.type, date: form.date, heure: form.heure, details: detail, correctsId: form.correctsId };
      pending.current = attempt;
    }
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await dbRef.current.addChildHealthEvent(childId, attempt);
      pending.current = null; setUncertain(false); setForm(emptyForm());
      setNotice(text('Entrée enregistrée.', 'تم حفظ الإدخال.'));
      await reload();
    } catch {
      setUncertain(true);
      setError(text('Enregistrement non confirmé. Actualisez pour vérifier ou réessayez exactement la même entrée ; ne créez pas une autre copie.', 'لم يتم تأكيد الحفظ. حدّث السجل للتحقق أو أعد محاولة الإدخال نفسه دون إنشاء نسخة أخرى.'));
    } finally { inFlight.current = false; setBusy(false); }
  };
  const beginCorrection = (entry: ChildHealthEvent) => {
    setForm({ ...emptyForm(), type: 'correction', correctsId: entry.id });
    setNotice('');
  };
  const activeFields = form.type ? fields[form.type] || [] : [];
  return <section className="space-y-4">
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <h3 className="text-sm font-black text-rose-900">{text('Suivi santé confidentiel', 'متابعة صحية سرية')}</h3>
      <p className="mt-2 text-xs font-semibold text-rose-900">{text('Renseignez uniquement les informations nécessaires. Ce registre ne remplace ni un professionnel de santé ni les procédures de la crèche ; une échéance ne déclenche pas de rappel automatique.', 'سجّل المعلومات الضرورية فقط. لا يحل هذا السجل محل المهني الصحي أو إجراءات الروضة؛ ولا ينشئ الموعد تنبيهاً آلياً.')}</p>
    </div>
    <button type="button" onClick={() => void reload()} disabled={loading || busy} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">{text('Actualiser', 'تحديث')}</button>
    {loading && <p role="status" className="text-xs">{text('Chargement…', 'جار التحميل…')}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
    {records && <>
      {records.length === 0 ? <p className="text-xs font-bold text-slate-500">{text('Aucune entrée enregistrée dans ce registre.', 'لا توجد إدخالات مسجلة في هذا السجل.')}</p> : <ul className="space-y-3">{records.map(entry => <li key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-900">{labels[entry.type]?.[ar ? 1 : 0] || entry.type}</strong><span>{entry.date}{entry.heure ? ` · ${entry.heure}` : ''}</span></div>
        {entry.correctsId && <p className="mt-2 break-all text-amber-800">{text('Complète ou corrige l’entrée', 'تصحيح أو إضافة للإدخال')}: {entry.correctsId}</p>}
        <p className="mt-2 whitespace-pre-wrap break-words font-semibold">{entry.details.description}</p>
        {(fields[entry.type] || []).filter(field => entry.details[field.key]).map(field => <p key={field.key} className="mt-1 break-words"><strong>{ar ? field.ar : field.fr}:</strong> {entry.details[field.key]}</p>)}
        <p className="mt-2 break-words text-slate-500">{text('Saisi par', 'سجله')}: {entry.createdBy} · {entry.createdAt} · {text('Réf.', 'المرجع')} {entry.id}</p>
        <button type="button" disabled={busy || uncertain} onClick={() => beginCorrection(entry)} className="mt-3 rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-700 disabled:opacity-50">{text('Corriger ou compléter', 'تصحيح أو إضافة')}</button>
      </li>)}</ul>}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-black">{text('Nouvelle entrée', 'إدخال جديد')}</h4>
        <p className="text-xs text-slate-600">{text('Les corrections sont ajoutées au journal : l’entrée d’origine reste visible.', 'تُضاف التصحيحات إلى السجل ويبقى الإدخال الأصلي ظاهراً.')}</p>
        {form.correctsId && <p className="break-all text-xs font-bold text-amber-800">{text('Entrée concernée', 'الإدخال المعني')}: {form.correctsId}</p>}
        <fieldset disabled={busy || uncertain} className="grid gap-3">
          <label className="text-xs font-bold">{text('Type *', 'النوع *')}<select value={form.type} onChange={e => setForm({ ...emptyForm(), type: e.target.value as HealthEventType | '' })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2"><option value="">{text('Choisir', 'اختر')}</option>{Object.entries(labels).filter(([key]) => key !== 'correction').map(([key,label]) => <option key={key} value={key}>{label[ar ? 1 : 0]}</option>)}{form.type === 'correction' && <option value="correction">{labels.correction[ar ? 1 : 0]}</option>}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">{text('Date de l’événement *', 'تاريخ الحدث *')}<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" /></label><label className="text-xs font-bold">{text('Heure (facultative)', 'الوقت (اختياري)')}<input type="time" value={form.heure} onChange={e => setForm({ ...form, heure: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" /></label></div>
          <label className="text-xs font-bold">{text('Description *', 'الوصف *')}<textarea maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" /></label>
          {activeFields.map(field => <label key={field.key} className="text-xs font-bold">{ar ? field.ar : field.fr}{field.required ? ' *' : ''}<input maxLength={2000} value={form.extra[field.key] || ''} onChange={e => setForm({ ...form, extra: { ...form.extra, [field.key]: e.target.value } })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2" /></label>)}
          {form.correctsId && <button type="button" onClick={() => setForm(emptyForm())} className="text-start text-xs font-bold text-slate-600 underline">{text('Annuler la correction', 'إلغاء التصحيح')}</button>}
        </fieldset>
        <button type="button" disabled={busy || (!uncertain && (!form.type || !form.date || !form.description.trim() || (form.type === 'medicament' && !form.extra.medicament?.trim()) || (form.type === 'correction' && !form.correctsId)))} onClick={() => void save()} className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">{uncertain ? text('Réessayer la même entrée', 'إعادة محاولة الإدخال نفسه') : text('Enregistrer l’entrée', 'حفظ الإدخال')}</button>
      </div>
    </>}
  </section>;
}
