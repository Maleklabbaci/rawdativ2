import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  Utensils, 
  CalendarDays, 
  ShieldAlert, 
  Leaf, 
  ChefHat, 
  Flame, 
  Droplet, 
  Apple,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Repas } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichRepas extends Repas {
  jour?: string;
  allergenes?: string;
  apportCalorique?: string;
  chefCuisine?: string;
  bioIngrediens?: boolean;
  hydratationRappel?: string;
}

export default function RepasPage() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const displayAllergens = (value?: string) => isArabic && (value === 'Aucun allergène' || value === 'Aucun allergène majeur') ? 'لا توجد حساسية رئيسية' : value;
  const displayHydration = (value?: string) => isArabic && (value === 'Eau filtrée' || value === 'Eau minérale') ? 'ماء مفلتر' : value;

  const { repas: allDbRepas, personnel: allPersonnelData, addRepas, deleteRepas } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  
  const dbRepas = isDirecteur ? allDbRepas.filter((r: any) => r.crecheId === user!.id) : allDbRepas;
  const personnelData = isDirecteur ? allPersonnelData.filter((p: any) => p.crecheId === user!.id) : allPersonnelData;

  // Récupérer le personnel de cuisine
  const cuisiniers = personnelData.filter((p: any) => p.poste.toLowerCase().includes('cuisini'));
  const defaultChef = cuisiniers.length > 0 ? `${cuisiniers[0].prenom} ${cuisiniers[0].nom}` : 'Traiteur Externe';

  const repas: RichRepas[] = dbRepas.map((r: any, idx: number) => {
    return {
      ...r,
      jour: r.jour || r.date || 'Dimanche', // Rétrocompatibilité si d'anciens repas ont une "date"
      allergenes: r.allergenes || 'Aucun allergène majeur',
      apportCalorique: r.apportCalorique || '350 kcal',
      chefCuisine: r.chefCuisine || defaultChef,
      bioIngrediens: r.bioIngrediens !== undefined ? r.bioIngrediens : false,
      hydratationRappel: r.hydratationRappel || 'Eau minérale',
    };
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedRepas, setSelectedRepas] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('Tous');

  const [formData, setFormData] = useState({
    type: 'Déjeuner' as 'Déjeuner' | 'Goûter',
    jour: 'Dimanche',
    menu: '',
    allergenes: 'Aucun allergène',
    apportCalorique: '350 kcal',
    chefCuisine: defaultChef,
    bioIngrediens: true,
    hydratationRappel: 'Eau filtrée'
  });

  const handleAjouter = () => {
    if (!formData.menu || !formData.jour) return;
    addRepas({ ...formData, crecheId: isDirecteur ? user!.id : undefined } as any);
    setShowModal(false);
    setFormData({
      type: 'Déjeuner',
      jour: 'Dimanche',
      menu: '',
      allergenes: 'Aucun allergène',
      apportCalorique: '350 kcal',
      chefCuisine: defaultChef,
      bioIngrediens: true,
      hydratationRappel: 'Eau filtrée'
    });
  };

  const filteredRepas = repas.filter(r => {
    return filterType === 'Tous' || r.type === filterType;
  });

  return (
    <div className="space-y-4 sm:space-y-8 font-sans">
      {/* Nutri Stats Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الوجبات المبرمجة' : 'Menu de la semaine'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{repas.length} {isArabic ? 'وجبات مبرمجة' : 'fiches repas programmées'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Leaf className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الوجبات العضوية المضمونة' : 'Garantie Biologique'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{repas.filter(r => r.bioIngrediens).length} {isArabic ? 'قوائم عضوية' : 'menus 100% Bio'}</p>
          </div>
        </div>
      </div>

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Utensils className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('meals')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'برمجة الوجبات الأسبوعية الدورية، متابعة الحساسية والمكونات العضوية لكل يوم' 
              : 'Configurez le programme hebdomadaire récurrent des repas et goûters pour chaque jour de la semaine.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('meals.add')}</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <span className="text-xs sm:text-sm font-extrabold text-slate-500">{isArabic ? 'فلترة حسب نوع الوجبة:' : 'Filtrer les fiches:'}</span>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none flex-nowrap">
          {['Tous', 'Déjeuner', 'Goûter'].map(tType => (
            <button
              key={tType}
              onClick={() => setFilterType(tType)}
              className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
                filterType === tType
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              {tType === 'Tous' ? (isArabic ? 'الكل' : 'Tous') : tType === 'Déjeuner' ? (isArabic ? 'الغداء' : 'Déjeuner') : (isArabic ? 'اللمجة' : 'Goûter')}
            </button>
          ))}
        </div>
      </div>

      {/* Meals Menu Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
        {filteredRepas.length > 0 ? (
          filteredRepas.map((r) => {
            return (
              <div 
                key={r.id} 
                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg transition flex flex-col justify-between cursor-pointer"
                onClick={() => setSelectedRepas(r)}
              >
                <div>
                  {/* Card Badge Type row */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      r.type === 'Déjeuner' 
                        ? 'bg-amber-50 text-amber-700 border-amber-100' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {r.type === 'Déjeuner' ? (isArabic ? 'وجبة الغداء' : 'Déjeuner') : (isArabic ? 'لمجة / فطور العصر' : 'Goûter')}
                    </span>
                    <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-black uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {r.jour === 'Dimanche' && (isArabic ? 'كل أحد' : 'Chaque dimanche')}
                      {r.jour === 'Lundi' && (isArabic ? 'كل إثنين' : 'Chaque lundi')}
                      {r.jour === 'Mardi' && (isArabic ? 'كل ثلاثاء' : 'Chaque mardi')}
                      {r.jour === 'Mercredi' && (isArabic ? 'كل أربعاء' : 'Chaque mercredi')}
                      {r.jour === 'Jeudi' && (isArabic ? 'كل خميس' : 'Chaque jeudi')}
                      {!['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'].includes(r.jour || '') && r.jour}
                    </span>
                  </div>

                  {/* Core Food Menu Description */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 mb-4">
                    <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">{isArabic ? 'قائمة المأكولات المقدمة' : 'Assiette servie'}</p>
                    <p className="text-slate-900 font-black text-base leading-relaxed flex items-start gap-2">
                      <Apple className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <span>{r.menu}</span>
                    </p>
                  </div>

                  {/* Allergenes warnings */}
                  <div className="grid grid-cols-1 gap-2.5 text-xs font-semibold text-slate-500 pt-2 sm:grid-cols-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 p-1">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <span>{isArabic ? 'الحساسية: ' : 'Allergènes : '}<strong className="text-slate-700">{displayAllergens(r.allergenes)}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 p-1">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>{isArabic ? 'السعرات: ' : 'Calories : '}<strong className="text-slate-700">{r.apportCalorique}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 col-span-2">
                      <Droplet className="w-4 h-4 text-sky-500" />
                      <span>{isArabic ? 'المشروب: ' : 'Boisson : '}<strong className="text-slate-700">{displayHydration(r.hydratationRappel)}</strong></span>
                    </div>
                  </div>

                </div>

                {/* Footer and chef attribution */}
                <div className="mt-5 pt-4 border-t border-slate-50 flex flex-col gap-3 text-[11px] font-bold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5">
                    <ChefHat className="w-4 h-4 text-indigo-500" />
                    <span>{isArabic ? 'الطاهي: ' : 'Cuisiné par : '}<strong className="text-slate-700 truncate max-w-[120px] inline-block">{r.chefCuisine}</strong></span>
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    {r.bioIngrediens && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[10px] uppercase font-black tracking-widest flex items-center gap-0.5">
                        <Leaf className="w-3 h-3" />
                        BIO
                      </span>
                    )}
                    <button 
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        const confirmationMsg = isArabic
                          ? 'هل أنت متأكد من حذف هذه الوجبة المبرمجة؟'
                          : 'Êtes-vous sûr de vouloir supprimer ce repas planifié ?';
                        if (window.confirm(confirmationMsg)) {
                          deleteRepas(r.id);
                        }
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      <span>{isArabic ? 'حذف' : 'Supprimer'}</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد وجبات مسجلة' : 'Aucun menu édité'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'أضف وجبة طعام صحية جديدة للبدء.' : 'Écrivez votre premier menu hebdomadaire équilibré.'}</p>
          </div>
        )}
      </div>

      {/* Modal Ajout */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg sm:text-xl font-black">{isArabic ? 'تخطيط وجبة غذائية أسبوعية' : 'Plannificateur Hebdomadaire'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تحديد اليوم، الوجبة، ومسؤول التحضير' : 'Attribuez ce menu à un jour spécifique de la semaine'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'صنف الوجبة *' : 'Type de Repas / Service *'}
                  </label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition text-sm font-semibold text-slate-800" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="Déjeuner">Déjeuner (Midi)</option>
                    <option value="Goûter">Goûter (Après-midi)</option>
                  </select>
                </div>

                {/* Jour de la semaine au lieu de date */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-indigo-500" />
                    {isArabic ? 'اليوم المخصص (أسبوعياً) *' : 'Jour de la semaine de distribution *'}
                  </label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                    value={formData.jour}
                    onChange={e => setFormData({...formData, jour: e.target.value})}
                  >
                    <option value="Dimanche">Tous les Dimanches (كل أحد)</option>
                    <option value="Lundi">Tous les Lundis (كل إثنين)</option>
                    <option value="Mardi">Tous les Mardis (كل ثلاثاء)</option>
                    <option value="Mercredi">Tous les Mercredis (كل أربعاء)</option>
                    <option value="Jeudi">Tous les Jeudis (كل خميس)</option>
                  </select>
                </div>

                {/* Menu Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'قائمة الطعام بالتفاصيل *' : 'Détail de l\'Assiette / Menu *'}
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Purée veloutée de potiron bio aux pépites de poulet, petit suisse..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition text-sm font-semibold text-slate-800 resize-none" 
                    value={formData.menu} 
                    onChange={e => setFormData({...formData, menu: e.target.value})} 
                  />
                </div>

                {/* Allergen Warning & Calories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'التحذير من الحساسية' : 'Allergènes (Gluten, Arachides)'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Traces de lactose"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.allergenes} 
                      onChange={e => setFormData({...formData, allergenes: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'القيمة الطاقوية (سعرات)' : 'Apport Énergétique (kcal)'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: 380 kcal"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.apportCalorique} 
                      onChange={e => setFormData({...formData, apportCalorique: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Hydratation info and Cook Chef */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'المشروبات المرفقة' : 'Rappel hydrique (Boisson)'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={isArabic ? 'مثال: ماء مفلتر' : 'Ex: Eau filtrée'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.hydratationRappel} 
                      onChange={e => setFormData({...formData, hydratationRappel: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <ChefHat className="w-3.5 h-3.5" />
                      {isArabic ? 'الشيف / المسؤول *' : 'Chef de Cuisine *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.chefCuisine}
                      onChange={e => setFormData({...formData, chefCuisine: e.target.value})}
                    >
                      {cuisiniers.length > 0 ? (
                        cuisiniers.map((c: any) => (
                          <option key={c.id} value={`${c.prenom} ${c.nom}`}>{c.prenom} {c.nom}</option>
                        ))
                      ) : null}
                      <option value="Traiteur Externe">Traiteur Externe / Catering</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>

                {/* Organic Ingredient Checkbox */}
                <div className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <input 
                    type="checkbox" 
                    id="bioIngrediens" 
                    className="w-4.5 h-4.5 text-emerald-600 bg-white border-emerald-200 rounded-md focus:ring-emerald-500"
                    checked={formData.bioIngrediens} 
                    onChange={e => setFormData({...formData, bioIngrediens: e.target.checked})} 
                  />
                  <label htmlFor="bioIngrediens" className="text-xs font-black text-emerald-800 cursor-pointer select-none flex items-center gap-1">
                    <Leaf className="w-3.5 h-3.5" />
                    {isArabic ? 'يحتوي على مواد ومكونات عضوية 100% طبيعية' : 'Repas composé d\'ingrédients d\'agriculture biologique'}
                  </label>
                </div>

              </div>

              {/* Buttons */}
              <div className="p-4 sm:p-6 sm:pt-4 border-t border-slate-100 flex flex-col gap-3 flex-shrink-0 bg-slate-50/50 sm:flex-row">
                <button 
                  type="button"
                  className="w-full sm:flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="w-full sm:flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repas Details Info View Modal */}
      <AnimatePresence>
        {selectedRepas && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setSelectedRepas(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg sm:text-xl font-black">
                    {selectedRepas.type === 'Déjeuner' ? (isArabic ? 'وجبة الغداء' : 'Déjeuner Référence') : (isArabic ? 'لمجة العصر' : 'Goûter Équilibré')}
                  </h3>
                  <p className="text-xs text-amber-50 mt-0.5">{isArabic ? 'العناصر الغذائية، السعرات الحرارية ومذكرة الطهو' : 'Certifications nutritionnelles & Fiche de Restauration'}</p>
                </div>
                <button 
                  onClick={() => setSelectedRepas(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    <span>{isArabic ? 'الطبق الرئيسي المجدول' : 'Menu Principal du Jour'}</span>
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {selectedRepas.jour === 'Dimanche' && (isArabic ? 'كل أحد' : 'Chaque dimanche')}
                      {selectedRepas.jour === 'Lundi' && (isArabic ? 'كل إثنين' : 'Chaque lundi')}
                      {selectedRepas.jour === 'Mardi' && (isArabic ? 'كل ثلاثاء' : 'Chaque mardi')}
                      {selectedRepas.jour === 'Mercredi' && (isArabic ? 'كل أربعاء' : 'Chaque mercredi')}
                      {selectedRepas.jour === 'Jeudi' && (isArabic ? 'كل خميس' : 'Chaque jeudi')}
                      {!['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'].includes(selectedRepas.jour || '') && selectedRepas.jour}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-sm font-black text-slate-800 leading-relaxed">
                    <Apple className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{selectedRepas.menu}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'السعرات الحرارية' : 'Calories (Est.)'}</span>
                      <span className="text-xs font-extrabold text-slate-800">{selectedRepas.apportCalorique}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-sky-500" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'المشروب المرافق' : 'Hydratation'}</span>
                      <span className="text-xs font-extrabold text-slate-800">{displayHydration(selectedRepas.hydratationRappel)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <div>
                    <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider block">{isArabic ? 'تنبيه الحساسية الغذائية' : 'Alerte Allergènes'}</span>
                    <span className="text-xs font-black text-rose-800">{displayAllergens(selectedRepas.allergenes)}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-slate-500" />
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'طاهي الوجبة' : 'Préparé par'}</span>
                      <span className="text-xs font-extrabold text-slate-800">{selectedRepas.chefCuisine}</span>
                    </div>
                  </div>
                  {selectedRepas.bioIngrediens && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5" />
                      100% Bio
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
