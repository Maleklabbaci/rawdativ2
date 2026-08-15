import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Baby, CheckCircle2, FileText, HeartPulse, Loader2, Send, ShieldCheck, Upload, Users } from 'lucide-react';
import { supabase } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';

type AdmissionContext = {
  linkId: string;
  nomCreche: string;
  adresse?: string;
  logoUrl?: string | null;
  siteWeb?: string;
};

type DocumentKey = 'certificatMedical' | 'carnetVaccination' | 'justificatifDomicile' | 'photoIdentite';
type UploadData = { nom: string; type: string; taille: number; contenu: string; ajouteLe: string };

type FormState = {
  nom: string;
  prenom: string;
  dateNaissance: string;
  genre: 'Garçon' | 'Fille';
  groupeAge: 'Bébés' | 'Moyens' | 'Grands';
  allergie: string;
  regimeAlimentaire: string;
  bloodGroup: string;
  weightKg: string;
  pediatricianName: string;
  vaccinations: string;
  notesMedicales: string;
  parentNom: string;
  parentPrenom: string;
  parentTelephone: string;
  parentEmail: string;
  parentAdresse: string;
  parentProfession: string;
  parentLien: 'Mère' | 'Père' | 'Tuteur';
  documentsRequis: Record<DocumentKey, boolean>;
  documentsFichiers: Partial<Record<DocumentKey, UploadData>>;
};

const initialForm: FormState = {
  nom: '', prenom: '', dateNaissance: '', genre: 'Garçon', groupeAge: 'Bébés',
  allergie: '', regimeAlimentaire: '', bloodGroup: '', weightKg: '', pediatricianName: '',
  vaccinations: '', notesMedicales: '', parentNom: '', parentPrenom: '', parentTelephone: '',
  parentEmail: '', parentAdresse: '', parentProfession: '', parentLien: 'Mère',
  documentsRequis: { certificatMedical: false, carnetVaccination: false, justificatifDomicile: false, photoIdentite: false },
  documentsFichiers: {},
};

const documentLabels = (isAr: boolean): Record<DocumentKey, string> => ({
  certificatMedical: isAr ? 'الشهادة الطبية' : 'Certificat médical',
  carnetVaccination: isAr ? 'دفتر التلقيح' : 'Carnet de vaccination',
  justificatifDomicile: isAr ? 'إثبات السكن' : 'Justificatif de domicile',
  photoIdentite: isAr ? 'صورة الطفل' : "Photo d'identité de l'enfant",
});

export default function PublicAdmission() {
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() || '', []);
  const [context, setContext] = useState<AdmissionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setError(isAr ? 'رابط التسجيل غير صالح.' : "Le lien d'inscription est invalide.");
      setLoading(false);
      return () => { active = false; };
    }
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('rawdha_get_inscription_context', { p_token: token });
      if (!active) return;
      if (rpcError || !data) {
        setError(isAr ? 'هذا الرابط غير صالح أو منتهي الصلاحية.' : 'Ce lien est invalide ou a expiré.');
      } else {
        setContext(data as AdmissionContext);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, isAr]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleFile = (key: DocumentKey, file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(isAr ? 'الملف كبير جداً. الحد الأقصى 2 ميغابايت.' : 'Le fichier est trop volumineux. La limite est de 2 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const contenu = typeof reader.result === 'string' ? reader.result : '';
      if (!contenu) return;
      setForm(prev => ({
        ...prev,
        documentsRequis: { ...prev.documentsRequis, [key]: true },
        documentsFichiers: {
          ...prev.documentsFichiers,
          [key]: { nom: file.name, type: file.type || 'application/octet-stream', taille: file.size, contenu, ajouteLe: new Date().toISOString() },
        },
      }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!context || !token) return;
    if (!form.nom.trim() || !form.prenom.trim() || !form.dateNaissance || !form.parentNom.trim() || !form.parentPrenom.trim() || !form.parentTelephone.trim()) {
      setError(isAr ? 'يرجى ملء جميع الحقول الإلزامية.' : 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('rawdha_submit_admission', {
      p_token: token,
      p_payload: {
        ...form,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        parentNom: form.parentNom.trim(),
        parentPrenom: form.parentPrenom.trim(),
        parentTelephone: form.parentTelephone.trim(),
      },
    });
    setSubmitting(false);
    if (rpcError) {
      const code = rpcError.message || '';
      setError(code.includes('invalid_link')
        ? (isAr ? 'هذا الرابط غير صالح أو منتهي الصلاحية.' : 'Ce lien est invalide ou a expiré.')
        : (isAr ? 'تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.' : "Impossible d'envoyer la demande. Veuillez réessayer."));
      return;
    }
    setSubmitted(true);
  };

  const title = isAr ? 'طلب تسجيل طفل' : "Demande d'admission";
  const subtitle = isAr ? 'املأوا الملف بعناية، وستراجعه إدارة الروضة قبل القبول.' : "Remplissez le dossier avec soin. La direction de la crèche le vérifiera avant toute acceptation.";
  const labels = documentLabels(isAr);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white" dir={isAr ? 'rtl' : 'ltr'}><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-8 text-slate-900" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            {context?.logoUrl ? <img src={context.logoUrl} alt="Logo" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500"><Baby className="h-6 w-6" /></div>}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">RAWDHA+</p>
              <h1 className="text-lg font-black sm:text-2xl">{context?.nomCreche || 'Rawdha+'}</h1>
              {context?.adresse && <p className="text-xs text-indigo-200">{context.adresse}</p>}
            </div>
          </div>
          <div className="flex rounded-xl border border-white/15 bg-white/10 p-1 text-xs font-bold backdrop-blur">
            <button type="button" onClick={() => setLanguage('fr')} className={`rounded-lg px-3 py-2 ${!isAr ? 'bg-white text-indigo-700' : 'text-white'}`}>FR</button>
            <button type="button" onClick={() => setLanguage('ar')} className={`rounded-lg px-3 py-2 ${isAr ? 'bg-white text-indigo-700' : 'text-white'}`}>عربي</button>
          </div>
        </div>

        {!context || error && !submitted ? (
          <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-500" />
            <h2 className="text-xl font-black text-slate-900">{isAr ? 'الرابط غير متاح' : 'Lien non disponible'}</h2>
            <p className="mt-2 text-sm text-slate-500">{error || (isAr ? 'تحقق من الرابط المرسل من الروضة.' : 'Vérifiez le lien transmis par la crèche.')}</p>
          </div>
        ) : submitted ? (
          <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-12">
            <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-emerald-500" />
            <h2 className="text-2xl font-black text-slate-900">{isAr ? 'تم إرسال الطلب بنجاح' : 'Demande envoyée avec succès'}</h2>
            <p className="mt-3 leading-7 text-slate-600">{isAr ? 'ستراجع إدارة الروضة الملف وتتواصل معكم عند اتخاذ القرار.' : "La direction de la crèche va examiner le dossier et vous contactera après sa décision."}</p>
            <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{isAr ? 'يمكنكم الآن إغلاق هذه الصفحة.' : 'Vous pouvez maintenant fermer cette page.'}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-7 text-white sm:px-10">
              <div className="flex items-start gap-4"><ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-indigo-100" /><div><h2 className="text-2xl font-black">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">{subtitle}</p></div></div>
            </div>
            <div className="space-y-8 p-5 sm:p-10">
              {error && <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

              <section>
                <SectionTitle icon={<Baby className="h-5 w-5" />} title={isAr ? 'معلومات الطفل' : "Informations de l'enfant"} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={isAr ? 'اللقب *' : 'Nom *'} value={form.nom} onChange={v => updateField('nom', v)} required />
                  <Field label={isAr ? 'الاسم *' : 'Prénom *'} value={form.prenom} onChange={v => updateField('prenom', v)} required />
                  <Field label={isAr ? 'تاريخ الميلاد *' : 'Date de naissance *'} type="date" value={form.dateNaissance} onChange={v => updateField('dateNaissance', v)} required />
                  <SelectField label={isAr ? 'الجنس' : 'Genre'} value={form.genre} onChange={v => updateField('genre', v as FormState['genre'])} options={isAr ? [{ value: 'Garçon', label: 'ذكر' }, { value: 'Fille', label: 'أنثى' }] : [{ value: 'Garçon', label: 'Garçon' }, { value: 'Fille', label: 'Fille' }]} />
                  <SelectField label={isAr ? 'الفئة العمرية' : 'Groupe d’âge'} value={form.groupeAge} onChange={v => updateField('groupeAge', v as FormState['groupeAge'])} options={isAr ? [{ value: 'Bébés', label: 'رضع' }, { value: 'Moyens', label: 'متوسطون' }, { value: 'Grands', label: 'كبار' }] : [{ value: 'Bébés', label: 'Bébés' }, { value: 'Moyens', label: 'Moyens' }, { value: 'Grands', label: 'Grands' }]} />
                </div>
              </section>

              <section>
                <SectionTitle icon={<HeartPulse className="h-5 w-5" />} title={isAr ? 'الصحة والاحتياجات الخاصة' : 'Santé et besoins particuliers'} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={isAr ? 'فصيلة الدم' : 'Groupe sanguin'} value={form.bloodGroup} onChange={v => updateField('bloodGroup', v)} placeholder="O+" />
                  <Field label={isAr ? 'الوزن (كغ)' : 'Poids (kg)'} type="number" value={form.weightKg} onChange={v => updateField('weightKg', v)} />
                  <Field label={isAr ? 'الطبيب المعالج' : 'Médecin traitant'} value={form.pediatricianName} onChange={v => updateField('pediatricianName', v)} />
                  <TextAreaField className="sm:col-span-2 lg:col-span-3" label={isAr ? 'الحساسيات' : 'Allergies'} value={form.allergie} onChange={v => updateField('allergie', v)} />
                  <TextAreaField className="sm:col-span-2 lg:col-span-3" label={isAr ? 'النظام الغذائي' : 'Régime alimentaire'} value={form.regimeAlimentaire} onChange={v => updateField('regimeAlimentaire', v)} />
                  <TextAreaField className="sm:col-span-2 lg:col-span-3" label={isAr ? 'التلقيحات' : 'Vaccinations'} value={form.vaccinations} onChange={v => updateField('vaccinations', v)} />
                  <TextAreaField className="sm:col-span-2 lg:col-span-3" label={isAr ? 'ملاحظات طبية' : 'Notes médicales'} value={form.notesMedicales} onChange={v => updateField('notesMedicales', v)} />
                </div>
              </section>

              <section>
                <SectionTitle icon={<Users className="h-5 w-5" />} title={isAr ? 'ولي الأمر أو الوصي' : 'Parent ou tuteur légal'} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={isAr ? 'اللقب *' : 'Nom *'} value={form.parentNom} onChange={v => updateField('parentNom', v)} required />
                  <Field label={isAr ? 'الاسم *' : 'Prénom *'} value={form.parentPrenom} onChange={v => updateField('parentPrenom', v)} required />
                  <Field label={isAr ? 'الهاتف *' : 'Téléphone *'} type="tel" value={form.parentTelephone} onChange={v => updateField('parentTelephone', v)} required />
                  <Field label={isAr ? 'البريد الإلكتروني' : 'E-mail'} type="email" value={form.parentEmail} onChange={v => updateField('parentEmail', v)} />
                  <Field label={isAr ? 'المهنة' : 'Profession'} value={form.parentProfession} onChange={v => updateField('parentProfession', v)} />
                  <SelectField label={isAr ? 'صلة القرابة' : 'Lien'} value={form.parentLien} onChange={v => updateField('parentLien', v as FormState['parentLien'])} options={isAr ? [{ value: 'Mère', label: 'الأم' }, { value: 'Père', label: 'الأب' }, { value: 'Tuteur', label: 'الوصي' }] : [{ value: 'Mère', label: 'Mère' }, { value: 'Père', label: 'Père' }, { value: 'Tuteur', label: 'Tuteur' }]} />
                  <TextAreaField className="sm:col-span-2 lg:col-span-3" label={isAr ? 'العنوان' : 'Adresse'} value={form.parentAdresse} onChange={v => updateField('parentAdresse', v)} />
                </div>
              </section>

              <section>
                <SectionTitle icon={<FileText className="h-5 w-5" />} title={isAr ? 'الوثائق' : 'Pièces du dossier'} />
                <p className="mb-4 text-xs leading-5 text-slate-500">{isAr ? 'يمكنكم تحديد الوثائق المتوفرة وإرفاقها. الحد الأقصى لكل ملف 2 ميغابايت.' : 'Cochez les pièces disponibles et joignez-les si vous le souhaitez. Limite de 2 Mo par fichier.'}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(labels) as DocumentKey[]).map(key => (
                    <label key={key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
                      <input type="checkbox" checked={form.documentsRequis[key]} onChange={e => updateField('documentsRequis', { ...form.documentsRequis, [key]: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                      <span className="flex-1 text-sm font-semibold text-slate-700">{labels[key]}</span>
                      <span className="relative cursor-pointer rounded-xl bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100" title={isAr ? 'إرفاق ملف' : 'Joindre un fichier'}><Upload className="h-4 w-4" /><input type="file" accept="image/*,.pdf" onChange={e => handleFile(key, e.target.files?.[0])} className="absolute inset-0 cursor-pointer opacity-0" /></span>
                      {form.documentsFichiers[key] && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </label>
                  ))}
                </div>
              </section>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-xs leading-5 text-slate-500">{isAr ? 'لن يتم قبول الطفل تلقائياً. ستراجع إدارة الروضة الطلب أولاً.' : "L'enfant ne sera pas ajouté automatiquement. La direction vérifiera d'abord la demande."}</p>
                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? (isAr ? 'جاري الإرسال...' : 'Envoi en cours...') : (isAr ? 'إرسال الطلب' : 'Envoyer la demande')}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="mb-4 flex items-center gap-2 text-indigo-700"><span className="rounded-xl bg-indigo-50 p-2">{icon}</span><h3 className="text-lg font-black">{title}</h3></div>;
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></label>;
}

function TextAreaField({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><textarea rows={3} value={value} onChange={e => onChange(e.target.value)} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
