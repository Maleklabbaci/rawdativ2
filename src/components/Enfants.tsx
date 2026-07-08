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
  Trash2,
  List,
  LayoutGrid,
  LogOut,
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Enfant } from '../types';
import EnfantDetails from './EnfantDetails';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Enfants() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { enfants: allEnfants, addEnfant, deleteEnfant, updateEnfant } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const enfants = isDirecteur ? allEnfants.filter(e => e.crecheId === user!.id) : allEnfants;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroupe, setFilterGroupe] = useState('Tous');
  const [showModal, setShowModal] = useState(false);
  const [showInactifs, setShowInactifs] = useState(false); // ✅ affiche aussi les enfants sortis
  const [sortieModalEnfant, setSortieModalEnfant] = useState<any | null>(null); // ✅ enfant en cours de "marquer comme sorti"
  const [sortieDate, setSortieDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortieMotif, setSortieMotif] = useState('Fin d\'année scolaire');
  const [selectedEnfant, setSelectedEnfant] = useState<Enfant | null>(null);
  const [editingEnfantId, setEditingEnfantId] = useState<string | null>(null);
  
  // خاصية جديدة: تغيير طريقة العرض بين شبكة (Grid) وقائمة (List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

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
    jourEcheanceMensuel: '5', // ✅ jour du mois (1-31) pour la facture auto + notification de paiement
  });

  const filteredEnfants = enfants.filter(enfant => {
    const term = searchTerm.toLowerCase();
    const nameMatch = `${enfant.prenom} ${enfant.nom}`.toLowerCase().includes(term);
    const parentMatch = enfant.parents.some(p => `${p.prenom} ${p.nom}`.toLowerCase().includes(term));
    const matchesSearch = nameMatch || parentMatch;
    
    let matchesGroupe = true;
    if (filterGroupe !== 'Tous' && filterGroupe !== 'الكل') {
      const normalizedFilter = filterGroupe.includes('Bébés') || filterGroupe.includes('رضع') ? 'Bébés' :
                               filterGroupe.includes('Moyens') || filterGroupe.includes('متوسطين') ? 'Moyens' : 'Grands';
      matchesGroupe = enfant.groupeAge === normalizedFilter;
    }
    
    const matchesStatut = showInactifs ? true : enfant.statut === 'Actif';
    return matchesSearch && matchesGroupe && matchesStatut;
  });

  // ✅ Marque un enfant comme "sorti" : statut Inactif + date + motif de sortie
  const handleConfirmerSortie = () => {
    if (!sortieModalEnfant) return;
    updateEnfant(sortieModalEnfant.id, {
      statut: 'Inactif',
      dateSortie: sortieDate,
      motifSortie: sortieMotif,
    });
    setSortieModalEnfant(null);
    setSortieDate(new Date().toISOString().split('T')[0]);
    setSortieMotif('Fin d\'année scolaire');
  };

  // ✅ Réintègre un enfant marqué comme sorti par erreur
  const handleReintegrer = (enfant: any) => {
    updateEnfant(enfant.id, {
      statut: 'Actif',
      dateSortie: undefined,
      motifSortie: undefined,
    });
  };

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
        },
        jourEcheanceMensuel: formData.jourEcheanceMensuel ? Number(formData.jourEcheanceMensuel) : undefined
      };
      updateEnfant(editingEnfantId, updatedEnfant);
      setEditingEnfantId(null);
    } else {
      const nouvelEnfant: Enfant = {
        id: `${Date.now()}`,
        crecheId: isDirecteur ? user!.id : undefined,
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
        },
        jourEcheanceMensuel: formData.jourEcheanceMensuel ? Number(formData.jourEcheanceMensuel) : undefined
      };
      addEnfant(nouvelEnfant);
    }

    setShowModal(false);
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
      jourEcheanceMensuel: '5',
    });
  };

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
    <div className="space-y-4 sm:space-y-8 font-sans">
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
              jourEcheanceMensuel: '5',
            });
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer border border-transparent w-full sm:w-auto"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('children.add')}</span>
        </button>
      </div>

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

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap shrink-0">
          {/* Toggle View Mode Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2 rtl:ml-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
              title={isArabic ? 'عرض كقائمة' : 'Vue en liste'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
              title={isArabic ? 'عرض كبطاقات' : 'Vue en grille'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

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

          {/* ✅ Toggle : afficher aussi les enfants sortis */}
          <button
            onClick={() => setShowInactifs(prev => !prev)}
            className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showInactifs
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            {isArabic ? 'الأطفال المغادرون' : 'Enfants sortis'}
          </button>
        </div>
      </div>

      {filteredEnfants.length > 0 ? (
        viewMode === 'list' ? (
          /* ================= LIST VIEW ================= */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="p-4">{isArabic ? 'الطفل' : 'Enfant'}</th>
                    <th className="p-4">{isArabic ? 'العمر' : 'Âge'}</th>
                    <th className="p-4">{isArabic ? 'القسم' : 'Classe'}</th>
                    <th className="p-4">{isArabic ? 'ولي الأمر' : 'Parents'}</th>
                    <th className="p-4 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {filteredEnfants.map((enfant) => (
                    <tr key={enfant.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl font-black text-white flex items-center justify-center shadow-xs ${
                            enfant.genre === 'Fille' ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : 'bg-gradient-to-tr from-sky-500 to-indigo-400'
                          }`}>
                            {enfant.prenom[0]}{enfant.nom[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 font-extrabold">{enfant.prenom} {enfant.nom}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">RAW-{enfant.id.slice(-4)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-800 font-bold">{calculerAge(enfant.dateNaissance)}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR')}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border tracking-wider ${
                          enfant.groupeAge === 'Bébés' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          enfant.groupeAge === 'Moyens' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {enfant.groupeAge}
                        </span>
                      </td>
                      <td className="p-4">
                        {enfant.parents.slice(0, 1).map((parent) => (
                          <div key={parent.id}>
                            <p className="text-xs font-extrabold text-slate-800">{parent.prenom} {parent.nom} <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded">{parent.lien}</span></p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{parent.telephone}</p>
                          </div>
                        ))}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setSelectedEnfant(enfant)}
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                            title={isArabic ? 'عرض الملف' : 'Dossier'}
                          >
                            <FileText size={16} />
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
                                jourEcheanceMensuel: String(enfant.jourEcheanceMensuel || 5),
                                docPhoto: enfant.documentsRequis.photoIdentite,
                                allergie: enfant.allergie || '',
                                regimeAlimentaire: enfant.regimeAlimentaire || ''
                              });
                              setShowModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => enfant.statut === 'Actif'
                              ? setSortieModalEnfant(enfant)
                              : handleReintegrer(enfant)}
                            className={`p-1.5 rounded-lg transition ${
                              enfant.statut === 'Actif'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={enfant.statut === 'Actif'
                              ? (isArabic ? 'تسجيل خروج' : 'Marquer comme sorti')
                              : (isArabic ? 'إعادة التسجيل' : 'Réintégrer')}
                          >
                            {enfant.statut === 'Actif' ? <LogOut size={16} /> : <RotateCcw size={16} />}
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm(isArabic ? 'هل أنت متأكد من حذف هذا الطفل؟' : 'Êtes-vous sûr de vouloir supprimer cet enfant ?')) {
                                deleteEnfant(enfant.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ================= GRID VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {filteredEnfants.map((enfant) => {
              const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR');
              
              return (
                <div 
                  key={enfant.id} 
                  className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl font-black text-white flex items-center justify-center shadow-md ${
                          enfant.genre === 'Fille' ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : 'bg-gradient-to-tr from-sky-500 to-indigo-400'
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

                    <div className="space-y-2 mt-4 text-xs font-semibold text-slate-500">
                      <div className="flex items-center gap-2 p-1 border-b border-dashed border-slate-50">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t('children.born')}: <strong className="text-slate-800">{birthDate} ({calculerAge(enfant.dateNaissance)})</strong></span>
                      </div>

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
                          jourEcheanceMensuel: String(enfant.jourEcheanceMensuel || 5),
                          docPhoto: enfant.documentsRequis.photoIdentite,
                          allergie: enfant.allergie || '',
                          regimeAlimentaire: enfant.regimeAlimentaire || ''
                        });
                        setShowModal(true);
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition cursor-pointer"
                      title={isArabic ? 'تعديل' : 'Modifier'}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => enfant.statut === 'Actif'
                        ? setSortieModalEnfant(enfant)
                        : handleReintegrer(enfant)}
                      className={`p-3 rounded-xl font-bold text-xs transition cursor-pointer ${
                        enfant.statut === 'Actif'
                          ? 'bg-slate-50 hover:bg-amber-100 text-slate-600 hover:text-amber-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                      }`}
                      title={enfant.statut === 'Actif'
                        ? (isArabic ? 'تسجيل خروج' : 'Marquer comme sorti')
                        : (isArabic ? 'إعادة التسجيل' : 'Réintégrer')}
                    >
                      {enfant.statut === 'Actif' ? <LogOut size={15} /> : <RotateCcw size={15} />}
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
            })}
          </div>
        )
      ) : (
        <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
          <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
          <p className="font-extrabold">{isArabic ? 'لا توجد تطابقات للبحث' : 'Aucun dossier actif'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'تأكد من الحروف أو أضف طفلاً جديداً.' : 'Changez vos termes de recherche ou créez un premier enfant.'}</p>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 pt-24 font-sans overflow-y-auto"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden font-sans cursor-default mb-10"
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
                
                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <Baby className="w-4 h-4" />
                    {isArabic ? 'أولاً: هوية الطفل ومواصفاته الصحية' : '1. Identité et Paramètres Physiologiques du Nourrisson'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الاسم الأول *' : 'Prénom *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: أمين' : 'Ex: Amine'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.prenom}
                        onChange={e => setFormData({...formData, prenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'اللقب *' : 'Nom *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: بلالي' : 'Ex: Belali'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.nom}
                        onChange={e => setFormData({...formData, nom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'تاريخ الميلاد *' : 'Date de Naissance *'}
                      </label>
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
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الجنس *' : 'Genre *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.genre}
                        onChange={e => setFormData({...formData, genre: e.target.value as any})}
                      >
                        <option value="Garçon">{isArabic ? 'ذكر' : 'Garçon'}</option>
                        <option value="Fille">{isArabic ? 'أنثى' : 'Fille'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'القسم *' : 'Groupe Scolaire *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.groupeAge}
                        onChange={e => setFormData({...formData, groupeAge: e.target.value as any})}
                      >
                        <option value="Bébés">{isArabic ? 'رضع (0-2 سنوات)' : 'Bébés (0-2 ans)'}</option>
                        <option value="Moyens">{isArabic ? 'متوسطين (2-4 سنوات)' : 'Moyens (2-4 ans)'}</option>
                        <option value="Grands">{isArabic ? 'كبار (4-6 سنوات)' : 'Grands (4-6 ans)'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'فصيلة الدم *' : 'Groupe Sanguin *'}
                      </label>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'حساسية أو عدم تحمل (⚠️)' : 'Allergie ou intolérance (⚠️)'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: لاكتوز، فول سوداني (فارغ إن لم يوجد)' : 'Ex: Lactose, Arachides (Vide si néant)'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.allergie}
                        onChange={e => setFormData({...formData, allergie: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'حمية غذائية خاصة' : 'Régime Alimentaire Spécial'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: خالي من الغلوتين، نباتي...' : 'Ex: Sans gluten, Halal, Végétarien...'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.regimeAlimentaire}
                        onChange={e => setFormData({...formData, regimeAlimentaire: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'يوم استحقاق الدفع الشهري' : 'Jour d\'échéance de paiement mensuel'}
                      </label>
                      <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.jourEcheanceMensuel}
                        onChange={e => setFormData({...formData, jourEcheanceMensuel: e.target.value})}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(jour => (
                          <option key={jour} value={jour}>{jour}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {isArabic
                          ? 'كل شهر، في هذا اليوم، يتم إنشاء فاتورة تلقائياً وتبقى الإشعارات ظاهرة حتى يتم الدفع.'
                          : 'Chaque mois, à ce jour, une facture est générée automatiquement et une notification reste active jusqu\'au règlement.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5 pt-2">
                    <User className="w-4 h-4" />
                    {isArabic ? 'ثانياً: معلومات الاتصال وولي الأمر' : '2. Coordonnées et Profil du Représentant Légal / Parent'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'صلة القرابة *' : 'Lien tuteur *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.parentLien}
                        onChange={e => setFormData({...formData, parentLien: e.target.value as any})}
                      >
                        <option value="Mère">{isArabic ? 'الأم' : 'Mère'}</option>
                        <option value="Père">{isArabic ? 'الأب' : 'Père'}</option>
                        <option value="Tuteur">{isArabic ? 'وصي قانوني' : 'Tuteur'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'اسم الولي *' : 'Prénom Parent *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: كريمة' : 'Ex: Karima'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentPrenom}
                        onChange={e => setFormData({...formData, parentPrenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'لقب الولي *' : 'Nom Parent *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: بلالي' : 'Ex: Belali'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentNom}
                        onChange={e => setFormData({...formData, parentNom: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'رقم الهاتف *' : 'Téléphone principal *'}
                      </label>
                      <input 
                        type="tel" 
                        placeholder="0555 12 89 90"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                        value={formData.parentTelephone}
                        onChange={e => setFormData({...formData, parentTelephone: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'البريد الإلكتروني' : 'Adresse Email'}
                      </label>
                      <input 
                        type="email" 
                        placeholder="karima.b@exemple.dz"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentEmail}
                        onChange={e => setFormData({...formData, parentEmail: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'المهنة' : 'Profession'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: مهندس' : 'Ex: Architecte'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentProfession}
                        onChange={e => setFormData({...formData, parentProfession: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isArabic ? 'العنوان' : 'Adresse de Résidence'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={isArabic ? 'الجزائر العاصمة' : 'Ex: 12 Rue Didouche Mourad, Alger'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.parentAdresse}
                      onChange={e => setFormData({...formData, parentAdresse: e.target.value})} 
                    />
                  </div>
                </div>

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
                      <span className="text-xs font-bold text-slate-700">{isArabic ? 'شهادة طبية مُقدمة' : 'Certificat médical requis remis'}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docVaccin}
                        onChange={e => setFormData({...formData, docVaccin: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">{isArabic ? 'دفتر التلقيح مُحدث' : 'Carnet de vaccination à jour'}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer mt-2 sm:mt-0">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docDomicile}
                        onChange={e => setFormData({...formData, docDomicile: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">{isArabic ? 'إثبات الإقامة متوفر' : 'Justificatif de domicile fourni'}</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer mt-2 sm:mt-0">
                      <input 
                        type="checkbox" 
                        className="w-4.5 h-4.5 text-indigo-600 rounded"
                        checked={formData.docPhoto}
                        onChange={e => setFormData({...formData, docPhoto: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-slate-700">{isArabic ? 'صورة شمسية مُقدمة' : 'Photo d\'identité fournie'}</span>
                    </label>
                  </div>
                </div>

              </div>

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

      {/* ✅ Mini-modal : confirmer la sortie d'un enfant (date + motif) */}
      <AnimatePresence>
        {sortieModalEnfant && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <LogOut className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-slate-900">
                  {isArabic ? 'تسجيل خروج الطفل' : 'Marquer comme sorti(e)'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isArabic ? sortieModalEnfant.prenom + ' ' + sortieModalEnfant.nom : `${sortieModalEnfant.prenom} ${sortieModalEnfant.nom}`}
              </p>

              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {isArabic ? 'تاريخ الخروج' : 'Date de sortie'}
              </label>
              <input
                type="date"
                value={sortieDate}
                onChange={e => setSortieDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-sm font-semibold text-slate-800 mb-4"
              />

              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {isArabic ? 'سبب الخروج' : 'Motif de sortie'}
              </label>
              <select
                value={sortieMotif}
                onChange={e => setSortieMotif(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-sm font-semibold text-slate-800 mb-6"
              >
                {[
                  { fr: 'Fin d\'année scolaire', ar: 'نهاية السنة الدراسية' },
                  { fr: 'Déménagement', ar: 'انتقال / تغيير السكن' },
                  { fr: 'Changement de crèche', ar: 'تغيير الروضة' },
                  { fr: 'Problème de paiement', ar: 'مشكل في الدفع' },
                  { fr: 'Insatisfaction des parents', ar: 'عدم رضا الأولياء' },
                  { fr: 'Autre', ar: 'سبب آخر' },
                ].map(m => (
                  <option key={m.fr} value={m.fr}>{isArabic ? m.ar : m.fr}</option>
                ))}
              </select>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setSortieModalEnfant(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  onClick={handleConfirmerSortie}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  {isArabic ? 'تأكيد' : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedEnfant && (
        <EnfantDetails
          enfant={selectedEnfant}
          onClose={() => setSelectedEnfant(null)}
        />
      )}
    </div>
  );
}
