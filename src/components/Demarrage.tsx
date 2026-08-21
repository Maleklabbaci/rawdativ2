import { useState } from 'react';
import { Building2, Check, Globe, Mail, MapPin, Phone, User, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { setCollectionDocument } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';

export default function Demarrage({ onDone }: { onDone: () => void }) {
  const { user, refreshCreche } = useAuth();
  const { updateCompte } = useDb();
  const { language } = useLanguage();
  const isFrench = language !== 'ar';

  const [nom, setNom] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [nomCreche, setNomCreche] = useState(user?.nomCreche || '');
  const [tarif, setTarif] = useState('3500');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [siteWeb, setSiteWeb] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!nom || !prenom || !nomCreche || !tarif || !telephone || !adresse) {
      setError(isFrench ? 'Merci de remplir tous les champs obligatoires (*).' : 'يرجى ملء جميع الحقول الإلزامية (*).');
      return;
    }
    if (!user) return;

    setSaving(true);
    setError('');
    try {
      await setCollectionDocument('parametres', `creche_${user.id}`, {
        id: `creche_${user.id}`,
        crecheName: nomCreche,
        principalEmail: email,
        phoneNumbers: telephone,
        addressLine: adresse,
        tuitionFeeRate: tarif,
        siteWeb: siteWeb || '',
        logoUrl: '',
      });
      await updateCompte(user.id, { nom, prenom, nomCreche });
      await refreshCreche();
      onDone();
    } catch {
      setError(isFrench ? "Erreur lors de l'enregistrement, réessayez." : 'حدث خطأ أثناء الحفظ، حاولوا مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{isFrench ? 'Démarrage' : 'البدء'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {isFrench ? 'Configurer votre crèche' : 'إعداد الحضانة'}
        </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {isFrench
              ? 'Vérifiez les informations affichées avant de les enregistrer. Vous pourrez les modifier ensuite dans Paramètres.'
              : 'تحققوا من المعلومات المعروضة قبل حفظها، ويمكنكم تعديلها لاحقاً من الإعدادات.'}
          </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <section className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">{isFrench ? 'Les trois étapes' : 'المراحل الثلاث'}</h2>
          <div className="mt-5 space-y-4">
            {[
              [Building2, isFrench ? 'Votre crèche' : 'الحضانة', isFrench ? 'Coordonnées et tarif mensuel.' : 'المعلومات والتعريفة الشهرية.'],
              [User, isFrench ? 'Vos enfants' : 'الأطفال', isFrench ? 'Ajoutez les enfants et leurs responsables.' : 'أضيفوا الأطفال وأولياءهم.'],
              [Check, isFrench ? 'Votre suivi' : 'المتابعة', isFrench ? 'Gérez présences, repas et paiements.' : 'تابعوا الحضور والوجبات والمدفوعات.'],
            ].map(([Icon, title, description], index) => {
              const StepIcon = Icon as typeof Building2;
              return (
                <div key={String(title)} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800"><StepIcon className="mr-1 inline h-4 w-4 text-indigo-500" />{String(title)}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {isFrench ? 'Besoin d’aide ? Ouvrez la page Support depuis le menu principal.' : 'هل تحتاجون إلى المساعدة؟ افتحوا صفحة الدعم من القائمة الرئيسية.'}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{isFrench ? 'Informations de la direction' : 'معلومات الإدارة'}</h2>
              <p className="text-xs text-slate-500">{isFrench ? 'Les champs marqués d’un astérisque sont obligatoires.' : 'الحقول المميزة بنجمة إلزامية.'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}><User className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Prénom *' : 'الاسم الأول *'}</label><input className={inputClass} value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
            <div><label className={labelClass}>{isFrench ? 'Nom *' : 'اللقب *'}</label><input className={inputClass} value={nom} onChange={e => setNom(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}><Building2 className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Nom de la crèche *' : 'اسم الحضانة *'}</label><input className={inputClass} value={nomCreche} onChange={e => setNomCreche(e.target.value)} placeholder={isFrench ? 'Ex. : Crèche Les Marguerites' : ''} /></div>
            <div><label className={labelClass}><Wallet className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Tarif mensuel (DA) *' : 'التعريفة الشهرية *'}</label><input className={inputClass} type="number" min="0" value={tarif} onChange={e => setTarif(e.target.value)} /></div>
            <div><label className={labelClass}><Phone className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Téléphone *' : 'الهاتف *'}</label><input className={inputClass} value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="05 / 06 / 07 ..." /></div>
            <div className="sm:col-span-2"><label className={labelClass}><MapPin className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Adresse *' : 'العنوان *'}</label><input className={inputClass} value={adresse} onChange={e => setAdresse(e.target.value)} /></div>
            <div><label className={labelClass}><Mail className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Email' : 'البريد الإلكتروني'}</label><input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label className={labelClass}><Globe className="mr-1 inline h-3.5 w-3.5" />{isFrench ? 'Site web' : 'الموقع الإلكتروني'}</label><input className={inputClass} value={siteWeb} onChange={e => setSiteWeb(e.target.value)} placeholder="https://..." /></div>
          </div>

          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-900">
            {isFrench
              ? 'Ces informations sont enregistrées dans la configuration de votre crèche. Vérifiez-les avant de continuer.'
              : 'سيتم حفظ هذه المعلومات ضمن إعدادات الحضانة. يرجى التحقق منها قبل المتابعة.'}
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              <Check className="h-4 w-4" />{saving ? (isFrench ? 'Enregistrement...' : 'جاري الحفظ...') : (isFrench ? 'Enregistrer la configuration' : 'حفظ الإعدادات')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export async function hasCompletedOnboardingPage(userId: string): Promise<boolean> {
  const { getCollectionDocument } = await import('../supabase');
  const doc = await getCollectionDocument('parametres', `creche_${userId}`);
  return !!doc;
}
