import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  CalendarCheck, 
  Search, 
  Clock, 
  Thermometer, 
  Frown, 
  Smile, 
  ShieldAlert,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Coffee,
  Heart
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { Presence } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichPresence extends Presence {
  heureArrivee?: string;
  heureDepart?: string;
  temperature?: string;
  motifAbsence?: string;
  repas?: string;
  humeur?: string;
}

export default function PresencesPage() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { presences: dbPresences, enfants: enfantsData, addPresence, deletePresence } = useDb();

  const presences: RichPresence[] = dbPresences.map((p: any) => ({
    ...p,
    heureArrivee: p.heureArrivee || (p.statut === 'Présent' ? '08:30' : undefined),
    heureDepart: p.heureDepart || (p.statut === 'Présent' ? '16:30' : undefined),
    temperature: p.temperature || (p.statut === 'Présent' ? '36.6' : undefined),
    repas: p.repas || (p.statut === 'Présent' ? 'Tout' : undefined),
    humeur: p.humeur || (p.statut === 'Présent' ? 'Souriant' : undefined),
    motifAbsence: p.motifAbsence || undefined
  }));

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('Tous');

  const [formData, setFormData] = useState({
    enfantId: enfantsData[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    statut: 'Présent' as 'Présent' | 'Absent justifié' | 'Absent non justifié',
    heureArrivee: '08:30',
    heureDepart: '16:30',
    temperature: '36.5',
    motifAbsence: '',
    repas: 'Tout',
    humeur: 'Souriant'
  });

  const handleAjouter = () => {
    if (!formData.enfantId || !formData.date) return;
    addPresence(formData);
    setShowModal(false);
    // Reset form
    setFormData({
      enfantId: enfantsData[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      statut: 'Présent',
      heureArrivee: '08:30',
      heureDepart: '16:30',
      temperature: '36.5',
      motifAbsence: '',
      repas: 'Tout',
      humeur: 'Souriant'
    });
  };

  const countPresents = presences.filter(p => p.statut === 'Présent').length;
  const countAbsents = presences.filter(p => p.statut !== 'Présent').length;

  const filteredPresences = presences.filter(p => {
    const enfant = enfantsData.find(e => e.id === p.enfantId);
    const matchesSearch = enfant
      ? `${enfant.prenom} ${enfant.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    const matchesStatut = 
      filterStatut === 'Tous' ||
      (filterStatut === 'Présent' && p.statut === 'Présent') ||
      (filterStatut === 'Absent' && p.statut.startsWith('Absent'));

    return matchesSearch && matchesStatut;
  });

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Upper Widgets Block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الحاضرون اليوم' : 'Présents Aujourd\'hui'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{countPresents} {isArabic ? 'أطفال' : 'enfants'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الغائبون' : 'Absences'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{countAbsents} {isArabic ? 'غائب' : 'absents'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Thermometer className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'معدل درجة الحرارة' : 'Suivi Santé'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">36.7 °C</p>
          </div>
        </div>
      </div>

      {/* Main Header and Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {isArabic ? 'دفتر الحضور والغياب اليومي' : 'Registre des Présences'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'تسيير الحضور اليومي، أوقات الوصول والانصراف والمؤشرات الطبية والتبريرات' 
              : 'Gerez le pointage quotidien, les arrivées/départs, les relevés de température et justificatifs.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{isArabic ? 'تسجيل حالة حضور/غياب' : 'Marquer une fiche'}</span>
        </button>
      </div>

      {/* Search and Filters Block */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن طفل...' : 'Rechercher un enfant...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap shrink-0">
          <button
            onClick={() => setFilterStatut('Tous')}
            className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
              filterStatut === 'Tous'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
          >
            {isArabic ? 'الكل' : 'Tous'}
          </button>
          <button
            onClick={() => setFilterStatut('Présent')}
            className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
              filterStatut === 'Présent'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-500 hover:text-emerald-600'
            }`}
          >
            {isArabic ? 'حاضر' : 'Présents'}
          </button>
          <button
            onClick={() => setFilterStatut('Absent')}
            className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
              filterStatut === 'Absent'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-500 hover:text-rose-600'
            }`}
          >
            {isArabic ? 'غائب' : 'Absents'}
          </button>
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-5">{isArabic ? 'الطفل' : 'Enfant'}</th>
                <th className="p-5">{isArabic ? 'التاريخ' : 'Date'}</th>
                <th className="p-5">{isArabic ? 'الحالة' : 'Statut'}</th>
                <th className="p-5">{isArabic ? 'المعلومات الحيوية والوصول' : 'Santé & Horaires'}</th>
                <th className="p-5">{isArabic ? 'التفاصيل والوجبة' : 'Détails & Repas'}</th>
                <th className="p-5 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {filteredPresences.length > 0 ? (
                filteredPresences.map((p) => {
                  const enfant = enfantsData.find(e => e.id === p.enfantId);
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      {/* Child Profile Column */}
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center text-white shadow-xs ${
                            enfant?.genre === 'Fille' ? 'bg-pink-500' : 'bg-sky-500'
                          }`}>
                            {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : p.enfantId[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 font-extrabold">{enfant ? `${enfant.prenom} ${enfant.nom}` : t('children.all')}</p>
                            <p className="text-xs text-slate-400 font-semibold">{enfant?.groupeAge || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="p-5 whitespace-nowrap text-slate-500 font-bold">
                        {p.date}
                      </td>

                      {/* Statut Badge Column */}
                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold leading-none ${
                          p.statut === 'Présent' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : p.statut === 'Absent justifié' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.statut === 'Présent' ? 'bg-emerald-500' : p.statut === 'Absent justifié' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {p.statut}
                        </span>
                      </td>

                      {/* Health & Arrival Column */}
                      <td className="p-5">
                        {p.statut === 'Présent' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.heureArrivee || '08:30'} - {p.heureDepart || '16:30'}</span>
                            </div>
                            {p.temperature && (
                              <div className="flex items-center gap-1 text-xs text-slate-600 font-bold">
                                <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                <span>{p.temperature} °C</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-rose-500 bg-rose-50/50 px-2.5 py-1 rounded-lg border border-rose-100 inline-block font-semibold">
                            {p.motifAbsence || (isArabic ? 'لم يتم تقديم أي عذر' : 'Aucun motif renseigné')}
                          </p>
                        )}
                      </td>

                      {/* Dinner & Mood Column */}
                      <td className="p-5">
                        {p.statut === 'Présent' ? (
                          <div className="space-y-1">
                            {p.repas && (
                              <p className="text-xs text-slate-600 flex items-center gap-1">
                                <Coffee className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{isArabic ? 'الشهية' : 'Repas'}: <strong className="text-slate-800">{p.repas}</strong></span>
                              </p>
                            )}
                            {p.humeur && (
                              <p className="text-xs text-slate-600 flex items-center gap-1 font-bold">
                                <Heart className="w-3.5 h-3.5 text-pink-500" />
                                <span>{isArabic ? 'المزاج' : 'Humeur'}: <strong className="text-pink-600">{p.humeur}</strong></span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">--</span>
                        )}
                      </td>

                      {/* Delete actions */}
                      <td className="p-5 text-center">
                        <button 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer" 
                          onClick={() => {
                            const confirmationMsg = isArabic
                              ? 'هل أنت متأكد من حذف سجل الحضور هذا؟'
                              : 'Êtes-vous sûr de vouloir supprimer ce relevé de présence ?';
                            if (window.confirm(confirmationMsg)) {
                              deletePresence(p.id);
                            }
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                    <p className="font-extrabold">{isArabic ? 'لا توجد بيانات حضور متطابقة' : 'Aucune fiche de présence enregistrée'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'اضغط على زر التسجيل لبدء يوم جديد.' : 'Commencez par ajouter un nouveau relevé de pointage.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exquisite Full Information Presence Form (As demanded by user) */}
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
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'كتابة سجل يومي مفصل' : 'Fiche de Pointage Détaillée'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'سجل الحضور والغياب، المعايير الصحية والمزاج والأكل' : 'Saisie complète d\'indicateurs physiologiques et justifications d\'absences'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                
                {/* Child and Date Selector (Row 1) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'اختر الطفل *' : 'Sélectionner l\'Enfant *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.enfantId} 
                      onChange={e => setFormData({...formData, enfantId: e.target.value})}
                    >
                      {enfantsData.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'التاريخ *' : 'Sélectionner la Date *'}
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Statut Toggle Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'حالة الحضور والغياب *' : 'Statut de Présence / Absence *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'Présent', label: isArabic ? 'حاضر' : 'Présent', bg: 'hover:border-emerald-500 active:bg-emerald-50', activeBg: 'bg-emerald-600 text-white' },
                      { key: 'Absent justifié', label: isArabic ? 'غائب مبرر' : 'Absent Justifié', bg: 'hover:border-amber-500 active:bg-amber-50', activeBg: 'bg-amber-600 text-white' },
                      { key: 'Absent non justifié', label: isArabic ? 'غائب غير مبرر' : 'Absent Non Justifié', bg: 'hover:border-rose-500 active:bg-rose-50', activeBg: 'bg-rose-600 text-white' }
                    ].map(btn => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setFormData({...formData, statut: btn.key as any})}
                        className={`p-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          formData.statut === btn.key 
                            ? btn.activeBg 
                            : `bg-slate-50 text-slate-600 border-slate-200 ${btn.bg}`
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional fields based on selected status (Exquisite design!) */}
                {formData.statut === 'Présent' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4"
                  >
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-2">{isArabic ? 'المعايير الصحية وأوقات الحضور' : 'Relevés d\'activité et physiologie (Présent)'}</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Temperature input */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                          {isArabic ? 'الحرارة (°C)' : 'Température'}
                        </label>
                        <input 
                          type="text" 
                          placeholder="36.5"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-black text-slate-800" 
                          value={formData.temperature} 
                          onChange={e => setFormData({...formData, temperature: e.target.value})} 
                        />
                      </div>

                      {/* Check-In time */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {isArabic ? 'وقت الوصول' : 'Heure d\'Arrivé'}
                        </label>
                        <input 
                          type="text" 
                          placeholder="08:30"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-slate-800" 
                          value={formData.heureArrivee} 
                          onChange={e => setFormData({...formData, heureArrivee: e.target.value})} 
                        />
                      </div>

                      {/* Check-Out time */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {isArabic ? 'وقت الخروج' : 'Heure de Départ'}
                        </label>
                        <input 
                          type="text" 
                          placeholder="16:30"
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-bold text-slate-800" 
                          value={formData.heureDepart} 
                          onChange={e => setFormData({...formData, heureDepart: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      {/* Repas selection */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Coffee className="w-3.5 h-3.5 text-indigo-500" />
                          {isArabic ? 'استهلاك الوجبة' : 'Repas de la journée'}
                        </label>
                        <select 
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-semibold text-slate-800"
                          value={formData.repas}
                          onChange={e => setFormData({...formData, repas: e.target.value})}
                        >
                          <option value="Tout">Tout mangé</option>
                          <option value="Moyen">Moyen</option>
                          <option value="Peu">Peu</option>
                          <option value="Non">N'a pas mangé</option>
                        </select>
                      </div>

                      {/* Humeur choice */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-pink-500" />
                          {isArabic ? 'مزاج وحالة الطفل' : 'Humeur générale'}
                        </label>
                        <select 
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 text-xs font-semibold text-slate-800"
                          value={formData.humeur}
                          onChange={e => setFormData({...formData, humeur: e.target.value})}
                        >
                          <option value="Souriant">Souriant & Enjoué</option>
                          <option value="Calme">Calme & Stable</option>
                          <option value="Agité">Agité</option>
                          <option value="Fatigué">Fatigué / Somnolent</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 space-y-4"
                  >
                    <p className="text-xs font-black text-rose-600 uppercase tracking-wider mb-2">{isArabic ? 'تفاصيل عذر الغياب' : 'Mémoriser l\'Absence (Justificatifs)'}</p>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        {isArabic ? 'سبب الغياب بالتفصيل' : 'Description du motif d\'absence'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: موعد طبي، زكام خفيف، سفر عائلي...' : 'Ex: Fièvre, rendez-vous pédiatre, déplacement familial...'}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-rose-500 text-sm font-semibold text-slate-800" 
                        value={formData.motifAbsence} 
                        onChange={e => setFormData({...formData, motifAbsence: e.target.value})} 
                      />
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Save button and actions */}
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
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
