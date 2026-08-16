import { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, User, Phone, MapPin, Mail, Globe, DollarSign, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { setCollectionDocument, getCollectionDocument } from '../supabase';
import { useLanguage } from '../contexts/LanguageContext';

// ✅ S'affiche UNE SEULE FOIS, juste après le tout premier login d'un directeur
// (détecté par l'absence du document "parametres/creche_{id}"). Une fois rempli,
// ce document existe -> le modal ne réapparaît plus jamais aux logins suivants.
// Les mêmes infos restent modifiables ensuite depuis la page Paramètres normale.
export default function OnboardingCrecheModal({ onDone }: { onDone: () => void }) {
  const { user, refreshCreche } = useAuth();
  const { updateCompte } = useDb();
  const { isFrench } = useLanguage();

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
      // Sauvegarde dans "parametres" -> même document que la page Paramètres,
      // donc tout ce qui est rempli ici sera déjà visible/modifiable là-bas ensuite.
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
      // Sauvegarde nom/prénom/nomCreche sur le compte lui-même (utilisé un peu partout dans l'appli)
      await updateCompte(user.id, { nom, prenom, nomCreche });
      await refreshCreche();
      onDone();
    } catch (err) {
      setError(isFrench ? "Erreur lors de l'enregistrement, réessaie." : 'خطأ أثناء الحفظ، حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
  const labelClass = "text-xs font-semibold text-slate-600 mb-1 block";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-900/60 p-2 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isFrench ? 'Bienvenue sur RAWDHA+' : 'مرحبًا بك في RAWDHA+'}
              </h2>
              <p className="text-sm text-slate-500">
                {isFrench ? 'Quelques infos pour configurer ta crèche' : 'بعض المعلومات لإعداد حضانتك'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}><User className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Prénom *' : 'الاسم الأول *'}</label>
              <input className={inputClass} value={prenom} onChange={e => setPrenom(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{isFrench ? 'Nom *' : 'اللقب *'}</label>
              <input className={inputClass} value={nom} onChange={e => setNom(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}><Building2 className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Nom de la crèche *' : 'اسم الحضانة *'}</label>
            <input className={inputClass} value={nomCreche} onChange={e => setNomCreche(e.target.value)} placeholder={isFrench ? 'Ex: Crèche Les Marguerites' : ''} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}><DollarSign className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Tarif mensuel (DA) *' : 'الرسوم الشهرية *'}</label>
              <input className={inputClass} type="number" value={tarif} onChange={e => setTarif(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}><Phone className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Téléphone *' : 'الهاتف *'}</label>
              <input className={inputClass} value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+213 ..." />
            </div>
          </div>

          <div>
            <label className={labelClass}><MapPin className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Adresse *' : 'العنوان *'}</label>
            <input className={inputClass} value={adresse} onChange={e => setAdresse(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Email (si dispo)' : 'البريد الإلكتروني'}</label>
              <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}><Globe className="w-3.5 h-3.5 inline mr-1" />{isFrench ? 'Site web (si dispo)' : 'الموقع الإلكتروني'}</label>
              <input className={inputClass} value={siteWeb} onChange={e => setSiteWeb(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="p-4 sm:p-6 sm:pt-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            {saving ? (isFrench ? 'Enregistrement...' : 'جاري الحفظ...') : (isFrench ? 'Commencer' : 'ابدأ')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Petit utilitaire exporté pour App.tsx : vérifie si le directeur a déjà complété l'onboarding
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const doc = await getCollectionDocument('parametres', `creche_${userId}`);
  return !!doc;
}
