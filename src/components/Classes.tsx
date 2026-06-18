import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  School, 
  Users, 
  Sparkles, 
  Tag, 
  AlertCircle, 
  Layers, 
  Bookmark, 
  Layout, 
  UserSquare, 
  Home
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Classe } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichClasse extends Classe {
  educateurChef?: string;
  salleNom?: string;
  couleurTheme?: 'emerald' | 'sky' | 'indigo' | 'rose' | 'amber';
}

export default function Classes() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { classes: allDbClasses, enfants: enfantsData, personnel: personnelData, addClasse, deleteClasse } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbClasses = isDirecteur ? allDbClasses.filter((c: any) => c.crecheId === user!.id) : allDbClasses;

  const classes: RichClasse[] = dbClasses.map((c: any, idx: number) => {
    const themes: RichClasse['couleurTheme'][] = ['emerald', 'sky', 'indigo', 'rose', 'amber'];
    return {
      ...c,
      educateurChef: c.educateurChef || (personnelData[idx % personnelData.length] 
        ? `${personnelData[idx % personnelData.length].prenom} ${personnelData[idx % personnelData.length].nom}` 
        : 'Non assigné'),
      salleNom: c.salleNom || `Salle B-${102 + idx}`,
      couleurTheme: c.couleurTheme || themes[idx % themes.length],
    };
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<RichClasse | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    niveau: 'Bébés' as Classe['niveau'],
    capacite: 12,
    educateurChef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : '',
    salleNom: 'Salle C-201',
    couleurTheme: 'indigo' as 'emerald' | 'sky' | 'indigo' | 'rose' | 'amber'
  });

  const handleAjouter = () => {
    if (!formData.nom || formData.capacite <= 0) return;
    addClasse({ ...formData, crecheId: isDirecteur ? user!.id : undefined } as any);
    setShowModal(false);
    // Reset form
    setFormData({
      nom: '',
      niveau: 'Bébés',
      capacite: 12,
      educateurChef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : '',
      salleNom: 'Salle C-201',
      couleurTheme: 'indigo'
    });
  };

  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'emerald':
        return {
          border: 'border-emerald-100 hover:border-emerald-300',
          bg: 'bg-emerald-500',
          lightBg: 'bg-emerald-50/70',
          text: 'text-emerald-700',
          badge: 'bg-emerald-100/75 text-emerald-800'
        };
      case 'sky':
        return {
          border: 'border-sky-100 hover:border-sky-300',
          bg: 'bg-sky-500',
          lightBg: 'bg-sky-50/70',
          text: 'text-sky-700',
          badge: 'bg-sky-100/75 text-sky-800'
        };
      case 'rose':
        return {
          border: 'border-rose-100 hover:border-rose-300',
          bg: 'bg-rose-500',
          lightBg: 'bg-rose-50/70',
          text: 'text-rose-700',
          badge: 'bg-rose-100/75 text-rose-800'
        };
      case 'amber':
        return {
          border: 'border-amber-100 hover:border-amber-300',
          bg: 'bg-amber-500',
          lightBg: 'bg-amber-50/70',
          text: 'text-amber-700',
          badge: 'bg-amber-100/75 text-amber-800'
        };
      default:
        return {
          border: 'border-indigo-100 hover:border-indigo-300',
          bg: 'bg-indigo-500',
          lightBg: 'bg-indigo-50/70',
          text: 'text-indigo-700',
          badge: 'bg-indigo-100/75 text-indigo-800'
        };
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <School className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('classes')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'تسيير وتنيظم الأقسام والمجموعات العمرية، سعة استيعاب القاعات والمعلمين المشرفين' 
              : 'Supervisez les salles de classe, les tranches d\'âges d\'apprentissage, le maître référent et les ratios.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('classes.add')}</span>
        </button>
      </div>

      {/* Cards Bento Grid list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-slide-up">
        {classes.map((c) => {
          // Dynamic calculation of registered kids
          const kidsCount = enfantsData.filter(
            (e) => e.groupeAge === c.niveau && e.statut === 'Actif'
          ).length;
          
          const colors = getThemeClasses(c.couleurTheme || 'indigo');
          const percentOccupation = Math.min(Math.round((kidsCount / c.capacite) * 100), 100);

          return (
            <div 
              key={c.id} 
              className={`bg-white rounded-2xl border ${colors.border} p-4 sm:p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer`}
              onClick={() => setSelectedClasse(c)}
            >
              <div>
                {/* Header card items */}
                <div className="flex justify-between items-start mb-5">
                  <div className={`p-3 rounded-2xl ${colors.lightBg} ${colors.text}`}>
                    <School className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${colors.badge}`}>
                      {c.niveau}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      {c.salleNom}
                    </span>
                  </div>
                </div>

                {/* Class identity details */}
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{c.nom}</h3>
                
                {/* Educator ref */}
                <div className="mt-3 flex items-center gap-2 p-2 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    EP
                  </div>
                  <div className="text-xs">
                    <p className="text-slate-400 font-bold leading-none">{isArabic ? 'المشرف التربوي' : 'Maître Référent'}</p>
                    <p className="text-slate-800 font-extrabold mt-1">{c.educateurChef}</p>
                  </div>
                </div>

                {/* Dynamic occupancy gauge bar */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>{isArabic ? 'معدل شغل المكان' : 'Occupation de la salle'}</span>
                    <span className="text-slate-800">{kidsCount} / {c.capacite} {isArabic ? 'طفل' : 'places'}</span>
                  </div>
                  <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`absolute top-0 left-0 h-full ${colors.bg} rounded-full transition-all duration-300`} 
                      style={{ width: `${percentOccupation}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action operations footer split */}
              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end">
                <button 
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    const confirmationMsg = isArabic 
                      ? 'هل أنت متأكد من حذف هذا القسم؟ سيؤدي ذلك إلى إلغاء ربطه من الأطفال المسجلين.' 
                      : 'Êtes-vous sûr de vouloir supprimer cette classe ? Cela déliera les enfants inscrits.';
                    if (window.confirm(confirmationMsg)) {
                      deleteClasse(c.id);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exquisite Class Modal ("PLEINE DE FORMATION") */}
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
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'إنشاء قسم تربوي وتفاصيل الغرف' : 'Nouveau Groupe Pédagogique'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'أدخل اسم الغرفة، السعة والترميز الملون' : 'Déclaration de salle, encadrement référent & couleur'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'اسم القسم المختار *' : 'Nom du Groupe Scolaire *'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Les Petites Abeilles"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.nom} 
                    onChange={e => setFormData({...formData, nom: e.target.value})} 
                  />
                </div>

                {/* Level Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'المستوى العمري المستهدف *' : 'Tranche d\'âge / Niveau *'}
                  </label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.niveau} 
                    onChange={e => setFormData({...formData, niveau: e.target.value as Classe['niveau']})}
                  >
                    <option value="Bébés">Bébés (0-2 ans)</option>
                    <option value="Moyens">Moyens (2-4 ans)</option>
                    <option value="Grands">Grands (4-6 ans)</option>
                  </select>
                </div>

                {/* Capacity & Classroom Number (Row 2) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'السعة القصوى *' : 'Seuil Capacité *'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="15"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.capacite || ''} 
                      onChange={e => setFormData({...formData, capacite: parseInt(e.target.value)})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'اسم القاعة *' : 'Numéro de Table/Salle *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Salle B-102"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.salleNom} 
                      onChange={e => setFormData({...formData, salleNom: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Chief Educator Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'المشرف التربوي المسؤول *' : 'Responsable / Enseignant Principal *'}
                  </label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                    value={formData.educateurChef}
                    onChange={e => setFormData({...formData, educateurChef: e.target.value})}
                  >
                    {personnelData.map(p => (
                      <option key={p.id} value={`${p.prenom} ${p.nom}`}>
                        {p.prenom} {p.nom} ({p.poste})
                      </option>
                    ))}
                    <option value="Non affecté">Laisser non affecté</option>
                  </select>
                </div>

                {/* Theme palette picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'اللون المميز للقسم (الجمالية)' : 'Aura / Palette couleur'}
                  </label>
                  <div className="flex gap-3">
                    {[
                      { hex: 'emerald', bg: 'bg-emerald-500' },
                      { hex: 'sky', bg: 'bg-sky-500' },
                      { hex: 'indigo', bg: 'bg-indigo-500' },
                      { hex: 'rose', bg: 'bg-rose-500' },
                      { hex: 'amber', bg: 'bg-amber-500' }
                    ].map(col => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setFormData({...formData, couleurTheme: col.hex as any})}
                        className={`w-8 h-8 rounded-full cursor-pointer transition flex items-center justify-center ${col.bg} ${
                          formData.couleurTheme === col.hex ? 'ring-4 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-85'
                        }`}
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* Actions */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/55">
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

      {/* Detailed Class Info Modal */}
      <AnimatePresence>
        {selectedClasse && (() => {
          const kidsList = enfantsData.filter(e => e.groupeAge === selectedClasse.niveau && e.statut === 'Actif');
          const colors = getThemeClasses(selectedClasse.couleurTheme || 'indigo');
          return (
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
              onClick={() => setSelectedClasse(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-black">{selectedClasse.nom}</h3>
                    <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'معلومات القسم والتلاميذ المسجلين' : 'Détails du groupe & Effectifs admis'}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedClasse(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'المستوى عمري' : 'Niveau / Section'}</span>
                      <span className="text-sm font-black text-slate-800">{selectedClasse.niveau}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'رقم القاعة' : 'Salle assignée'}</span>
                      <span className="text-sm font-black text-slate-800">{selectedClasse.salleNom}</span>
                    </div>
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'المعلم المشرف' : 'Enseignant principal'}</span>
                      <span className="text-sm font-black text-indigo-600">{selectedClasse.educateurChef}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1.5">
                      <span>Remplissage de la salle:</span>
                      <span className="text-slate-850 font-extrabold">{kidsList.length} / {selectedClasse.capacite} places</span>
                    </div>
                    <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full ${colors.bg} rounded-full`}
                        style={{ width: `${Math.min(100, Math.round((kidsList.length / selectedClasse.capacite) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{isArabic ? 'قائمة الأطفال المسجلين في هذا القسم' : 'Liste des enfants inscrits'} ({kidsList.length})</h4>
                    {kidsList.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {kidsList.map(kid => (
                          <div key={kid.id} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl transition text-xs font-semibold">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg text-white font-extrabold flex items-center justify-center text-[10px] ${kid.genre === 'Fille' ? 'bg-pink-500' : 'bg-sky-500'}`}>
                                {kid.prenom[0]}{kid.nom[0]}
                              </div>
                              <span className="text-slate-850">{kid.prenom} {kid.nom}</span>
                            </div>
                            <span className="text-slate-400 text-[10px]">Inscrit: {kid.dateInscription}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">{isArabic ? 'لا يوجد أطفال مسجلون حالياً' : 'Aucun enfant enregistré dans cette tranche d\'âge'}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
