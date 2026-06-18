import { useState } from 'react';
import { 
  Baby, 
  Search, 
  Plus, 
  Filter, 
  X, 
  User, 
  Heart, 
  FileText, 
  ShieldAlert, 
  Phone, 
  Mail, 
  Calendar,
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  HeartCrack,
  Activity,
  Pencil,
  Trash2
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { Enfant } from '../types';
import EnfantDetails from './EnfantDetails';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Enfants() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { enfants, addEnfant, deleteEnfant, updateEnfant } = useDb();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroupe, setFilterGroupe] = useState('Tous');
  const [showModal, setShowModal] = useState(false);
  const [selectedEnfant, setSelectedEnfant] = useState<Enfant | null>(null);
  const [editingEnfantId, setEditingEnfantId] = useState<string | null>(null);

  // Exquisite expanded form state satisfying "PLEINE DE FORMATION"
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    genre: 'Garçon' as 'Garçon' | 'Fille',
    groupeAge: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    allergie: '',
    regimeAlimentaire: '',
    bloodGroup: 'O+',
    weightKg: '12',
    pediatricianName: 'Dr. Belkacem',
    parentNom: '',
    parentPrenom: '',
    parentTelephone: '',
    parentEmail: '',
    parentAdresse: '',
    parentProfession: '',
    parentLien: 'Mère' as 'Mère' | 'Père' | 'Tuteur',
    docCertif: true,
    docVaccin: true,
    docDomicile: false,
    docPhoto: false,
  });

  const filteredEnfants = enfants.filter(enfant => {
    const term = searchTerm.toLowerCase();
    const nameMatch = `${enfant.prenom} ${enfant.nom}`.toLowerCase().includes(term);
    const parentMatch = enfant.parents.some(p => `${p.prenom} ${p.nom}`.toLowerCase().includes(term));
    const matchesSearch = nameMatch || parentMatch;
    
    // Multi level language check for filters
    let matchesGroupe = true;
    if (filterGroupe !== 'Tous' && filterGroupe !== 'الكل') {
      // normalize categories
      const normalizedFilter = filterGroupe.includes('Bébés') || filterGroupe.includes('رضع') ? 'Bébés' :
                               filterGroupe.includes('Moyens') || filterGroupe.includes('متوسطين') ? 'Moyens' : 'Grands';
      matchesGroupe = enfant.groupeAge === normalizedFilter;
    }
    
    return matchesSearch && matchesGroupe && enfant.statut === 'Actif';
  });

  const handleAjouter = () => {
    if (!formData.nom || !formData.prenom || !formData.dateNaissance || 
        !formData.parentNom || !formData.parentTelephone) {
      alert(isArabic ? 'يرجى ملء جميع الحقول المطلوبة *' : 'Veuillez remplir tous les champs obligatoires *');
      return;
    }

    if (editingEnfantId) {
      const existing = enfants.find(item => item.id === editingEnfantId);
      const updatedEnfant: Partial<Enfant> = {
        nom: formData.nom,
        prenom: formData.prenom,
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        groupeAge: formData.groupeAge,
        allergie: formData.allergie || undefined,
        regimeAlimentaire: formData.regimeAlimentaire || undefined,
        contactsUrgence: [
          {
            id: existing?.contactsUrgence[0]?.id || `${Date.now()}-contact`,
            nom: `${formData.parentPrenom} ${formData.parentNom}`,
            telephone: formData.parentTelephone,
            lien: formData.parentLien
          }
        ],
        parents: [
          {
            id: existing?.parents[0]?.id || `${Date.now()}-parent`,
            nom: formData.parentNom,
            prenom: formData.parentPrenom,
            lien: formData.parentLien,
            telephone: formData.parentTelephone,
            email: formData.parentEmail || undefined,
            adresse: formData.parentAdresse || undefined,
            profession: formData.parentProfession || undefined
          }
        ],
        documentsRequis: {
          certificatMedical: formData.docCertif,
          carnetVaccination: formData.docVaccin,
          justificatifDomicile: formData.docDomicile,
          photoIdentite: formData.docPhoto
        }
      };
      updateEnfant(editingEnfantId, updatedEnfant);
      setEditingEnfantId(null);
    } else {
      const nouvelEnfant: Enfant = {
        id: `${Date.now()}`,
        nom: formData.nom,
        prenom: formData.prenom,
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        groupeAge: formData.groupeAge,
        dateInscription: new Date().toISOString().split('T')[0],
        statut: 'Actif',
        allergie: formData.allergie || undefined,
        regimeAlimentaire: formData.regimeAlimentaire || undefined,
        contactsUrgence: [
          {
            id: `${Date.now()}-contact`,
            nom: `${formData.parentPrenom} ${formData.parentNom}`,
            telephone: formData.parentTelephone,
            lien: formData.parentLien
          }
        ],
        parents: [
          {
            id: `${Date.now()}-parent`,
            nom: formData.parentNom,
            prenom: formData.parentPrenom,
            lien: formData.parentLien,
            telephone: formData.parentTelephone,
            email: formData.parentEmail || undefined,
            adresse: formData.parentAdresse || undefined,
            profession: formData.parentProfession || undefined
          }
        ],
        documentsRequis: {
          certificatMedical: formData.docCertif,
          carnetVaccination: formData.docVaccin,
          justificatifDomicile: formData.docDomicile,
          photoIdentite: formData.docPhoto
        }
      };
      addEnfant(nouvelEnfant);
    }

    setShowModal(false);
    // Reset Form fully
    setFormData({
      nom: '',
      prenom: '',
      dateNaissance: '',
      genre: 'Garçon',
      groupeAge: 'Bébés',
      allergie: '',
      regimeAlimentaire: '',
      bloodGroup: 'O+',
      weightKg: '12',
      pediatricianName: 'Dr. Belkacem',
      parentNom: '',
      parentPrenom: '',
      parentTelephone: '',
      parentEmail: '',
      parentAdresse: '',
      parentProfession: '',
      parentLien: 'Mère',
      docCertif: true,
      docVaccin: true,
      docDomicile: false,
      docPhoto: false,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-8 font-sans">
      {/* Search Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Baby className="w-6 h-6 sm:w-8 sm:h-8 text-rose-500 animate-pulse" />
            {t('children.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-bold">
            {filteredEnfants.length} {t('children.enrolled')}
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingEnfantId(null);
            setFormData({
              nom: '',
              prenom: '',
              dateNaissance: '',
              genre: 'Garçon',
              groupeAge: 'Bébés',
              allergie: '',
              regimeAlimentaire: '',
              bloodGroup: 'O+',
              weightKg: '12',
              pediatricianName: 'Dr. Belkacem',
              parentNom: '',
              parentPrenom: '',
              parentTelephone: '',
              parentEmail: '',
              parentAdresse: '',
              parentProfession: '',
              parentLien: 'Mère',
              docCertif: true,
              docVaccin: true,
              docDomicile: false,
              docPhoto: false,
            });
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer border border-transparent w-full sm:w-auto"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('children.add')}</span>
        </button>
      </div>

      {/* Exquisite Filters Ribbon */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('children.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap shrink-0">
          {[
            { key: 'Tous', label: t('children.all') },
            { key: 'Bébés', label: t('children.babies') },
            { key: 'Moyens', label: t('children.middle') },
            { key: 'Grands', label: t('children.seniors') }
          ].map(grp => (
            <button
              key={grp.key}
              onClick={() => setFilterGroupe(grp.key)}
              className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
                filterGroupe === grp.key
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Children grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
        {filteredEnfants.length > 0 ? (
          filteredEnfants.map((enfant) => {
            const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR');
            
            // Medical folder counts
            const docsCount = Object.values(enfant.documentsRequis).filter(Boolean).length;
            
            return (
              <div 
                key={enfant.id} 
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top card stats */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl font-black text-white flex items-center justify-center shadow-md ${
                        enfant.genre === 'Fille' 
                          ? 'bg-gradient-to-tr from-pink-500 to-rose-400' 
                          : 'bg-gradient-to-tr from-sky-500 to-indigo-400'
                      }`}>
                        {enfant.prenom[0]}{enfant.nom[0]}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug">{enfant.prenom} {enfant.nom}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                          Ref: RAW-{enfant.id.slice(-4)}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border tracking-wider ${
                      enfant.groupeAge === 'Bébés' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      enfant.groupeAge === 'Moyens' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {enfant.groupeAge}
                    </span>
                  </div>

                  {/* Core Date & Allergies block */}
                  <div className="space-y-2 mt-4 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2 p-1 border-b border-dashed border-slate-50">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('children.born')}: <strong className="text-slate-800">{birthDate}</strong></span>
                    </div>

                    {/* Allergies tag block */}
                    {enfant.allergie ? (
                      <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-2.5 py-1.5 border border-rose-100 rounded-xl">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span className="font-extrabold text-[11px] truncate">
                          {t('children.allergy')}: <strong className="font-black text-rose-800">{enfant.allergie}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 italic px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                        <span>Aucune allergie signalée</span>
                      </div>
                    )}
                  </div>

                  {/* Documents & dossier checker indicators */}
                  <div className="mt-5 bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {isArabic ? 'الـملف الإداري والتراخيص' : 'Diligence Dossier Administratif'}
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
                      <div className="space-y-1">
                        <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                          enfant.documentsRequis.certificatMedical ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {enfant.documentsRequis.certificatMedical ? '✓' : '✗'}
                        </div>
                        <span className="block text-[9px] truncate">Médic</span>
                      </div>

                      <div className="space-y-1">
                        <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                          enfant.documentsRequis.carnetVaccination ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {enfant.documentsRequis.carnetVaccination ? '✓' : '✗'}
                        </div>
                        <span className="block text-[9px] truncate">Vaccin</span>
                      </div>

                      <div className="space-y-1">
                        <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                          enfant.documentsRequis.justificatifDomicile ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {enfant.documentsRequis.justificatifDomicile ? '✓' : '✗'}
                        </div>
                        <span className="block text-[9px] truncate">Domi</span>
                      </div>

                      <div className="space-y-1">
                        <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                          enfant.documentsRequis.photoIdentite ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                        }`}>
                          {enfant.documentsRequis.photoIdentite ? '✓' : '✗'}
                        </div>
                        <span className="block text-[9px] truncate pointer-events-none">Photo</span>
                      </div>
                    </div>
                  </div>

                  {/* Family Connections */}
                  <div className="mt-5 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">{t('children.parents')}:</p>
                    {enfant.parents.map((parent) => (
                      <div key={parent.id} className="text-xs text-slate-600 flex items-center gap-1.5 mb-1.5 last:mb-0">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-extrabold text-slate-800">{parent.prenom} {parent.nom}</span>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                          {parent.lien}
                        </span>
                        <a href={`tel:${parent.telephone}`} className="text-slate-400 hover:text-indigo-600 ml-auto transition">
                          <Phone className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Open details actions */}
                <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2">
                  <button 
                    onClick={() => setSelectedEnfant(enfant)}
                    className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition cursor-pointer"
                  >
                    {isArabic ? 'عرض الملف' : 'Dossier'}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingEnfantId(enfant.id);
                      setFormData({
                        nom: enfant.nom,
                        prenom: enfant.prenom,
                        dateNaissance: enfant.dateNaissance,
                        genre: enfant.genre,
                        groupeAge: enfant.groupeAge,
                        bloodGroup: 'O+',
                        weightKg: '12',
                        pediatricianName: 'Dr. Belkacem',
                        parentNom: enfant.parents[0]?.nom || '',
                        parentPrenom: enfant.parents[0]?.prenom || '',
                        parentLien: enfant.parents[0]?.lien || 'Mère',
                        parentTelephone: enfant.parents[0]?.telephone || '',
                        parentEmail: enfant.parents[0]?.email || '',
                        parentProfession: enfant.parents[0]?.profession || '',
                        parentAdresse: enfant.parents[0]?.adresse || '',
                        docCertif: enfant.documentsRequis.certificatMedical,
                        docVaccin: enfant.documentsRequis.carnetVaccination,
                        docDomicile: enfant.documentsRequis.justificatifDomicile,
                        docPhoto: enfant.documentsRequis.photoIdentite,
                      });
                      setShowModal(true);
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition cursor-pointer"
                    title={isArabic ? 'تعديل' : 'Modifier'}
                  >
                    <Pencil size={15} />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(isArabic ? 'هل أنت متأكد من حذف هذا الطفل وجميع سجلات الحضور والدفع الخاصة به؟' : 'Êtes-vous sûr de vouloir supprimer cet enfant et l’ensemble de ses rapports d’absences et de factures ?')) {
                        deleteEnfant(enfant.id);
                      }
                    }}
                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition cursor-pointer"
                    title={isArabic ? 'حذف' : 'Supprimer'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد تطابقات للبحث' : 'Aucun dossier actif'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'تأكد من الحروف أو أضف طفلاً جديداً.' : 'Changez vos termes de recherche ou créez un premier enfant.'}</p>
          </div>
        )}
      </div>

      {/* Highly detail rich registration child modal ("PLEINE DE FORMATION" as user requested) */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-3xl max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">
                    {editingEnfantId 
                      ? (isArabic ? 'تعديل ملف التلميذ' : 'Modifier le Dossier de l\'Élève') 
                      : (isArabic ? 'تسجيل طفل جديد وتكوين الملف' : 'Dossier d\'Admission Enfant')}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    {editingEnfantId 
                      ? (isArabic ? 'تحديث المعلومات الطبية، العائلية وتراخيص الملف الإداري' : 'Mise à jour des indicateurs et contacts du tuteur légal') 
                      : (isArabic ? 'يرجى تعبئة جميع المعلومات الطبية والعائلية والمستندات الإدارية الملحقة بدقة' : 'Saisie exhaustive d\'indicateurs physiologiques, pédiatriques et tuteur légal')}
                  </p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                
                {/* 1. SECTION: Child primary information */}
                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <Baby className="w-4 h-4" />
                    {isArabic ? 'أولاً: هوية الطفل ومواصفاته الصحية' : '1. Identité et Paramètres Physiologiques du Nourrisson'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Prénom *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Amine"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.prenom}
                        onChange={e => setFormData({...formData, prenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Nom *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Belali"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.nom}
                        onChange={e => setFormData({...formData, nom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Date de Naissance *</label>
                      <input 
                        type="date"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                        value={formData.dateNaissance}
                        onChange={e => setFormData({...formData, dateNaissance: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Genre *</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.genre}
                        onChange={e => setFormData({...formData, genre: e.target.value as any})}
                      >
                        <option value="Garçon">Garçon</option>
                        <option value="Fille">Fille</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Groupe Scolaire *</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.groupeAge}
                        onChange={e => setFormData({...formData, groupeAge: e.target.value as any})}
                      >
                        <option value="Bébés">Bébés (0-2 ans)</option>
                        <option value="Moyens">Moyens (2-4 ans)</option>
                        <option value="Grands">Grands (4-6 ans)</option>
                      </select>
                    </div>

                    {/* Blood group */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Groupe Sanguin *</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                        value={formData.bloodGroup}
                        onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
                      >
                        <option value="O+">O+</option>
                        <option value="A+">A+</option>
                        <option value="B+">B+</option>
                        <option value="AB+">AB+</option>
                        <option value="O-">O-</option>
                        <option value="A-">A-</option>
                      </select>
                    </div>
                  </div>

                  {/* Medical specifics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Allergie ou intolérance (⚠️)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Lactose, Arachides, Pénicilline (Vide si néant)"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.allergie}
                        onChange={e => setFormData({...formData, allergie: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Régime Alimentaire Spécial</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Sans gluten, Halal, Végétarien..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.regimeAlimentaire}
                        onChange={e => setFormData({...formData, regimeAlimentaire: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                {/* 2. SECTION: Family / Tuteur legal */}
                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5 pt-2">
                    <User className="w-4 h-4" />
                    {isArabic ? 'ثانياً: معلومات الاتصال وولي الأمر' : '2. Coordonnées et Profil du Représentant Légal / Parent'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Lien tuteur *</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.parentLien}
                        onChange={e => setFormData({...formData, parentLien: e.target.value as any})}
                      >
                        <option value="Mère">Mère</option>
                        <option value="Père">Père</option>
                        <option value="Tuteur">Tuteur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Prénom Parent *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Karima"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentPrenom}
                        onChange={e => setFormData({...formData, parentPrenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Nom Parent *</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Belali"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentNom}
                        onChange={e => setFormData({...formData, parentNom: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Téléphone principal *</label>
                      <input 
                        type="tel" 
                        placeholder="0555 12 89 90"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                        value={formData.parentTelephone}
                        onChange={e => setFormData({...formData, parentTelephone: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Adresse Email</label>
                      <input 
                        type="email" 
                        placeholder="karima.b@exemple.dz"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentEmail}
                        onChange={e => setFormData({...formData, parentEmail: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Profession</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Architecte, Journaliste"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentProfession}
                        onChange={e => setFormData({...formData, parentProfession: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Adresse de Résidence</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 12 Rue Didouche Mourad, Alger"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.parentAdresse}
                      onChange={e => setFormData({...formData, parentAdresse: e.target.value})} 
                    />
                  </div>
                </div>

                {/* 3. SECTION: Administrative check-in */}
                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5 pt-2">
                    <FileText className="w-4 h-4" />
                    {isArabic ? 'ثالثاً: الملف الإداري والتصاريح' : '3. Liste des documents remis à l\'admission'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docCertif}
                        onChange={e => setFormData({...formData, docCertif: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">Certificat médical requis remis</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docVaccin}
                        onChange={e => setFormData({...formData, docVaccin: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">Carnet de vaccination à jour</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer mt-2 sm:mt-0">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docDomicile}
                        onChange={e => setFormData({...formData, docDomicile: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">Justificatif de domicile fourni</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer mt-2 sm:mt-0">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docPhoto}
                        onChange={e => setFormData({...formData, docPhoto: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">Photo d'identité fournie</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Save actions */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Détails */}
      {selectedEnfant && (
        <EnfantDetails
          enfant={selectedEnfant}
          onClose={() => setSelectedEnfant(null)}
        />
      )}
    </div>
  );
}
