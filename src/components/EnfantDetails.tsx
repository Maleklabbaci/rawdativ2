import { Enfant } from '../types';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileCheck, 
  Activity, 
  ShieldAlert, 
  School,
  Clock,
  Briefcase,
  CreditCard,
  ClipboardList,
  Plus
} from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SanteEvenementType, SanteGravite } from '../types';
import { useDb } from '../contexts/DbContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';

// ✅ Convertit un numéro algérien local (0555 12 34 56) au format international
// requis par WhatsApp (213555123456), sans + ni espaces.
const formatPhoneForWhatsapp = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('213')) return digitsOnly;
  if (digitsOnly.startsWith('0')) return '213' + digitsOnly.slice(1);
  return '213' + digitsOnly;
};

export default function EnfantDetails({ enfant, onClose }: { enfant: Enfant, onClose: () => void }) {
  const { language, t } = useLanguage();
  const isArabic = language === 'ar';
  const { user, creche } = useAuth();
  const { showToast } = useToast();
  
  const {
    presences: dbPresences,
    paiements: dbPaiements,
    santeEvenements: dbSanteEvenements,
    addSanteEvenement,
    deleteSanteEvenement,
  } = useDb();

  const childPresences = dbPresences.filter(p => p.enfantId === enfant.id);
  const childPaiements = dbPaiements.filter(p => p.enfantId === enfant.id);

  // Registre de santé : le plus récent en premier, comme un carnet de suivi.
  const childSante = dbSanteEvenements
    .filter(e => e.enfantId === enfant.id)
    .sort((a, b) => `${b.date}${b.heure || ''}`.localeCompare(`${a.date}${a.heure || ''}`));

  // --- Formulaire du registre de santé -------------------------------------
  // Un seul formulaire couvre les six natures d'écriture ; seuls les champs
  // utiles au type choisi sont affichés puis enregistrés.
  const [showSanteForm, setShowSanteForm] = useState(false);
  const [santeForm, setSanteForm] = useState({
    type: 'medicament' as SanteEvenementType,
    date: new Date().toISOString().split('T')[0],
    heure: '',
    medicament: '',
    dose: '',
    ordonnance: false,
    administrePar: '',
    description: '',
    gravite: 'legere' as SanteGravite,
    localisation: '',
    soinsDonnes: '',
    parentsAverti: false,
    praticien: '',
    professionnelType: 'medecin' as 'medecin' | 'psychologue' | 'infirmier' | 'autre',
    conclusion: '',
    prochainRappel: '',
  });

  const reinitialiserSanteForm = () => {
    setSanteForm({
      type: 'medicament',
      date: new Date().toISOString().split('T')[0],
      heure: '',
      medicament: '',
      dose: '',
      ordonnance: false,
      administrePar: '',
      description: '',
      gravite: 'legere',
      localisation: '',
      soinsDonnes: '',
      parentsAverti: false,
      praticien: '',
      professionnelType: 'medecin',
      conclusion: '',
      prochainRappel: '',
    });
  };

  const submitSanteEvenement = async () => {
    // Chaque nature d'écriture a son champ indispensable : on refuse une entrée
    // vide, car le registre doit rester exploitable lors d'un contrôle.
    const champObligatoireManquant =
      santeForm.type === 'medicament' ? !santeForm.medicament.trim()
        : santeForm.type === 'incident' || santeForm.type === 'soin' ? !santeForm.description.trim()
          : !santeForm.praticien.trim();

    if (!santeForm.date || champObligatoireManquant) {
      showToast(
        isArabic
          ? 'يرجى تعبئة الحقول الإلزامية قبل الحفظ.'
          : 'Renseignez le champ obligatoire avant d’enregistrer l’entrée.',
        'error',
      );
      return;
    }

    const base = {
      enfantId: enfant.id,
      type: santeForm.type,
      date: santeForm.date,
      heure: santeForm.heure || undefined,
      createdBy: user?.id || 'inconnu',
      createdAt: new Date().toISOString(),
    };

    const contenu = santeForm.type === 'medicament'
      ? {
          medicament: santeForm.medicament.trim(),
          dose: santeForm.dose.trim() || undefined,
          ordonnance: santeForm.ordonnance,
          administrePar: santeForm.administrePar.trim() || undefined,
        }
      : santeForm.type === 'incident' || santeForm.type === 'soin'
        ? {
            description: santeForm.description.trim(),
            gravite: santeForm.gravite,
            localisation: santeForm.localisation.trim() || undefined,
            soinsDonnes: santeForm.soinsDonnes.trim() || undefined,
            parentsAverti: santeForm.parentsAverti,
            parentsAvertiLe: santeForm.parentsAverti ? new Date().toISOString() : undefined,
          }
        : {
            praticien: santeForm.praticien.trim(),
            professionnelType: santeForm.professionnelType,
            conclusion: santeForm.conclusion.trim() || undefined,
            prochainRappel: santeForm.prochainRappel || undefined,
          };

    await addSanteEvenement({ ...base, ...contenu });
    showToast(
      isArabic ? 'تم تسجيل المعلومة في السجل الصحي.' : 'Entrée enregistrée dans le registre de santé.',
      'success',
    );
    reinitialiserSanteForm();
    setShowSanteForm(false);
  };

  const LIBELLES_SANTE: Record<SanteEvenementType, { fr: string; ar: string; classes: string }> = {
    medicament: { fr: 'Médicament', ar: 'دواء', classes: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    incident: { fr: 'Incident', ar: 'حادث', classes: 'bg-rose-50 text-rose-700 border-rose-100' },
    soin: { fr: 'Soin', ar: 'علاج', classes: 'bg-amber-50 text-amber-700 border-amber-100' },
    visite_medicale: { fr: 'Visite médecin', ar: 'زيارة طبيب', classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    visite_psychologique: { fr: 'Visite psychologue', ar: 'زيارة نفساني', classes: 'bg-violet-50 text-violet-700 border-violet-100' },
    rappel_medical: { fr: 'Rappel médical', ar: 'تذكير طبي', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  };
  
  const [activeTab, setActiveTab] = useState<'info' | 'sante' | 'presences' | 'paiements'>('info');
  const documentsRequis = {
    certificatMedical: false,
    carnetVaccination: false,
    justificatifDomicile: false,
    photoIdentite: false,
    contratAccueil: false,
    extraitNaissance: false,
    ...(enfant.documentsRequis || {}),
  };

  // Personnes habilitées à récupérer l'enfant, désignées par le tuteur légal.
  const personnesAutorisees = (enfant.personnesAutorisees || []).filter(p => p.active !== false);

  const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const enrollDate = new Date(enfant.dateInscription).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const calculerAge = (dateString: string) => {
    if (!dateString) return '';
    const birth = new Date(dateString);
    const now = new Date();
    let ans = now.getFullYear() - birth.getFullYear();
    let mois = now.getMonth() - birth.getMonth();
    
    if (mois < 0 || (mois === 0 && now.getDate() < birth.getDate())) {
      ans--;
      mois += 12;
    }
    
    if (ans <= 0) return isArabic ? `${mois} شهر` : `${mois} mois`;
    return isArabic ? `${ans} سنة و ${mois} شهر` : `${ans} an(s) et ${mois} mois`;
  };

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/70 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl cursor-default sm:mt-16 sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 text-white flex justify-between items-start gap-3 flex-shrink-0 sm:p-6 ${
          enfant.genre === 'Fille' 
            ? 'bg-gradient-to-r from-pink-500 via-pink-600 to-rose-600' 
            : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white font-black text-2xl flex items-center justify-center shadow-lg border border-white/10">
              {enfant.prenom[0]}{enfant.nom[0]}
            </div>
            <div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-widest leading-none mb-1">
                {isArabic ? 'ملف التلميذ' : 'Dossier Scolaire Individuel'}
              </p>
              <h2 className="break-words text-xl font-black tracking-tight sm:text-2xl">{enfant.prenom} {enfant.nom}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {enfant.statut === 'Inactif' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5 flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs font-bold text-amber-700">
              {isArabic
                ? `تم تسجيل خروجه بتاريخ ${enfant.dateSortie || '—'}${enfant.motifSortie ? ' — السبب: ' + enfant.motifSortie : ''}`
                : `Sorti(e) le ${enfant.dateSortie || '—'}${enfant.motifSortie ? ' — Motif : ' + enfant.motifSortie : ''}`}
            </p>
          </div>
        )}

        <div className="flex flex-shrink-0 overflow-x-auto border-b border-slate-100 bg-slate-50">
          <button
            onClick={() => setActiveTab('info')}
            className={`min-w-[13rem] flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>{isArabic ? 'الملف الطبي والشخصي' : 'Fiche Personnelle & Médicale'}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('sante')}
            className={`min-w-[13rem] flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'sante'
                ? 'border-rose-600 text-rose-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{isArabic ? 'السجل الصحي' : 'Suivi santé'}</span>
            {childSante.length > 0 && (
              <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {childSante.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('presences')}
            className={`min-w-[13rem] flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'presences'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{isArabic ? 'متابعة الحضور' : 'Présences'}</span>
            {childPresences.length > 0 && (
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {childPresences.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('paiements')}
            className={`min-w-[13rem] flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'paiements'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('children.paymentsTab')}</span>
            {childPaiements.length > 0 && (
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {childPaiements.length}
              </span>
            )}
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'info' && (
              <motion.div
                key="info-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'الفئة العمرية' : 'Section'}</span>
                    <p className="text-sm font-black text-slate-800 mt-1 flex items-center gap-1.5">
                      <School className="w-4 h-4 text-indigo-500" />
                      {enfant.section || enfant.groupeAge}
                    </p>
                  </div>

                  {/* Numéro d'ordre du registre matricule, contrôlé par la DAS. */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'رقم السجل' : 'Matricule'}</span>
                    <p className="text-sm font-black text-slate-800 mt-1 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-500" />
                      {typeof enfant.matricule === 'number'
                        ? `N° ${String(enfant.matricule).padStart(4, '0')}`
                        : <span className="text-[11px] font-semibold text-amber-600">{isArabic ? 'غير مُرقَّم' : 'Non attribué'}</span>}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'الجنس' : 'Famille'}</span>
                    <p className="text-sm font-black text-slate-800 mt-1">
                      {enfant.genre === 'Fille' ? (isArabic ? 'أنثى' : 'Fille') : (isArabic ? 'ذكر' : 'Garçon')}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'تاريخ التسجيل بالروضة' : 'Date d\'Admission'}</span>
                    <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {enrollDate}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 bg-rose-50/20 border border-rose-100/50 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-500" />
                      {isArabic ? 'الصحة والمؤشرات الفسيولوجية' : 'Santé & Allergies'}
                    </h3>

                    <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'تاريخ الولادة:' : 'Naissance:'}</span>
                        <span className="text-slate-800 font-bold">{birthDate} ({calculerAge(enfant.dateNaissance)})</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'فصيلة الدم:' : 'Groupe Sanguin:'}</span>
                        <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded text-[10px]">{enfant.groupeSanguin || 'Non renseigné'}</span>
                      </div>

                      <div>
                        <span className="block text-slate-400 mb-1.5">{isArabic ? 'تحذير الحساسية:' : 'Allergies Majeures:'}</span>
                        {enfant.allergie ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 text-rose-700 rounded-xl font-bold border border-rose-200">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            {enfant.allergie}
                          </span>
                        ) : (
                          <span className="inline-block text-slate-400 italic">Aucune allergie critique rapportée.</span>
                        )}
                      </div>

                      {enfant.regimeAlimentaire && (
                        <div className="pt-2">
                          <span className="block text-slate-400 mb-1">{isArabic ? 'حمية غذائية مخصوصة:' : 'Régime Alimentaire Spécial:'}</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200/50 text-[11px] block">{enfant.regimeAlimentaire}</span>
                        </div>
                      )}

                      {(enfant.medecinTraitant || enfant.poidsKg || enfant.vaccinations || enfant.notesMedicales) && (
                        <div className="pt-2 space-y-2">
                          {enfant.medecinTraitant && (
                            <div className="flex justify-between gap-3"><span className="text-slate-400">Médecin traitant :</span><span className="text-slate-800 font-bold text-right">{enfant.medecinTraitant}</span></div>
                          )}
                          {enfant.poidsKg && (
                            <div className="flex justify-between gap-3"><span className="text-slate-400">Poids :</span><span className="text-slate-800 font-bold">{enfant.poidsKg} kg</span></div>
                          )}
                          {enfant.vaccinations && (
                            <div><span className="block text-slate-400 mb-1">Vaccinations :</span><span className="block text-slate-800 font-bold bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100/50">{enfant.vaccinations}</span></div>
                          )}
                          {enfant.notesMedicales && (
                            <div><span className="block text-slate-400 mb-1">Notes médicales :</span><span className="block text-slate-800 font-semibold bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100/50">{enfant.notesMedicales}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-indigo-500" />
                      {isArabic ? 'الملف الطبي والتراخيص' : 'Dossier Administratif'}
                    </h3>

                    <div className="space-y-3">
                      {[
                        { label: "Certificat d'Aptitude Médicale", icon: FileCheck, status: documentsRequis.certificatMedical },
                        { label: "Carnet de Vaccination Pédiatrique", icon: FileCheck, status: documentsRequis.carnetVaccination },
                        { label: "Extrait de Naissance", icon: FileCheck, status: documentsRequis.extraitNaissance },
                        { label: "Contrat d'Accueil Signé", icon: FileCheck, status: documentsRequis.contratAccueil },
                        { label: "Justificatif d'Adresse Parentale", icon: FileCheck, status: documentsRequis.justificatifDomicile },
                        { label: "Fiches Photos d'Identité Admis", icon: FileCheck, status: documentsRequis.photoIdentite },
                      ].map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-semibold p-2.5 bg-white border border-slate-100 rounded-xl">
                          <span className="text-slate-700 truncate">{doc.label}</span>
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                            doc.status 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100/50'
                          }`}>
                            {doc.status ? 'OK' : 'Manquant'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Personnes habilitées à récupérer l'enfant : le décret impose que
                    seules les personnes désignées par écrit par le tuteur puissent
                    repartir avec l'enfant. */}
                <div className="p-5 bg-emerald-50/20 border border-emerald-100/50 rounded-2xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600" />
                      {isArabic ? 'الأشخاص المرخَّص لهم باستلام الطفل' : 'Autorisations de sortie'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border ${
                      enfant.autorisationSortieSignee
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {enfant.autorisationSortieSignee
                        ? (isArabic ? 'ترخيص موقَّع محفوظ' : 'Autorisation signée déposée')
                        : (isArabic ? 'الترخيص غير محفوظ' : 'Autorisation non déposée')}
                    </span>
                  </div>

                  {personnesAutorisees.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-emerald-200 bg-white p-3 text-[11px] font-semibold text-slate-500">
                      {isArabic
                        ? 'لا يوجد أي شخص مسجَّل: لا يمكن تسليم الطفل إلا لوالديه.'
                        : "Aucune personne déclarée : l'enfant ne pourra être remis qu'à ses parents."}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {personnesAutorisees.map((personne) => (
                        <div key={personne.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">
                              {personne.prenom ? `${personne.prenom} ` : ''}{personne.nom}
                              <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">{personne.lien}</span>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
                              {personne.telephone && (
                                <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{personne.telephone}</span>
                              )}
                              {personne.pieceIdentite && (
                                <span className="inline-flex items-center gap-1">
                                  <ClipboardList className="w-3 h-3" />
                                  {isArabic ? 'هوية:' : 'Pièce :'} {personne.pieceIdentite}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={`https://wa.me/${personne.telephone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <Phone className="w-3 h-3" />
                            {isArabic ? 'اتصال' : 'Appeler'}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-150 pt-5">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <User className="text-indigo-500 w-4.5 h-4.5" />
                    {isArabic ? 'أولياء الأمور وجهات الاتصال' : 'Contacts d\'Urgence des Parents Rattachés'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {enfant.parents.map((parent) => (
                      <div key={parent.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded">
                              {parent.lien}
                            </span>
                            <h4 className="font-extrabold text-slate-900 mt-1">{parent.prenom} {parent.nom}</h4>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs font-semibold text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <a href={`tel:${parent.telephone}`} className="flex items-center gap-2 hover:text-indigo-600 transition">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span>{parent.telephone}</span>
                            </a>
                            <a
                              href={`https://wa.me/${formatPhoneForWhatsapp(parent.telephone)}?text=${encodeURIComponent(
                                isArabic
                                  ? `مرحباً ${parent.prenom}، هذه رسالة من ${creche?.nom || 'الروضة'} بخصوص ${enfant.prenom}.`
                                  : `Bonjour ${parent.prenom}, ceci est un message de ${creche?.nom || 'la crèche'} concernant ${enfant.prenom}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg font-bold text-[11px] transition flex-shrink-0"
                              title={isArabic ? 'إرسال رسالة واتساب' : 'Envoyer un message WhatsApp'}
                            >
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                              </svg>
                              {isArabic ? 'واتساب' : 'WhatsApp'}
                            </a>
                          </div>

                          {parent.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="truncate">{parent.email}</span>
                            </div>
                          )}

                          {parent.profession && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-slate-400" />
                              <span>{parent.profession}</span>
                            </div>
                          )}

                          {parent.adresse && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="leading-tight">{parent.adresse}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'sante' && (
              <motion.div
                key="sante-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-500" />
                      {isArabic ? 'السجل الصحي اليومي والدوري' : 'Registre de suivi santé'}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {isArabic
                        ? 'الأدوية، الحوادث والعلاجات، زيارات الطبيب والنفساني.'
                        : 'Médicaments administrés, incidents et soins, visites du médecin et du psychologue.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSanteForm(v => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-rose-700"
                  >
                    {showSanteForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showSanteForm
                      ? (isArabic ? 'إلغاء' : 'Annuler')
                      : (isArabic ? 'إضافة تسجيل' : 'Nouvelle entrée')}
                  </button>
                </div>

                {showSanteForm && (
                  <div className="space-y-3.5 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {isArabic ? 'نوع التسجيل' : "Nature de l'entrée"}
                        </label>
                        <select
                          value={santeForm.type}
                          onChange={e => setSanteForm({ ...santeForm, type: e.target.value as SanteEvenementType })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                        >
                          {(Object.keys(LIBELLES_SANTE) as SanteEvenementType[]).map(cle => (
                            <option key={cle} value={cle}>
                              {isArabic ? LIBELLES_SANTE[cle].ar : LIBELLES_SANTE[cle].fr}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {isArabic ? 'التاريخ *' : 'Date *'}
                        </label>
                        <input
                          type="date"
                          value={santeForm.date}
                          onChange={e => setSanteForm({ ...santeForm, date: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {isArabic ? 'الساعة' : 'Heure'}
                        </label>
                        <input
                          type="time"
                          value={santeForm.heure}
                          onChange={e => setSanteForm({ ...santeForm, heure: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {santeForm.type === 'medicament' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isArabic ? 'الدواء *' : 'Médicament *'}
                          </label>
                          <input
                            type="text"
                            value={santeForm.medicament}
                            onChange={e => setSanteForm({ ...santeForm, medicament: e.target.value })}
                            placeholder={isArabic ? 'اسم الدواء' : 'Ex. Paracétamol'}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isArabic ? 'الجرعة' : 'Dose'}
                          </label>
                          <input
                            type="text"
                            value={santeForm.dose}
                            onChange={e => setSanteForm({ ...santeForm, dose: e.target.value })}
                            placeholder={isArabic ? 'مثال: 5 مل' : 'Ex. 5 ml'}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isArabic ? 'من طرف' : 'Administré par'}
                          </label>
                          <input
                            type="text"
                            value={santeForm.administrePar}
                            onChange={e => setSanteForm({ ...santeForm, administrePar: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                          />
                        </div>
                        <label className="flex items-end gap-2 pb-2.5">
                          <input
                            type="checkbox"
                            checked={santeForm.ordonnance}
                            onChange={e => setSanteForm({ ...santeForm, ordonnance: e.target.checked })}
                            className="h-4 w-4 accent-rose-600"
                          />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {isArabic ? 'بوصفة طبية محفوظة' : 'Ordonnance déposée au dossier'}
                          </span>
                        </label>
                      </div>
                    )}

                    {(santeForm.type === 'incident' || santeForm.type === 'soin') && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isArabic ? 'وصف الحادث أو العلاج *' : "Description de l'incident ou du soin *"}
                          </label>
                          <textarea
                            rows={2}
                            value={santeForm.description}
                            onChange={e => setSanteForm({ ...santeForm, description: e.target.value })}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'الخطورة' : 'Gravité'}
                            </label>
                            <select
                              value={santeForm.gravite}
                              onChange={e => setSanteForm({ ...santeForm, gravite: e.target.value as SanteGravite })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            >
                              <option value="legere">{isArabic ? 'بسيطة' : 'Légère'}</option>
                              <option value="moyenne">{isArabic ? 'متوسطة' : 'Moyenne'}</option>
                              <option value="grave">{isArabic ? 'خطيرة' : 'Grave'}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'المكان' : 'Lieu'}
                            </label>
                            <input
                              type="text"
                              value={santeForm.localisation}
                              onChange={e => setSanteForm({ ...santeForm, localisation: e.target.value })}
                              placeholder={isArabic ? 'الساحة، القسم…' : 'Cour, salle…'}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'الإسعافات المقدمة' : 'Soins donnés'}
                            </label>
                            <input
                              type="text"
                              value={santeForm.soinsDonnes}
                              onChange={e => setSanteForm({ ...santeForm, soinsDonnes: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={santeForm.parentsAverti}
                            onChange={e => setSanteForm({ ...santeForm, parentsAverti: e.target.checked })}
                            className="h-4 w-4 accent-rose-600"
                          />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {isArabic ? 'تم إعلام الأولياء' : 'Les parents ont été prévenus'}
                          </span>
                        </label>
                      </div>
                    )}

                    {(santeForm.type === 'visite_medicale' || santeForm.type === 'visite_psychologique' || santeForm.type === 'rappel_medical') && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'الطبيب / الأخصائي *' : 'Praticien *'}
                            </label>
                            <input
                              type="text"
                              value={santeForm.praticien}
                              onChange={e => setSanteForm({ ...santeForm, praticien: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'الصفة' : 'Professionnel'}
                            </label>
                            <select
                              value={santeForm.professionnelType}
                              onChange={e => setSanteForm({ ...santeForm, professionnelType: e.target.value as typeof santeForm.professionnelType })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            >
                              <option value="medecin">{isArabic ? 'طبيب' : 'Médecin'}</option>
                              <option value="psychologue">{isArabic ? 'أخصائي نفساني' : 'Psychologue'}</option>
                              <option value="infirmier">{isArabic ? 'ممرض' : 'Infirmier'}</option>
                              <option value="autre">{isArabic ? 'آخر' : 'Autre'}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {isArabic ? 'التذكير القادم' : 'Prochain rappel'}
                            </label>
                            <input
                              type="date"
                              value={santeForm.prochainRappel}
                              onChange={e => setSanteForm({ ...santeForm, prochainRappel: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isArabic ? 'الخلاصة' : 'Conclusion'}
                          </label>
                          <textarea
                            rows={2}
                            value={santeForm.conclusion}
                            onChange={e => setSanteForm({ ...santeForm, conclusion: e.target.value })}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submitSanteEvenement}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 sm:w-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isArabic ? 'حفظ في السجل' : 'Enregistrer au registre'}
                    </button>
                  </div>
                )}

                {childSante.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-[11px] font-semibold text-slate-400">
                    {isArabic
                      ? 'لا توجد أي تسجيلات صحية لهذا الطفل حتى الآن.'
                      : "Aucune écriture au registre de santé pour cet enfant."}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {childSante.map(evenement => {
                      const libelle = LIBELLES_SANTE[evenement.type] || LIBELLES_SANTE.soin;
                      const details = [
                        evenement.medicament && `${evenement.medicament}${evenement.dose ? ` — ${evenement.dose}` : ''}`,
                        evenement.administrePar && (isArabic ? `من طرف ${evenement.administrePar}` : `administré par ${evenement.administrePar}`),
                        evenement.description,
                        evenement.localisation,
                        evenement.soinsDonnes,
                        evenement.praticien && `${evenement.praticien}${evenement.professionnelType ? ` (${evenement.professionnelType})` : ''}`,
                        evenement.conclusion,
                      ].filter(Boolean);

                      return (
                        <div key={evenement.id} className="rounded-2xl border border-slate-100 bg-white p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${libelle.classes}`}>
                                {isArabic ? libelle.ar : libelle.fr}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                {new Date(evenement.date).toLocaleDateString(isArabic ? 'ar' : 'fr-FR')}
                                {evenement.heure ? ` · ${evenement.heure}` : ''}
                              </span>
                              {evenement.gravite === 'grave' && (
                                <span className="rounded-lg bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                  {isArabic ? 'خطير' : 'Grave'}
                                </span>
                              )}
                              {evenement.parentsAverti && (
                                <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                                  {isArabic ? 'الأولياء مُعلَمون' : 'Parents prévenus'}
                                </span>
                              )}
                              {evenement.prochainRappel && (
                                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                                  {isArabic ? 'تذكير' : 'Rappel'} {new Date(evenement.prochainRappel).toLocaleDateString(isArabic ? 'ar' : 'fr-FR')}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteSanteEvenement(evenement.id)}
                              title={isArabic ? 'حذف هذا التسجيل' : 'Supprimer cette entrée'}
                              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {details.length > 0 && (
                            <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">
                              {details.join(' · ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'presences' && (
              <motion.div
                key="presences-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-emerald-700 uppercase">{isArabic ? 'نسبة الحضور المتراكمة' : 'Taux d’Assiduité'}</p>
                    <p className="text-2xl font-black text-emerald-800 mt-1">
                      {childPresences.length > 0 
                        ? `${Math.round((childPresences.filter(p => p.statut === 'Présent').length / childPresences.length) * 100)}%`
                        : '100%'
                      }
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-indigo-700 uppercase">{isArabic ? 'إجمالي الأيام المسجلة' : 'Total Jours Suivis'}</p>
                    <p className="text-2xl font-black text-indigo-800 mt-1">{childPresences.length}</p>
                  </div>
                  <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-rose-700 uppercase">{isArabic ? 'الغيابات غير المبررة' : 'Absences non justifiées'}</p>
                    <p className="text-2xl font-black text-rose-800 mt-1">
                      {childPresences.filter(p => p.statut === 'Absent non justifié').length}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    {isArabic ? 'سجل الحضور والغياب المفصل' : 'Index Chronologique des Présences'}
                  </h4>

                  {childPresences.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد سجلات حضور مسجلة حالياً لهدا الطفل' : 'Aucun rapport d’assiduité n’a été enregistré pour cet élève dans la base de données.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                      {[...childPresences]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-450" />
                              {new Date(p.date).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                              p.statut === 'Présent' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : p.statut === 'Absent justifié'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {p.statut === 'Présent' ? (isArabic ? 'حاضر' : 'Présent') : (isArabic ? 'غائب مبرر' : 'Excuzé')}
                            </span>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'paiements' && (
              <motion.div
                key="paiements-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-emerald-600">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-700 uppercase">{isArabic ? 'إجمالي المبالغ المدفوعة' : 'Total Frais Réglés'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">
                        {formatCurrency(childPaiements.filter(p => p.statut === 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-amber-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase">{isArabic ? 'المستحقات غير المدفوعة' : 'Facturation en suspens'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">
                        {formatCurrency(childPaiements.filter(p => p.statut !== 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    {isArabic ? 'سجل الفواتير والمدفوعات الشهري' : 'Historique Mensuel des Règlement Scolaires'}
                  </h4>

                  {childPaiements.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد فواتير أو سجلات دفع لهذا الطفل' : 'Aucune écriture comptable d’abonnement scolaire n’a été enregistrée pour cet élève.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                      {[...childPaiements]
                        .sort((a, b) => b.moisConcerne.localeCompare(a.moisConcerne))
                        .map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-slate-800">
                                {isArabic ? 'اشتراك شهر:' : 'Abonnement Mensuel de'} {p.moisConcerne}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold">
                                {isArabic ? 'رمز الدفع:' : 'ID Facture:'} {p.id.slice(0, 8)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-black text-slate-900">{formatCurrency(p.montant)}</span>
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                                p.statut === 'Payé'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : p.statut === 'En attente'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {p.statut === 'Payé' ? (isArabic ? 'مدفوع' : 'Payé') : p.statut === 'En attente' ? (isArabic ? 'قيد الانتظار' : 'Attente') : (isArabic ? 'متأخر' : 'Retard')}
                              </span>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
          <button 
            type="button"
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-xl transition cursor-pointer text-xs"
            onClick={onClose}
          >
            {isArabic ? 'إغلاق ملف التلميذ' : "Fermer le dossier de l'élève"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
