import { useRef, useState } from 'react';
import { documentedText, mealAppliesOnDate } from '../utils/mealSafety';
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
  HelpCircle,
  Edit3
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
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

const WEEKDAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

export default function RepasPage() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { confirm } = useConfirmDialog();
  const toast = useToast();
  const { hasPagePermission } = useWorkspaceProfile();
  const canManageMeals = hasPagePermission('repas', 'manage');
  const unknown = isArabic ? 'غير مسجل — يجب التحقق' : 'Non renseigné — à vérifier';
  const displayAllergens = (value?: string) => documentedText(value) || unknown;
  const displayHydration = (value?: string) => documentedText(value) || unknown;

  const { repas: allDbRepas, personnel: allPersonnelData, addRepas, updateRepas, deleteRepas } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  
  const dbRepas = isDirecteur ? allDbRepas.filter((r: any) => !r.crecheId || r.crecheId === user!.id) : allDbRepas;
  const personnelData = isDirecteur ? allPersonnelData.filter((p: any) => !p.crecheId || p.crecheId === user!.id) : allPersonnelData;

  // Récupérer le personnel de cuisine
  const cuisiniers = personnelData.filter((p: any) => (p.poste || '').toLowerCase().includes('cuisini') || (p.poste || '').toLowerCase().includes('intendance'));

  const repas: RichRepas[] = dbRepas.map((r) => {
    return {
      ...r,
      jour: r.jour || r.date,
    };
  });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayWeekday = WEEKDAYS_FR[now.getDay()] || 'Dimanche';
  const todayMeals = repas.filter(r => mealAppliesOnDate(r, today));

  const [showModal, setShowModal] = useState(false);
  const [editingRepasId, setEditingRepasId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveUncertain, setSaveUncertain] = useState(false);
  const savingRef = useRef(false);
  const [selectedRepas, setSelectedRepas] = useState<any | null>(null);
  const [filterType, setFilterType] = useState('Tous');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'today'>('all');

  const emptyMealForm = (jour = 'Dimanche') => ({
    type: 'Déjeuner' as 'Petit-déjeuner' | 'Déjeuner' | 'Goûter',
    jour,
    menu: '',
    allergenes: '',
    apportCalorique: '',
    chefCuisine: '',
    bioIngrediens: false,
    hydratationRappel: ''
  });

  const [formData, setFormData] = useState(emptyMealForm('Dimanche'));

  const openCreateModal = (presetJour = 'Dimanche') => {
    setEditingRepasId(null);
    setFormData(emptyMealForm(presetJour));
    setFormError('');
    setSaveUncertain(false);
    setShowModal(true);
  };

  const openEditModal = (r: RichRepas) => {
    setSelectedRepas(null);
    setEditingRepasId(r.id);
    setFormData({
      type: ((r.type as any) || 'Déjeuner') as 'Petit-déjeuner' | 'Déjeuner' | 'Goûter',
      jour: r.jour || todayWeekday,
      menu: r.menu || '',
      allergenes: documentedText(r.allergenes) || '',
      apportCalorique: documentedText(r.apportCalorique) || '',
      chefCuisine: documentedText(r.chefCuisine) || '',
      bioIngrediens: Boolean(r.bioIngrediens),
      hydratationRappel: documentedText(r.hydratationRappel) || '',
    });
    setFormError('');
    setSaveUncertain(false);
    setShowModal(true);
  };

  const handleAjouter = async () => {
    if (savingRef.current || saveUncertain) return;
    if (!formData.menu.trim() || !formData.jour) { setFormError(isArabic ? 'اليوم ووصف الوجبة مطلوبان.' : 'Le jour et le menu sont obligatoires.'); return; }
    setFormError('');
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        date: undefined,
        menu: formData.menu.trim(),
        allergenes: documentedText(formData.allergenes),
        apportCalorique: documentedText(formData.apportCalorique),
        chefCuisine: documentedText(formData.chefCuisine),
        hydratationRappel: documentedText(formData.hydratationRappel),
      };
      if (editingRepasId) {
        await updateRepas(editingRepasId, payload as any);
        toast.success(isArabic ? 'تم تحديث الوجبة بنجاح' : 'Repas mis à jour');
      } else {
        await addRepas({ ...payload, crecheId: isDirecteur ? user!.id : undefined } as any);
      }
      setEditingRepasId(null);
      setShowModal(false);
      setFormData(emptyMealForm('Dimanche'));
    } catch {
      setSaveUncertain(true);
      setFormError(isArabic ? 'لم يتأكد الحفظ. أغلق النافذة وتحقق من القائمة قبل المحاولة مجدداً.' : 'Enregistrement non confirmé. Fermez la fenêtre et vérifiez les menus avant de réessayer.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const filteredRepas = repas.filter(r => {
    const matchesScope = scopeFilter === 'today' ? mealAppliesOnDate(r, today) : true;
    const matchesType = filterType === 'Tous' || r.type === filterType;
    return matchesScope && matchesType;
  });

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* Header and Actions sur 1 ligne nette */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
            {t('meals')}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5 font-medium">
            {repas.length} {isArabic ? 'وجبات مبرمجة' : 'fiche(s) repas programmée(s)'} · {todayMeals.length} {isArabic ? 'اليوم' : 'repas du jour'}
          </p>
        </div>
        {canManageMeals && (
          <button
            className="min-h-9! shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            onClick={() => openCreateModal('Dimanche')}
          >
            <Plus size={15} className="stroke-[2.5] shrink-0" />
            <span>{t('meals.add')}</span>
          </button>
        )}
      </div>

      {/* Encart Repas du jour */}
      <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border border-amber-200/70 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 text-amber-700 inline-flex items-center justify-center">
              <Utensils className="h-4 w-4 shrink-0" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {isArabic ? `وجبات اليوم · ${todayWeekday}` : `Repas du jour · ${todayWeekday}`}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                {todayMeals.length > 0
                  ? (isArabic ? `${todayMeals.length} وجبة مبرمجة اليوم` : `${todayMeals.length} service(s) programmé(s) aujourd’hui`)
                  : (isArabic ? 'لم تتم برمجة وجبة لهذا اليوم بعد' : 'Aucun repas programmé pour aujourd’hui')}
              </p>
            </div>
          </div>
          {canManageMeals && (
            <button
              type="button"
              onClick={() => openCreateModal(todayWeekday)}
              className="min-h-8! shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>{isArabic ? 'وجبة اليوم' : '+ Repas du jour'}</span>
            </button>
          )}
        </div>

        {todayMeals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {todayMeals.map((tm) => (
              <div
                key={`today-${tm.id}`}
                onClick={() => (canManageMeals ? openEditModal(tm) : setSelectedRepas(tm))}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-200/70 bg-white px-3 py-2 shadow-2xs hover:border-amber-300 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-100 mb-0.5">
                    {tm.type === 'Petit-déjeuner'
                      ? (isArabic ? 'فطور الصباح' : 'Petit-déjeuner')
                      : tm.type === 'Déjeuner'
                      ? (isArabic ? 'الغداء' : 'Déjeuner')
                      : (isArabic ? 'اللمجة' : 'Goûter')}
                  </span>
                  <p className="text-xs font-bold text-slate-800 truncate">{tm.menu}</p>
                </div>
                {canManageMeals && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(tm);
                    }}
                    className="min-h-8! h-8 px-2.5 shrink-0 inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold transition cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 shrink-0" />
                    <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Row */}
      <div className="bg-white p-2 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl bg-slate-100/90 p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`min-h-8! px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg whitespace-nowrap transition cursor-pointer truncate ${
              scopeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isArabic ? `الأسبوع (${repas.length})` : `Toute la semaine (${repas.length})`}
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('today')}
            className={`min-h-8! px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg whitespace-nowrap transition cursor-pointer truncate ${
              scopeFilter === 'today' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isArabic ? `اليوم (${todayMeals.length})` : `Repas du jour (${todayMeals.length})`}
          </button>
        </div>
        <div className="grid grid-cols-4 sm:flex gap-1 w-full sm:w-auto rounded-xl bg-slate-100/90 p-1 sm:bg-transparent sm:p-0">
          {['Tous', 'Petit-déjeuner', 'Déjeuner', 'Goûter'].map(tType => (
            <button
              key={tType}
              type="button"
              onClick={() => setFilterType(tType)}
              className={`min-h-8! px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl whitespace-nowrap transition cursor-pointer text-center truncate ${
                filterType === tType
                  ? 'bg-white sm:bg-indigo-600 text-slate-900 sm:text-white shadow-2xs'
                  : 'text-slate-600 sm:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tType === 'Tous'
                ? (isArabic ? 'الكل' : 'Tous')
                : tType === 'Petit-déjeuner'
                ? (isArabic ? 'الفطور' : 'Petit-déj.')
                : tType === 'Déjeuner'
                ? (isArabic ? 'الغداء' : 'Déjeuner')
                : (isArabic ? 'اللمجة' : 'Goûter')}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-900">
        <p className="truncate sm:whitespace-normal">
          {isArabic ? 'تحقق يدوياً من المكونات ومن حساسية كل طفل قبل التقديم.' : 'Vérifiez manuellement les ingrédients et les allergies de chaque enfant avant le service.'}
        </p>
      </div>

      {/* Meals Menu Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {filteredRepas.length > 0 ? (
          filteredRepas.map((r) => {
            return (
              <div 
                key={r.id} 
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-200 transition flex flex-col justify-between gap-3 cursor-pointer"
                onClick={() => (canManageMeals ? openEditModal(r) : setSelectedRepas(r))}
              >
                <div className="space-y-2.5">
                  {/* Card Badge Type row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${
                      r.type === 'Déjeuner' 
                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                        : r.type === 'Petit-déjeuner'
                        ? 'bg-sky-50 text-sky-700 border-sky-100'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {r.type === 'Déjeuner'
                        ? (isArabic ? 'وجبة الغداء' : 'Déjeuner')
                        : r.type === 'Petit-déjeuner'
                        ? (isArabic ? 'فطور الصباح' : 'Petit-déjeuner')
                        : (isArabic ? 'لمجة / فطور العصر' : 'Goûter')}
                    </span>
                    <span className="truncate text-[10.5px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-bold uppercase tracking-wider inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 shrink-0" />
                      {r.jour === 'Dimanche' && (isArabic ? 'كل أحد' : 'Chaque dimanche')}
                      {r.jour === 'Lundi' && (isArabic ? 'كل إثنين' : 'Chaque lundi')}
                      {r.jour === 'Mardi' && (isArabic ? 'كل ثلاثاء' : 'Chaque mardi')}
                      {r.jour === 'Mercredi' && (isArabic ? 'كل أربعاء' : 'Chaque mercredi')}
                      {r.jour === 'Jeudi' && (isArabic ? 'كل خميس' : 'Chaque jeudi')}
                      {r.jour === 'Vendredi' && (isArabic ? 'كل جمعة' : 'Chaque vendredi')}
                      {r.jour === 'Samedi' && (isArabic ? 'كل سبت' : 'Chaque samedi')}
                      {!['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].includes(r.jour || '') && (r.jour || unknown)}
                    </span>
                  </div>

                  {/* Core Food Menu Description — net, concis (max 2 lignes) */}
                  <p className="text-slate-900 font-bold text-sm leading-snug line-clamp-2 flex items-start gap-2">
                    <Apple className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{r.menu}</span>
                  </p>

                  {/* Allergenes & Nutrition sur 2 colonnes compactes */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span className="truncate">{isArabic ? 'الحساسية: ' : 'Allergènes : '}<strong className="font-semibold text-slate-700">{displayAllergens(r.allergenes)}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <Flame className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <span className="truncate">{isArabic ? 'السعرات: ' : 'Calories : '}<strong className="font-semibold text-slate-700">{documentedText(r.apportCalorique) || unknown}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                      <Droplet className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                      <span className="truncate">{isArabic ? 'المشروب: ' : 'Boisson : '}<strong className="font-semibold text-slate-700">{displayHydration(r.hydratationRappel)}</strong></span>
                    </div>
                  </div>

                </div>

                {/* Footer sur 1 seule ligne */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChefHat className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate"><strong className="text-slate-700">{documentedText(r.chefCuisine) || unknown}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {r.bioIngrediens && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[10px] uppercase font-bold tracking-wider flex items-center gap-0.5">
                        <Leaf className="w-3 h-3 shrink-0" />
                        BIO
                      </span>
                    )}
                    {canManageMeals && (
                      <>
                        <button
                          type="button"
                          aria-label={isArabic ? 'تعديل الوجبة' : 'Modifier le repas'}
                          className="min-h-8! h-8 px-2.5 shrink-0 inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-xs font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap transition cursor-pointer"
                          onClick={() => openEditModal(r)}
                        >
                          <Edit3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={isArabic ? 'حذف الوجبة' : 'Supprimer le repas'}
                          className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: isArabic ? 'تأكيد حذف الوجبة' : 'Confirmer la suppression du repas',
                              message: isArabic
                                ? 'سيتم حذف هذه الوجبة المبرمجة نهائياً.'
                                : 'Ce repas planifié sera supprimé définitivement.',
                              confirmLabel: isArabic ? 'حذف الوجبة' : 'Supprimer le repas',
                              variant: 'danger',
                            });
                            if (confirmed) await deleteRepas(r.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      </>
                    )}
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
            onClick={() => { if (!saving) setShowModal(false); }}
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
                  <h3 className="text-lg sm:text-xl font-black">
                    {editingRepasId
                      ? (isArabic ? 'تعديل الوجبة المبرمجة' : 'Modifier le repas')
                      : (isArabic ? 'تخطيط وجبة غذائية أسبوعية' : 'Planificateur Hebdomadaire')}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تحديد اليوم، الوجبة، ومسؤول التحضير' : 'Attribuez ce menu à un jour spécifique de la semaine'}</p>
                </div>
                <button 
                  disabled={saving}
                  onClick={() => { setEditingRepasId(null); setShowModal(false); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
              <fieldset disabled={saving} className="min-w-0 p-4 sm:p-6 space-y-4">
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
                    <option value="Petit-déjeuner">{isArabic ? 'فطور الصباح' : 'Petit-déjeuner (Matin)'}</option>
                    <option value="Déjeuner">{isArabic ? 'الغداء' : 'Déjeuner (Midi)'}</option>
                    <option value="Goûter">{isArabic ? 'وجبة خفيفة' : 'Goûter (Après-midi)'}</option>
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
                    <option value="Dimanche">{isArabic ? 'كل أحد' : 'Tous les Dimanches (كل أحد)'}</option>
                    <option value="Lundi">{isArabic ? 'كل إثنين' : 'Tous les Lundis (كل إثنين)'}</option>
                    <option value="Mardi">{isArabic ? 'كل ثلاثاء' : 'Tous les Mardis (كل ثلاثاء)'}</option>
                    <option value="Mercredi">{isArabic ? 'كل أربعاء' : 'Tous les Mercredis (كل أربعاء)'}</option>
                    <option value="Jeudi">{isArabic ? 'كل خميس' : 'Tous les Jeudis (كل خميس)'}</option>
                    <option value="Vendredi">{isArabic ? 'كل جمعة' : 'Tous les vendredis'}</option>
                    <option value="Samedi">{isArabic ? 'كل سبت' : 'Tous les samedis'}</option>
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
                      {isArabic ? 'الشيف / المسؤول' : 'Chef de cuisine'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.chefCuisine}
                      onChange={e => setFormData({...formData, chefCuisine: e.target.value})}
                    >
                      <option value="">{isArabic ? 'غير مسجل' : 'Non renseigné'}</option>
                      {cuisiniers.length > 0 ? (
                        cuisiniers.map((c: any) => (
                          <option key={c.id} value={`${c.prenom} ${c.nom}`}>{c.prenom} {c.nom}</option>
                        ))
                      ) : null}
                      <option value="Traiteur Externe">{isArabic ? 'مموّن خارجي' : 'Traiteur Externe / Catering'}</option>
                      <option value="Autre">{isArabic ? 'آخر' : 'Autre'}</option>
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

              </fieldset>
              </div>

              {formError && <p role="alert" className="mx-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{formError}</p>}
              {/* Buttons */}
              <div className="p-4 sm:p-6 sm:pt-4 border-t border-slate-100 flex flex-col gap-3 flex-shrink-0 bg-slate-50/50 sm:flex-row">
                <button 
                  type="button"
                  className="w-full sm:flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="w-full sm:flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  disabled={saving || saveUncertain}
                  onClick={() => void handleAjouter()}
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
                  <p className="text-xs text-amber-50 mt-0.5">{isArabic ? 'تفاصيل الوجبة المسجلة' : 'Informations saisies sur le repas'}</p>
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
                      {!['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'].includes(selectedRepas.jour || '') && (selectedRepas.jour || unknown)}
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
                      <span className="text-xs font-extrabold text-slate-800">{documentedText(selectedRepas.apportCalorique) || unknown}</span>
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
                      <span className="text-xs font-extrabold text-slate-800">{documentedText(selectedRepas.chefCuisine) || unknown}</span>
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
