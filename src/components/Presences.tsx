import { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  CalendarCheck, 
  Search, 
  Clock, 
  Thermometer, 
  ChevronDown,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Coffee,
  Heart,
  Users,
  Calendar,
  Layers,
  ArrowLeftRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Presence } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function PresencesPage() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { showToast } = useToast();

  const { 
    presences: allDbPresences, 
    enfants: allEnfantsData, 
    classes: classesData,
    addPresence,
    updatePresence,
    deletePresence
  } = useDb();
  
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  
  // Filtrer les enfants de la crèche courante
  const enfantsData = isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData;
  const enfantIdsVisibles = new Set(enfantsData.map(e => e.id));
  const dbPresences = isDirecteur ? allDbPresences.filter(p => enfantIdsVisibles.has(p.enfantId)) : allDbPresences;

  const presences: Presence[] = dbPresences.map((p: any) => ({
    ...p,
    heureArrivee: p.heureArrivee || (p.statut === 'Présent' ? '08:30' : undefined),
    heureDepart: p.heureDepart || (p.statut === 'Présent' ? '16:30' : undefined),
    temperature: p.temperature || (p.statut === 'Présent' ? '36.6' : undefined),
    repas: p.repas || (p.statut === 'Présent' ? 'Tout' : undefined),
    humeur: p.humeur || (p.statut === 'Présent' ? 'Souriant' : undefined),
    motifAbsence: p.motifAbsence || undefined
  }));

  // Gestion des États (Tabs)
  const [activeTab, setActiveTab] = useState<'pointing' | 'history'>('pointing');
  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000).toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClasseId, setExpandedClasseId] = useState<string | null>(null);

  // Modals
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedEnfantForAbsence, setSelectedEnfantForAbsence] = useState<string | null>(null);
  const [showPresenceDetailsModal, setShowPresenceDetailsModal] = useState(false);
  const [selectedEnfantForPresenceDetails, setSelectedEnfantForPresenceDetails] = useState<string | null>(null);

  // Formulaires Modals
  const [absenceForm, setAbsenceForm] = useState({
    statut: 'Absent non justifié' as 'Absent justifié' | 'Absent non justifié',
    motifAbsence: ''
  });

  const [presenceDetailsForm, setPresenceDetailsForm] = useState({
    heureArrivee: '08:30',
    heureDepart: '16:30',
    temperature: '36.5',
    repas: 'Tout',
    humeur: 'Souriant'
  });

  // Action rapide de pointage "Présent" : on conserve l’id existant pour éviter
  // les doublons et permettre une vraie modification du pointage du jour.
  const handleMarkPresent = (enfantId: string) => {
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    if (existing?.statut === 'Présent') {
      setPresenceDetailsForm({
        heureArrivee: existing.heureArrivee || '08:30',
        heureDepart: existing.heureDepart || '16:30',
        temperature: existing.temperature || '36.5',
        repas: existing.repas || 'Tout',
        humeur: existing.humeur || 'Souriant'
      });
    } else {
      setPresenceDetailsForm({
        heureArrivee: '08:30',
        heureDepart: '16:30',
        temperature: '36.5',
        repas: 'Tout',
        humeur: 'Souriant'
      });
    }
    setSelectedEnfantForPresenceDetails(enfantId);
    setShowPresenceDetailsModal(true);
  };

  // Soumission des détails de présence avec validation minimale des données métier.
  const submitPresenceDetails = () => {
    if (!selectedEnfantForPresenceDetails) return;
    const arrival = presenceDetailsForm.heureArrivee;
    const departure = presenceDetailsForm.heureDepart;
    const temperature = Number(presenceDetailsForm.temperature.replace(',', '.'));
    if (!arrival || !departure || arrival >= departure) {
      showToast(isArabic ? 'يرجى التحقق من وقت الدخول والخروج.' : 'Vérifiez les heures d’arrivée et de départ.', 'error');
      return;
    }
    if (!Number.isFinite(temperature) || temperature < 30 || temperature > 45) {
      showToast(isArabic ? 'درجة الحرارة غير صالحة.' : 'La température saisie est invalide.', 'error');
      return;
    }
    const existing = presences.find(p => p.enfantId === selectedEnfantForPresenceDetails && p.date === selectedDate);
    const details = {
      enfantId: selectedEnfantForPresenceDetails,
      date: selectedDate,
      statut: 'Présent' as const,
      ...presenceDetailsForm,
      temperature: temperature.toFixed(1)
    };
    if (existing) {
      updatePresence(existing.id, details);
    } else {
      addPresence(details);
    }

    setShowPresenceDetailsModal(false);
    setSelectedEnfantForPresenceDetails(null);
    setPresenceDetailsForm({
      heureArrivee: '08:30',
      heureDepart: '16:30',
      temperature: '36.5',
      repas: 'Tout',
      humeur: 'Souriant'
    });
  };

  // Action rapide de pointage "Absent" (Ouvre le modal de saisie de motif)
  const handleMarkAbsentClick = (enfantId: string) => {
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    setAbsenceForm({
      statut: existing?.statut === 'Absent justifié' ? 'Absent justifié' : 'Absent non justifié',
      motifAbsence: existing?.motifAbsence || ''
    });
    setSelectedEnfantForAbsence(enfantId);
    setShowAbsenceModal(true);
  };

  // Soumission de l’absence : le motif est obligatoire pour garder un registre exploitable.
  const submitAbsence = () => {
    if (!selectedEnfantForAbsence) return;
    const motif = absenceForm.motifAbsence.trim();
    if (!motif) {
      showToast(isArabic ? 'يرجى إدخال سبب الغياب.' : 'Veuillez renseigner le motif de l’absence.', 'error');
      return;
    }
    const existing = presences.find(p => p.enfantId === selectedEnfantForAbsence && p.date === selectedDate);
    const absence = {
      enfantId: selectedEnfantForAbsence,
      date: selectedDate,
      statut: absenceForm.statut,
      motifAbsence: motif,
    };
    if (existing) {
      updatePresence(existing.id, absence);
    } else {
      addPresence(absence);
    }

    setShowAbsenceModal(false);
    setSelectedEnfantForAbsence(null);
    setAbsenceForm({ statut: 'Absent non justifié', motifAbsence: '' });
  };

  // Retirer un pointage (remettre à non-pointé)
  const handleResetPointing = (enfantId: string) => {
    const existing = presences.find(p => p.enfantId === enfantId && p.date === selectedDate);
    if (existing) {
      deletePresence(existing.id);
    }
  };

  // --- CALCULS DES STATISTIQUES POUR LA DATE SÉLECTIONNÉE ---
  const todayPresences = useMemo(() => {
    // Une seule fiche par enfant et par jour : les anciens doublons ne faussent plus les compteurs.
    const recordsByChild = new Map<string, Presence>();
    presences.filter(p => p.date === selectedDate).forEach(p => recordsByChild.set(p.enfantId, p));
    return Array.from(recordsByChild.values());
  }, [presences, selectedDate]);

  const countPresents = todayPresences.filter(p => p.statut === 'Présent').length;
  const countAbsents = todayPresences.filter(p => p.statut.startsWith('Absent')).length;
  const countNonPointes = Math.max(enfantsData.length - todayPresences.length, 0);
  const isDayComplete = enfantsData.length > 0 && countNonPointes === 0;

  // --- HISTORIQUE DES ABSENCES TRIÉ PAR JOUR (Pour l'onglet Historique) ---
  const absencesGroupedByDay = useMemo(() => {
    const allAbsences = presences.filter(p => p.statut.startsWith('Absent'));
    
    // Regrouper par date
    const groups: Record<string, Presence[]> = {};
    allAbsences.forEach(p => {
      if (!groups[p.date]) {
        groups[p.date] = [];
      }
      groups[p.date].push(p);
    });

    // Trier les dates par ordre décroissant (du plus récent au plus ancien)
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [presences]);

  return (
    <div className={`space-y-6 ${isArabic ? 'rtl' : 'ltr'}`}>
      
      {/* En-tête principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-8 h-8 text-indigo-600" />
            {isArabic ? 'تسيير الحضور والغيابات' : 'Registre des Présences'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isArabic 
              ? 'سجل الحضور اليومي مقسم حسب الفصول، ومتابعة ذكية للغيابات الشهرية' 
              : 'Registre d\'appel quotidien par classe et historique chronologique des absences.'}
          </p>
        </div>

        {/* Sélectionneur de date et état de clôture du pointage */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-3 bg-white p-3 border border-slate-150 rounded-2xl shadow-xs">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-sm font-bold text-slate-800 cursor-pointer"
            />
          </div>
          <div className={`px-3 py-2 rounded-xl text-xs font-black border ${
            isDayComplete
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
            {isDayComplete
              ? (isArabic ? 'اليوم مكتمل' : 'Pointage complet')
              : (isArabic ? `${countNonPointes} أطفال لم يسجلوا` : `${countNonPointes} enfant(s) à pointer`)}
          </div>
        </div>
      </div>

      {/* Widgets Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isArabic ? 'حاضر اليوم' : 'Présents'}</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{countPresents}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isArabic ? 'غائب اليوم' : 'Absents'}</p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5">{countAbsents}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isArabic ? 'إجمالي الأطفال' : 'Total Enfants'}</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{enfantsData.length}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDayComplete ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isArabic ? 'المتبقي' : 'À pointer'}</p>
            <p className={`text-xl sm:text-2xl font-black mt-0.5 ${isDayComplete ? 'text-emerald-600' : 'text-amber-600'}`}>{countNonPointes}</p>
          </div>
        </div>
      </div>

      {/* Barre de navigation des onglets */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('pointing')}
          className={`pb-3 text-sm font-black transition-all cursor-pointer relative ${
            activeTab === 'pointing' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isArabic ? 'أخذ حضور الفصول اليومي' : 'Appel quotidien'}
          {activeTab === 'pointing' && (
            <motion.div layoutId="activeTabBorder" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-black transition-all cursor-pointer relative flex items-center gap-2 ${
            activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {isArabic ? 'سجل الغيابات المنظم' : 'Registre des absences'}
          <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full">
            {presences.filter(p => p.statut.startsWith('Absent')).length}
          </span>
          {activeTab === 'history' && (
            <motion.div layoutId="activeTabBorder" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. ONGLET : POINTAGE QUOTIDIEN PAR CLASSE */}
      {/* ======================================================== */}
      {activeTab === 'pointing' && (
        <div className="space-y-4">
          
          {/* Barre de recherche d'enfant */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={isArabic ? 'ابحث عن طفل لتحديد صفه...' : 'Rechercher un enfant...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition text-sm font-semibold text-slate-800"
            />
          </div>

          {/* Grid des Classes (Accordéons) */}
          <div className="space-y-3">
            {classesData.map((classe) => {
              // Filtrer les enfants appartenant à cette classe
              const classeChildren = enfantsData.filter(e => 
                classe.childrenIds?.includes(e.id) &&
                `${e.prenom} ${e.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
              );

              if (searchTerm && classeChildren.length === 0) return null;

              const isExpanded = expandedClasseId === classe.id;

              return (
                <div key={classe.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  
                  {/* Header de l'accordéon de classe */}
                  <div 
                    onClick={() => setExpandedClasseId(isExpanded ? null : classe.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-950 text-base">{classe.nom}</h3>
                        <p className="text-xs text-slate-400 font-bold">{classe.niveau} • {classeChildren.length} {isArabic ? 'أطفال مسجلين' : 'enfants'}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-all ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                  </div>

                  {/* Corps de l'accordéon contenant les enfants */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-100 bg-slate-50/20"
                      >
                        <div className="p-5 divide-y divide-slate-100">
                          {classeChildren.length > 0 ? (
                            classeChildren.map((enfant) => {
                              // Vérifier le statut de l'enfant pour la date sélectionnée
                              const statusRecord = todayPresences.find(p => p.enfantId === enfant.id);
                              
                              return (
                                <div key={enfant.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  
                                  {/* Infos Enfant */}
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center text-white ${
                                      enfant.genre === 'Fille' ? 'bg-pink-500' : 'bg-sky-500'
                                    }`}>
                                      {enfant.prenom[0]}{enfant.nom[0]}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-slate-900">{enfant.prenom} {enfant.nom}</p>
                                      <p className="text-[11px] text-slate-400 font-bold">{enfant.genre}</p>
                                    </div>
                                  </div>

                                  {/* Affichage des détails si pointé présent */}
                                  {statusRecord?.statut === 'Présent' && (
                                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                                      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md font-bold">
                                        <Thermometer className="w-3.5 h-3.5" /> {statusRecord.temperature}°C
                                      </span>
                                      <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md font-bold">
                                        <Clock className="w-3.5 h-3.5" /> {statusRecord.heureArrivee} - {statusRecord.heureDepart}
                                      </span>
                                    </div>
                                  )}

                                  {/* Affichage du motif si pointé absent */}
                                  {statusRecord?.statut.startsWith('Absent') && (
                                    <div className="max-w-xs text-xs text-rose-600 bg-rose-50/50 border border-rose-100 px-3 py-1.5 rounded-xl font-bold">
                                      {statusRecord.motifAbsence}
                                    </div>
                                  )}

                                  {/* Double boutons interactifs de Pointage */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    
                                    {/* Bouton : PRÉSENT */}
                                    <button
                                      onClick={() => handleMarkPresent(enfant.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                                        statusRecord?.statut === 'Présent'
                                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30'
                                      }`}
                                    >
                                      {isArabic ? 'حاضر' : 'Présent'}
                                    </button>

                                    {/* Bouton : ABSENT */}
                                    <button
                                      onClick={() => handleMarkAbsentClick(enfant.id)}
                                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                                        statusRecord?.statut.startsWith('Absent')
                                          ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                                          : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50/30'
                                      }`}
                                    >
                                      {isArabic ? 'غائب' : 'Absent'}
                                    </button>

                                    {/* Bouton : Re-initialiser le pointage */}
                                    {statusRecord && (
                                      <button 
                                        onClick={() => handleResetPointing(enfant.id)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                        title={isArabic ? 'إلغاء التحديد' : 'Réinitialiser'}
                                      >
                                        <ArrowLeftRight className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>

                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-400 text-center py-4">{isArabic ? 'لا توجد أطفال يطابقون بحثك' : 'Aucun enfant trouvé.'}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ONGLET : HISTORIQUE DES ABSENCES CLASSÉ PAR JOURS */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          
          {absencesGroupedByDay.length > 0 ? (
            absencesGroupedByDay.map(([date, dailyAbsences]) => (
              <div key={date} className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                
                {/* En-tête du jour */}
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date(date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                  <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-full font-black">
                    {dailyAbsences.length} {isArabic ? 'غيابات' : 'absences'}
                  </span>
                </div>

                {/* Liste des absences de cette journée */}
                <div className="divide-y divide-slate-100">
                  {dailyAbsences.map((abs) => {
                    const enfant = enfantsData.find(e => e.id === abs.enfantId);
                    
                    return (
                      <div key={abs.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        {/* Kid profile */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 font-black text-xs flex items-center justify-center">
                            {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : '?'}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{enfant ? `${enfant.prenom} ${enfant.nom}` : 'Enfant Inconnu'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">
                              {abs.statut === 'Absent justifié' ? (isArabic ? 'غياب مبرر 🟢' : 'Justifiée 🟢') : (isArabic ? 'غياب غير مبرر 🔴' : 'Non justifiée 🔴')}
                            </p>
                          </div>
                        </div>

                        {/* Motif d'absence */}
                        <div className="flex-1 max-w-md bg-slate-50/80 border border-slate-100 p-3 rounded-xl">
                          <p className="text-xs font-bold text-slate-700">
                            {abs.motifAbsence}
                          </p>
                        </div>

                        {/* Action : Supprimer le rapport d'absence */}
                        <button
                          onClick={() => {
                            if (window.confirm(isArabic ? 'هل تريد حذف تسجيل الغياب هذا؟' : 'Supprimer cette absence ?')) {
                              deletePresence(abs.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer self-end sm:self-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    );
                  })}
                </div>

              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-xs">
              <HelpCircle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-extrabold text-slate-900">{isArabic ? 'لا توجد غيابات مسجلة' : 'Aucune absence enregistrée'}</p>
              <p className="text-xs text-slate-400 mt-1">{isArabic ? 'تظهر الغيابات هنا عندما تقوم بتأشير الأطفال كغائبين.' : 'Les absences marquées apparaîtront ici triées par jour.'}</p>
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1 : SPÉCIFIER LES DÉTAILS DE L'ABSENCE */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showAbsenceModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setShowAbsenceModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black">{isArabic ? 'تفاصيل عذر الغياب' : 'Enregistrer une Absence'}</h3>
                  <p className="text-xs text-rose-100 mt-0.5">{isArabic ? 'تحديد تبرير وسبب الغياب بدقة' : 'Préciser la justification et le motif de l\'absence'}</p>
                </div>
                <button 
                  onClick={() => setShowAbsenceModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4">
                
                {/* Type de justification */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'حالة الغياب *' : 'Statut de l\'absence *'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAbsenceForm({ ...absenceForm, statut: 'Absent justifié' })}
                      className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        absenceForm.statut === 'Absent justifié'
                          ? 'bg-amber-600 text-white border-transparent'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isArabic ? 'مبرر' : 'Justifié'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceForm({ ...absenceForm, statut: 'Absent non justifié' })}
                      className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                        absenceForm.statut === 'Absent non justifié'
                          ? 'bg-rose-600 text-white border-transparent'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isArabic ? 'غير مبرر' : 'Non justifié'}
                    </button>
                  </div>
                </div>

                {/* Motif de l'absence */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'عذر أو سبب الغياب *' : 'Motif ou description *'}</label>
                  <input
                    type="text"
                    value={absenceForm.motifAbsence}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, motifAbsence: e.target.value })}
                    placeholder={isArabic ? 'مثال: موعد طبي، وعكة صحية، سفر...' : 'Ex: Malade, voyage, urgence familiale...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 font-semibold text-sm text-slate-800"
                  />
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setShowAbsenceModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-slate-700 transition cursor-pointer text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={submitAbsence}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition cursor-pointer text-xs shadow-md shadow-rose-200"
                >
                  {isArabic ? 'تأشير كغائب' : 'Marquer absent'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2 : SPÉCIFIER LES DÉTAILS DU PASSAGE / SANTÉ (PRÉSENT) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {showPresenceDetailsModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setShowPresenceDetailsModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black">{isArabic ? 'مؤشرات يوم الحضور' : 'Indicateurs de Présence'}</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">{isArabic ? 'مراقبة المعايير الصحية والمزاج والأكل' : 'Saisir les observations santé, repas et humeur'}</p>
                </div>
                <button 
                  onClick={() => setShowPresenceDetailsModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4">
                
                {/* Température */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'درجة الحرارة (°C)' : 'Température (°C)'}</label>
                  <input
                    type="text"
                    value={presenceDetailsForm.temperature}
                    onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, temperature: e.target.value })}
                    placeholder="36.5"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-black text-sm text-slate-800"
                  />
                </div>

                {/* Heures Arrivée & Départ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'وقت الدخول' : 'Heure d\'arrivée'}</label>
                    <input
                      type="time"
                      value={presenceDetailsForm.heureArrivee}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, heureArrivee: e.target.value })}
                      placeholder="08:30"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'وقت الانصراف' : 'Heure de départ'}</label>
                    <input
                      type="time"
                      value={presenceDetailsForm.heureDepart}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, heureDepart: e.target.value })}
                      placeholder="16:30"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    />
                  </div>
                </div>

                {/* Repas & Humeur */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'الوجبة' : 'Repas mangé'}</label>
                    <select
                      value={presenceDetailsForm.repas}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, repas: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    >
                      <option value="Tout">Tout mangé</option>
                      <option value="Moyen">Moyen</option>
                      <option value="Peu">Peu</option>
                      <option value="Non">N'a pas mangé</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isArabic ? 'المزاج اليومي' : 'Humeur globale'}</label>
                    <select
                      value={presenceDetailsForm.humeur}
                      onChange={(e) => setPresenceDetailsForm({ ...presenceDetailsForm, humeur: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-sm text-slate-800"
                    >
                      <option value="Souriant">Souriant</option>
                      <option value="Calme">Calme</option>
                      <option value="Agité">Agité</option>
                      <option value="Fatigué">Fatigué</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setShowPresenceDetailsModal(false)}
                  className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold text-slate-700 transition cursor-pointer text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={submitPresenceDetails}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer text-xs shadow-md"
                >
                  {isArabic ? 'تأشير كحاضر' : 'Marquer présent'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
