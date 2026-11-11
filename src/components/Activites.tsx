import { useRef, useState } from 'react';
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
  Compass,
  Edit3
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
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
  const { confirm } = useConfirmDialog();
  const toast = useToast();
  const { hasPagePermission } = useWorkspaceProfile();
  const canManageActivites = hasPagePermission('activites', 'manage');

  const { activites: allDbActivites, personnel: personnelData, addActivite, updateActivite, deleteActivite } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbActivites = isDirecteur ? allDbActivites.filter((a: any) => !a.crecheId || a.crecheId === user!.id) : allDbActivites;

  // Missing fields remain unknown; never synthesize a teacher, time or location.
  const activites: RichActivite[] = dbActivites;
  const personnel = isDirecteur ? personnelData.filter((p: any) => !p.crecheId || p.crecheId === user!.id) : personnelData;
  const unknown = isArabic ? 'غير محدد' : 'Non renseigné';
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const today = localDate();
  const todayActivities = activites.filter(a => a.date === today);

  const [showModal, setShowModal] = useState(false);
  const [editingActiviteId, setEditingActiviteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const [selectedActivite, setSelectedActivite] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'today'>('all');

  const emptyActivityForm = (presetDate = localDate()) => ({
    titre: '',
    date: presetDate,
    groupe: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    competenceVisee: '',
    heureDebut: '',
    heureFin: '',
    materielRequis: '',
    lieu: '',
    educateurRef: ''
  });

  const [formData, setFormData] = useState(emptyActivityForm());

  const openCreateModal = (presetDate = localDate()) => {
    setEditingActiviteId(null);
    setFormData(emptyActivityForm(presetDate));
    setSaveError('');
    setShowModal(true);
  };

  const openEditModal = (act: RichActivite) => {
    setSelectedActivite(null);
    setEditingActiviteId(act.id);
    setFormData({
      titre: act.titre || '',
      date: act.date || localDate(),
      groupe: (act.groupe as 'Bébés' | 'Moyens' | 'Grands') || 'Bébés',
      competenceVisee: act.competenceVisee || '',
      heureDebut: act.heureDebut || '',
      heureFin: act.heureFin || '',
      materielRequis: act.materielRequis || '',
      lieu: act.lieu || '',
      educateurRef: act.educateurRef || '',
    });
    setSaveError('');
    setShowModal(true);
  };

  const handleAjouter = async () => {
    if (savingRef.current || saveError.startsWith('Enregistrement non confirmé') || saveError.startsWith('لم يتأكد الحفظ')) return;
    if (!formData.titre.trim() || !formData.date) {
      setSaveError(isArabic ? 'العنوان والتاريخ مطلوبان.' : 'Le titre et la date sont obligatoires.');
      return;
    }
    savingRef.current = true; setSaving(true);
    try {
      if (editingActiviteId) {
        await updateActivite(editingActiviteId, {
          ...formData,
          titre: formData.titre.trim(),
        } as any);
        toast.success(isArabic ? 'تم تحديث النشاط بنجاح' : 'Activité mise à jour');
      } else {
        await addActivite({ ...formData, titre: formData.titre.trim(), crecheId: isDirecteur ? user!.id : undefined } as any);
      }
      setEditingActiviteId(null);
      setShowModal(false);
      setFormData(emptyActivityForm());
    } catch {
      setSaveError(isArabic ? 'لم يتأكد الحفظ. أغلق النافذة وأعد تحميل القائمة وتحقق قبل المحاولة مجدداً.' : 'Enregistrement non confirmé. Fermez la fenêtre, rechargez et vérifiez la liste avant de réessayer.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const filteredActivites = activites.filter(a => {
    if (scopeFilter === 'today' && a.date !== today) return false;
    const term = searchTerm.toLowerCase();
    return (
      (a.titre || '').toLowerCase().includes(term) ||
      a.competenceVisee?.toLowerCase().includes(term) ||
      (a.groupe || '').toLowerCase().includes(term)
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
    <div className="space-y-3.5 sm:space-y-5">
      {/* Header title & add action sur 1 ligne nette */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
            {t('activities')}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 mt-0.5 font-medium">
            {activites.length} {isArabic ? 'حصة نشاط مبرمجة' : 'atelier(s) programmé(s)'} · {todayActivities.length} {isArabic ? 'اليوم' : 'aujourd’hui'}
          </p>
        </div>
        {canManageActivites && (
          <button
            className="min-h-9! shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            onClick={() => openCreateModal(today)}
          >
            <Plus size={15} className="stroke-[2.5] shrink-0" />
            <span>{t('activities.add')}</span>
          </button>
        )}
      </div>

      {/* Encart Activités du jour */}
      <div className="bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/50 border border-teal-200/70 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-xl bg-teal-100 text-teal-700 inline-flex items-center justify-center">
              <Sparkles className="h-4 w-4 shrink-0" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {isArabic ? `أنشطة اليوم · ${today}` : `Activités du jour · ${today}`}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                {todayActivities.length > 0
                  ? (isArabic ? `${todayActivities.length} ورشة تربوية مبرمجة اليوم` : `${todayActivities.length} atelier(s) prévu(s) aujourd’hui`)
                  : (isArabic ? 'لا يوجد نشاط مبرمج لهذا اليوم بعد' : 'Aucun atelier programmé pour aujourd’hui')}
              </p>
            </div>
          </div>
          {canManageActivites && (
            <button
              type="button"
              onClick={() => openCreateModal(today)}
              className="min-h-8! shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>{isArabic ? 'نشاط اليوم' : '+ Atelier du jour'}</span>
            </button>
          )}
        </div>

        {todayActivities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {todayActivities.slice(0, 4).map((ta) => (
              <div
                key={`today-act-${ta.id}`}
                onClick={() => (canManageActivites ? openEditModal(ta) : setSelectedActivite(ta))}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-teal-200/70 bg-white px-3 py-2 shadow-2xs hover:border-teal-300 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${getGroupBadgeStyles(ta.groupe)}`}>
                      {ta.groupe}
                    </span>
                    {(ta.heureDebut || ta.heureFin) && (
                      <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                        {ta.heureDebut || '—'}{ta.heureFin ? ` - ${ta.heureFin}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate">{ta.titre}</p>
                </div>
                {canManageActivites && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(ta);
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

      {/* Search & Scope Filter bar */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl bg-slate-100/90 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={`min-h-8! px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap truncate ${
              scopeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isArabic ? `الكل (${activites.length})` : `Toutes (${activites.length})`}
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('today')}
            className={`min-h-8! px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap truncate ${
              scopeFilter === 'today' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isArabic ? `اليوم (${todayActivities.length})` : `Activités du jour (${todayActivities.length})`}
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن نشاط أو مهارة مستهدفة...' : 'Rechercher un atelier ou une compétence...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-9 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Activities Grid — cartes nettes, compactes, zéro paragraphe */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredActivites.length > 0 ? (
          filteredActivites.map((a) => {
            const grpStyle = getGroupBadgeStyles(a.groupe);
            
          return (
            <div 
              key={a.id} 
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-200 transition flex flex-col justify-between gap-2.5 cursor-pointer"
              onClick={() => (canManageActivites ? openEditModal(a) : setSelectedActivite(a))}
            >
              <div className="space-y-2">
                {/* Card top banner */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 text-[11px] font-bold rounded-lg border ${grpStyle}`}>
                    {a.groupe}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {a.date}
                  </span>
                </div>

                {/* Activity Title */}
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">{a.titre}</h3>

                {/* Target Skill Row */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Target className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate font-semibold text-slate-700">{a.competenceVisee || unknown}</span>
                </div>

                {/* Scheduled slots and Physical Place */}
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 pt-1 text-[11px] font-medium text-slate-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate tabular-nums">{a.heureDebut || '—'} - {a.heureFin || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate"><strong className="text-slate-700">{a.lieu || unknown}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                    <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{isArabic ? 'المشرف: ' : 'Éducateur : '}<strong className="text-slate-700">{a.educateurRef || unknown}</strong></span>
                  </div>
                </div>

                {/* Material Supplies requirements */}
                {a.materielRequis && (
                  <p className="text-[11px] text-indigo-700 bg-indigo-50/60 rounded-lg px-2.5 py-1.5 font-medium truncate border border-indigo-100/50">
                    {a.materielRequis}
                  </p>
                )}

              </div>

              {/* Quick actions row */}
              {canManageActivites && (
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label={isArabic ? 'تعديل النشاط' : 'Modifier l’activité'}
                    className="min-h-8! h-8 px-2.5 shrink-0 inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-xs font-bold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap transition cursor-pointer"
                    onClick={() => openEditModal(a)}
                  >
                    <Edit3 className="h-3.5 w-3.5 shrink-0" />
                    <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={isArabic ? 'حذف النشاط' : 'Supprimer l’activité'}
                    className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: isArabic ? 'تأكيد حذف النشاط' : 'Confirmer la suppression de l’activité',
                        message: isArabic
                          ? 'سيتم حذف هذا النشاط المبرمج نهائياً.'
                          : 'Cette activité planifiée sera supprimée définitivement.',
                        confirmLabel: isArabic ? 'حذف النشاط' : 'Supprimer l’activité',
                        variant: 'danger',
                      });
                      if (confirmed) await deleteActivite(a.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </div>
              )}
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
            onClick={() => { if (!saving) setShowModal(false); }}
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
                  <h3 className="text-xl font-black">
                    {editingActiviteId
                      ? (isArabic ? 'تعديل النشاط البيداغوجي' : 'Modifier l’atelier éducatif')
                      : (isArabic ? 'تخطيط نشاط ترفيهي وبيداغوجي جديد' : 'Planification d\'Atelier Éducatif')}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تحديد الأهداف، المربيات، المعدات، الموقع والفترات الزمنية للورشات' : 'Fiche d\'animation, équipement, aires de jeu & heures'}</p>
                </div>
                <button 
                  onClick={() => { if (!saving) { setEditingActiviteId(null); setShowModal(false); } }}
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
                      <option value="">{unknown}</option>
                      <option value="Motricité Fine">{isArabic ? 'المهارات الحركية الدقيقة والتنسيق' : 'Motricité Fine & Coordination'}</option>
                      <option value="Éveil Musical">{isArabic ? 'التنشيط الموسيقي والحسي' : 'Éveil Musical & Sensoriel'}</option>
                      <option value="Sortie & Jardin">{isArabic ? 'البيئة والنشاط الخارجي' : 'Éco-citoyenneté & Extérieur'}</option>
                      <option value="Graphisme et Couleurs">{isArabic ? 'الرسم والألوان' : 'Graphisme, Dessin et Peinture'}</option>
                      <option value="Coopération">{isArabic ? 'اللعب الجماعي والتعاون' : 'Jeu Social & Collaboration'}</option>
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
                      <option value="Bébés">{isArabic ? 'الرضع (0-2 سنوات)' : 'Bébés (0-2 ans)'}</option>
                      <option value="Moyens">{isArabic ? 'المتوسطون (2-4 سنوات)' : 'Moyens (2-4 ans)'}</option>
                      <option value="Grands">{isArabic ? 'الكبار (4-6 سنوات)' : 'Grands (4-6 ans)'}</option>
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
                      placeholder="10:00" inputMode="numeric"
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
                      placeholder="11:00" inputMode="numeric"
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
                      {isArabic ? 'المربي المشرف' : 'Animateur référent'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.educateurRef}
                      onChange={e => setFormData({...formData, educateurRef: e.target.value})}
                    >
                      <option value="">{unknown}</option>
                      {personnel.map(p => (
                        <option key={p.id} value={`${p.prenom} ${p.nom}`}>
                          {p.prenom} {p.nom} ({p.poste})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'مكان النشاط' : 'Espace choisi'}
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

              {saveError && <p role="alert" className="mx-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{saveError}</p>}
              {/* Buttons */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => { if (!saving) setShowModal(false); }}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  disabled={saving || saveError.startsWith('Enregistrement non confirmé') || saveError.startsWith('لم يتأكد الحفظ')}
                  onClick={() => void handleAjouter()}
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
                    <span className="text-xs font-black text-slate-855">{selectedActivite.lieu || unknown}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الوقت' : 'Plage Horaire'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.heureDebut || '—'} - {selectedActivite.heureFin || '—'}</span>
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
                    <span>{selectedActivite.competenceVisee || unknown}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">{isArabic ? 'المشرف المسؤول' : 'Éducateur Leader'}</span>
                  <span className="text-sm font-black text-indigo-600">{selectedActivite.educateurRef || unknown}</span>
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
