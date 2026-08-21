import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  Sparkles, 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Search, 
  CheckSquare, 
  HelpCircle, 
  Target, 
  Wand2, 
  MapPin,
  Compass
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Activite } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichActivite extends Activite {
  competenceVisee?: string;
  heureDebut?: string;
  heureFin?: string;
  materielRequis?: string;
  lieu?: string;
  educateurRef?: string;
}

export default function Activites() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { activites: allDbActivites, personnel: personnelData, addActivite, deleteActivite } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbActivites = isDirecteur ? allDbActivites.filter((a: any) => a.crecheId === user!.id) : allDbActivites;

  const activites: RichActivite[] = dbActivites.map((a: any, idx: number) => {
    const skills = ['Motricité Fine', 'Éveil Musical', 'Autonomie & Tri', 'Savoir-vivre & Coopération'];
    const places = ['Atelier Peinture', 'Salle d\'Éveil', 'Jardin de la crèche', 'Salle Polyvalente'];
    return {
      ...a,
      competenceVisee: a.competenceVisee || skills[idx % skills.length],
      heureDebut: a.heureDebut || '10:00',
      heureFin: a.heureFin || '11:15',
      materielRequis: a.materielRequis || (idx % 2 === 0 ? 'Pâte à modeler, Peinture, Tabliers' : 'Instruments en bois, CD de comptines'),
      lieu: a.lieu || places[idx % places.length],
      educateurRef: a.educateurRef || (personnelData[idx % personnelData.length] 
        ? `${personnelData[idx % personnelData.length].prenom} ${personnelData[idx % personnelData.length].nom}` 
        : 'Mme. Nassima'),
    };
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedActivite, setSelectedActivite] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    titre: '',
    date: new Date().toISOString().split('T')[0],
    groupe: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    competenceVisee: 'Motricité Fine',
    heureDebut: '10:00',
    heureFin: '11:00',
    materielRequis: 'Feuilles, Gommettes colorées, Colle',
    lieu: 'Salle d\'Éveil',
    educateurRef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : 'Mme. Nassima'
  });

  const handleAjouter = () => {
    if (!formData.titre || !formData.date) return;
    addActivite({ ...formData, crecheId: isDirecteur ? user!.id : undefined } as any);
    setShowModal(false);
    // Reset form
    setFormData({
      titre: '',
      date: new Date().toISOString().split('T')[0],
      groupe: 'Bébés',
      competenceVisee: 'Motricité Fine',
      heureDebut: '10:00',
      heureFin: '11:00',
      materielRequis: 'Feuilles, Gommettes colorées, Colle',
      lieu: 'Salle d\'Éveil',
      educateurRef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : 'Mme. Nassima'
    });
  };

  const filteredActivites = activites.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.titre.toLowerCase().includes(term) ||
      a.competenceVisee?.toLowerCase().includes(term) ||
      a.groupe.toLowerCase().includes(term)
    );
  });

  const getGroupBadgeStyles = (grp: string) => {
    switch (grp) {
      case 'Bébés':
        return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'Moyens':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-100';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 font-sans">
      {/* Upper overview counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الأنشطة المخططة' : 'Activités au Programme'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{activites.length} {isArabic ? 'حصة نشاط' : 'ateliers'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'مجالات المهارات المكتسبة' : 'Piliers d\'Apprentissage'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{isArabic ? '4 ركائز ذكاء' : '4 Piliers Cognitifs'}</p>
          </div>
        </div>
      </div>

      {/* Header title & add action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('activities')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'إنشاء ومتابعة الأنشطة البيداغوجية، الألعاب التفاعلية والأهداف الحسية والحركية للأطفال' 
              : 'Planifiez les activités d\'éveil sensoriel, d\'éducation physique, d\'arts plastiques et de comptines.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('activities.add')}</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن نشاط أو مهارة مستهدفة...' : 'Rechercher un atelier ou une compétence d\'éveil...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
        {filteredActivites.length > 0 ? (
          filteredActivites.map((a) => {
            const grpStyle = getGroupBadgeStyles(a.groupe);
            
          return (
            <div 
              key={a.id} 
              className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedActivite(a)}
            >
              <div>
                {/* Card top banner */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${grpStyle}`}>
                    {a.groupe}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {a.date}
                  </span>
                </div>

                {/* Activity Title */}
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">{a.titre}</h3>

                {/* Target Skill Row */}
                <div className="mt-4 flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <Target className="w-4 h-4 text-rose-500" />
                  <div className="text-xs">
                    <p className="text-slate-400 font-bold leading-none">{isArabic ? 'المهارة البيداغوجية' : 'Axe d\'Épanouissement'}</p>
                    <p className="text-slate-800 font-black mt-1">{a.competenceVisee}</p>
                  </div>
                </div>

                {/* Scheduled slots and Physical Place */}
                <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{a.heureDebut} - {a.heureFin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'المكان: ' : 'Lieu : '}<strong className="text-slate-700">{a.lieu}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isArabic ? 'المشرف: ' : 'Éducateur : '}<strong className="text-slate-700">{a.educateurRef}</strong></span>
                  </div>
                </div>

                {/* Material Supplies requirements */}
                {a.materielRequis && (
                  <div className="mt-5 pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">{isArabic ? 'المستلزمات المطلوبة' : 'Matériel à préparer'}</p>
                    <p className="text-xs text-indigo-700 bg-indigo-50/50 rounded-lg p-2 font-medium leading-relaxed border border-indigo-100/30">
                      {a.materielRequis}
                    </p>
                  </div>
                )}

              </div>

              {/* Quick actions row */}
              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end">
                <button 
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    const confirmationMsg = isArabic
                      ? 'هل أنت متأكد من حذف هذا النشاط المبرمج؟'
                      : 'Êtes-vous sûr de vouloir supprimer cette activité planifiée ?';
                    if (window.confirm(confirmationMsg)) {
                      deleteActivite(a.id);
                    }
                  }}
                >
                  <Trash2 size={15} />
                  <span>{isArabic ? 'حذف' : 'Supprimer'}</span>
                </button>
              </div>
            </div>
          );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد تطابقات للبحث' : 'Aucune activité planifiée'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'أضف نشاطا ترفيهيا جديدا للبدء.' : 'Établissez un nouvel atelier éducatif dès aujourd\'hui.'}</p>
          </div>
        )}
      </div>

      {/* Adding Rich Activities Modal ("PLEINE DE FORMATION") */}
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
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'تخطيط نشاط ترفيهي وبيداغوجي جديد' : 'Planification d\'Atelier Éducatif'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تحديد الأهداف، المربيات، المعدات، الموقع والفترات الزمنية للورشات' : 'Fiche d\'animation, équipement, aires de jeu & heures'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'عنوان النشاط التربوي *' : 'Intitulé de l\'Atelier *'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pâte à modeler & Formes 3D"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.titre} 
                    onChange={e => setFormData({...formData, titre: e.target.value})} 
                  />
                </div>

                {/* Competence & Target Group (Row 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'المهارة المستهدفة بالتطوير' : 'Axe de Développement Principal'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.competenceVisee}
                      onChange={e => setFormData({...formData, competenceVisee: e.target.value})}
                    >
                      <option value="Motricité Fine">Motricité Fine & Coordination</option>
                      <option value="Éveil Musical">Éveil Musical & Sensoriel</option>
                      <option value="Sortie & Jardin">Éco-citoyenneté & Extérieur</option>
                      <option value="Graphisme et Couleurs">Graphisme, Dessin et Peinture</option>
                      <option value="Coopération">Jeu Social & Collaboration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الفئة العمرية المستهدفة *' : 'Groupe Cible *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.groupe} 
                      onChange={e => setFormData({...formData, groupe: e.target.value as any})}
                    >
                      <option value="Bébés">Bébés (0-2 ans)</option>
                      <option value="Moyens">Moyens (2-4 ans)</option>
                      <option value="Grands">Grands (4-6 ans)</option>
                    </select>
                  </div>
                </div>

                {/* Times and Calendar Date (Row 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'التاريخ الفعلي *' : 'Date de Tenue *'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'البداية' : 'Heure de Début'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="10:00"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.heureDebut} 
                      onChange={e => setFormData({...formData, heureDebut: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'النهاية' : 'Heure de Fin'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="11:00"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.heureFin} 
                      onChange={e => setFormData({...formData, heureFin: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Assigned Educator & Physical Place */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'المربي المشرف المنشط *' : 'Animateur Référent *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.educateurRef}
                      onChange={e => setFormData({...formData, educateurRef: e.target.value})}
                    >
                      {personnelData.map(p => (
                        <option key={p.id} value={`${p.prenom} ${p.nom}`}>
                          {p.prenom} {p.nom} ({p.poste})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'مكان النشاط وصالة التدريب *' : 'Espace choisi *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Salle d'Éveil, Salle Peinture"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                      value={formData.lieu} 
                      onChange={e => setFormData({...formData, lieu: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Material Requirements Checklist */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'قائمة المستلزمات والمواد المطلوبة' : 'Matériel requis à préparer'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Papier canson, Feutres magiques, tablier salissant..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                    value={formData.materielRequis} 
                    onChange={e => setFormData({...formData, materielRequis: e.target.value})} 
                  />
                </div>

              </div>

              {/* Buttons */}
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

      {/* Activity Details Info View Modal */}
      <AnimatePresence>
        {selectedActivite && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setSelectedActivite(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{selectedActivite.titre}</h3>
                  <p className="text-xs text-teal-100 mt-0.5">{isArabic ? 'تفاصيل النشاط ووسائله البيداغوجية' : 'Fiche d\'animation d\'Atelier Éducatif'}</p>
                </div>
                <button 
                  onClick={() => setSelectedActivite(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الفئة المستهدفة' : 'Groupe Enfant'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.groupe}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الموقع' : 'Lieu / Espace'}</span>
                    <span className="text-xs font-black text-slate-855">{selectedActivite.lieu}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الوقت' : 'Plage Horaire'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.heureDebut} - {selectedActivite.heureFin}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'التاريخ الفني' : 'Date de réalisation'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.date}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">{isArabic ? 'محور الكفاءة المستهدف' : 'Compétence & Développement Visé'}</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Target className="w-5 h-5 text-rose-500 stroke-[2.5]" />
                    <span>{selectedActivite.competenceVisee}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">{isArabic ? 'المشرف المسؤول' : 'Éducateur Leader'}</span>
                  <span className="text-sm font-black text-indigo-600">{selectedActivite.educateurRef}</span>
                </div>

                {selectedActivite.materielRequis && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block mb-1">{isArabic ? 'المستلزمات المطلوبة' : 'Matériel à préparer'}</span>
                    <p className="text-xs font-bold text-indigo-900 leading-relaxed">{selectedActivite.materielRequis}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
