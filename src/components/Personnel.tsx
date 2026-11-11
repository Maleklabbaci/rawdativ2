import { useRef, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  UserCheck, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Award, 
  Bookmark, 
  Activity, 
  MapPin,
  Heart,
  HelpCircle,
  Clock,
  Edit3
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Personnel as PersonnelType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import StaffHrPanel from './StaffHrPanel';
import TeamAccessManager from './TeamAccessManager';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';

interface RichPersonnel extends PersonnelType {
  telephone?: string;
  email?: string;
  dateEmbauche?: string;
  classeAssignee?: string;
  groupeSanguin?: string;
}

const PRESET_POSTES = [
  'Éducatrice Principale',
  'Puéricultrice',
  'Pédiatre Référent',
  'Psychologue Infantile',
  'Cuisinière Chef',
  'Agent de sécurité',
];

export default function Personnel() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { confirm } = useConfirmDialog();
  const toast = useToast();

  const { personnel: allDbPersonnel, classes: allDbClasses, addPersonnel, updatePersonnel, deletePersonnel } = useDb();
  const { user } = useAuth();
  const { isOwnerProfile, hasPagePermission } = useWorkspaceProfile();
  const isDirecteur = user?.role === 'directeur';
  const canManagePersonnel = hasPagePermission('personnel', 'manage');
  const canManageHr = hasPagePermission('personnel', 'hr_advances');
  const canManageAccess = isDirecteur && isOwnerProfile;
  const dbPersonnel = isDirecteur ? allDbPersonnel.filter((p: any) => !p.crecheId || p.crecheId === user!.id) : allDbPersonnel;
  const classes = (isDirecteur ? allDbClasses.filter((c: any) => !c.crecheId || c.crecheId === user!.id) : allDbClasses) as any[];
  const classNames = classes.map(classe => String(classe.nom || '').trim()).filter(Boolean);

  const personnel: RichPersonnel[] = dbPersonnel.map((p) => ({
    ...p,
    // Ne pas inventer de téléphone, date d'embauche ou groupe sanguin pour remplir l'écran.
    telephone: p.telephone || '',
    email: p.email || '',
    dateEmbauche: p.dateEmbauche || '',
    classeAssignee: p.classeAssignee || '',
    groupeSanguin: p.groupeSanguin || '',
  }));

  const [showModal, setShowModal] = useState(false);
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'team' | 'hr' | 'access'>('team');

  const emptyStaffForm = () => ({
    nom: '',
    prenom: '',
    poste: 'Éducatrice Principale',
    statut: 'Actif' as 'Actif' | 'En congé' | 'Inactif',
    telephone: '',
    email: '',
    dateEmbauche: '',
    classeAssignee: '',
    groupeSanguin: '',
    assuranceActive: false,
    numeroAssurance: '',
  });

  const [formData, setFormData] = useState(emptyStaffForm());

  const openCreateModal = () => {
    setEditingPersonnelId(null);
    setFormData(emptyStaffForm());
    setSaveError('');
    setShowModal(true);
  };

  const openEditModal = (p: RichPersonnel) => {
    setSelectedPersonnel(null);
    setEditingPersonnelId(p.id);
    setFormData({
      nom: p.nom || '',
      prenom: p.prenom || '',
      poste: p.poste || 'Éducatrice Principale',
      statut: (p.statut as 'Actif' | 'En congé' | 'Inactif') || 'Actif',
      telephone: p.telephone || '',
      email: p.email || '',
      dateEmbauche: p.dateEmbauche || '',
      classeAssignee: p.classeAssignee || '',
      groupeSanguin: p.groupeSanguin || '',
      assuranceActive: Boolean(p.assuranceActive),
      numeroAssurance: p.numeroAssurance || '',
    });
    setSaveError('');
    setShowModal(true);
  };

  const handleAjouter = async () => {
    if (savingRef.current || saveError.startsWith('Enregistrement non confirmé') || saveError.startsWith('لم يتأكد الحفظ')) return;
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.poste) {
      setSaveError(isArabic ? 'الاسم واللقب والوظيفة مطلوبة.' : 'Le nom, le prénom et le poste sont obligatoires.');
      return;
    }
    savingRef.current = true; setSaving(true);
    try {
      const payload = {
        ...formData,
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
      };
      if (editingPersonnelId) {
        await updatePersonnel(editingPersonnelId, payload as any);
        toast.success(isArabic ? 'تم تحديث بيانات الموظف' : 'Fiche membre mise à jour');
      } else {
        await addPersonnel({
          ...payload,
          crecheId: isDirecteur ? user!.id : undefined
        } as any);
      }
      setEditingPersonnelId(null);
      setShowModal(false);
      setFormData(emptyStaffForm());
    } catch {
      setSaveError(isArabic ? 'لم يتأكد الحفظ. أغلق النافذة وأعد تحميل القائمة وتحقق قبل المحاولة مجدداً.' : 'Enregistrement non confirmé. Fermez la fenêtre, rechargez et vérifiez la liste avant de réessayer.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const filteredPersonnel = personnel.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.nom.toLowerCase().includes(term) ||
      p.prenom.toLowerCase().includes(term) ||
      p.poste.toLowerCase().includes(term)
    );
  });

  const activeCount = personnel.filter(p => p.statut === 'Actif').length;
  const inactiveCount = personnel.filter(p => p.statut !== 'Actif').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t('staff')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
            {isArabic
              ? `${personnel.length} عضو مسجل · ${activeCount} في الخدمة`
              : `${personnel.length} membre(s) · ${activeCount} en poste${inactiveCount > 0 ? ` · ${inactiveCount} inactif(s)` : ''}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
          {(canManageHr || canManageAccess) && (
            <div
              className={`grid gap-1 rounded-xl bg-slate-100/90 p-1 sm:inline-flex sm:flex-wrap ${
                canManageHr && canManageAccess ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSection('team')}
                className={`min-h-8! rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
                  activeSection === 'team' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isArabic ? 'الفريق' : 'Équipe'}
              </button>
              {canManageHr && (
                <button
                  type="button"
                  onClick={() => setActiveSection('hr')}
                  className={`min-h-8! rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
                    activeSection === 'hr' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="sm:hidden">{isArabic ? 'التسبيقات' : 'Avances RH'}</span>
                  <span className="hidden sm:inline">{isArabic ? 'الحضور والتسبيقات' : 'Pointage & Avances RH'}</span>
                </button>
              )}
              {canManageAccess && (
                <button
                  type="button"
                  onClick={() => setActiveSection('access')}
                  className={`min-h-8! rounded-lg px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer truncate ${
                    activeSection === 'access' ? 'bg-[#c94b30] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="sm:hidden">{isArabic ? 'الصلاحيات' : 'Accès'}</span>
                  <span className="hidden sm:inline">{isArabic ? 'الحسابات والصلاحيات' : 'Accès & Permissions'}</span>
                </button>
              )}
            </div>
          )}
          {canManagePersonnel && activeSection !== 'access' && (
            <button
              className="min-h-9! w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              onClick={openCreateModal}
            >
              <Plus size={16} className="stroke-[2.5] shrink-0" />
              <span>{t('staff.add')}</span>
            </button>
          )}
        </div>
      </div>

      {activeSection === 'access' && canManageAccess ? (
        <TeamAccessManager />
      ) : activeSection === 'hr' && canManageHr ? (
        <StaffHrPanel crecheId={user?.id} personnel={personnel} isArabic={isArabic} />
      ) : (
        <>
      {/* Search Input bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن مربية أو منصب...' : 'Rechercher un membre ou un poste...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-9 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Personnel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPersonnel.length > 0 ? (
          filteredPersonnel.map((p) => {
            const initials = `${p.prenom[0]}${p.nom[0]}`;
            
            return (
              <div
                key={p.id}
                className="rawdha-card-modern bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between cursor-pointer"
                onClick={() => setSelectedPersonnel(p)}
              >
                <div>
                  {/* Card top details with avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{p.prenom} {p.nom}</h3>
                        <span className="inline-flex items-center gap-1 mt-0.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {p.poste}
                        </span>
                      </div>
                    </div>

                    {/* Active/Inactive Badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold leading-none ${
                      p.statut === 'Actif'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {p.statut}
                    </span>
                  </div>

                  {/* Core Information stats */}
                  <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {p.telephone ? <a href={`tel:${p.telephone}`} className="text-slate-700 hover:text-indigo-600 font-bold">{p.telephone}</a> : <span>{isArabic ? 'الهاتف غير مسجل' : 'Téléphone non renseigné'}</span>}
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-700 truncate">{p.email || (isArabic ? 'البريد غير مسجل' : 'E-mail non renseigné')}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isArabic ? 'القسم المسؤول:' : 'Section'}: <strong className="text-slate-800">{p.classeAssignee || (isArabic ? 'غير محدد' : 'Non précisée')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer specs / Embauche & Groupe Sanguin */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{isArabic ? 'التعيين: ' : 'Embauche : '}{p.dateEmbauche || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ms-auto">
                    {p.assuranceActive ? (
                      <span className="whitespace-nowrap px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold ring-1 ring-inset ring-emerald-200/70" title={p.numeroAssurance || ''}>
                        {isArabic ? 'مؤمَّن' : 'CNAS OK'}
                      </span>
                    ) : (
                      <span className="whitespace-nowrap px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold ring-1 ring-inset ring-amber-200/70">
                        {isArabic ? 'تأمين ناقص' : 'CNAS à vérifier'}
                      </span>
                    )}
                    <span className="whitespace-nowrap px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-bold ring-1 ring-inset ring-rose-200/70">
                      {p.groupeSanguin || '—'}
                    </span>
                    {canManagePersonnel && (
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={isArabic ? 'تعديل الموظف' : 'Modifier le membre'}
                          className="min-h-8! h-8 px-2.5 shrink-0 inline-flex items-center justify-center gap-1 rounded-xl border border-indigo-200/80 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold transition cursor-pointer"
                          onClick={() => openEditModal(p)}
                        >
                          <Edit3 className="h-3.5 w-3.5 shrink-0" />
                          <span>{isArabic ? 'تعديل' : 'Modifier'}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={isArabic ? 'حذف الموظف' : 'Supprimer le membre'}
                          className="min-h-8! h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: isArabic ? 'تأكيد حذف الموظف' : 'Confirmer la suppression du personnel',
                              message: isArabic
                                ? 'سيتم حذف هذا الموظف نهائياً.'
                                : 'Ce membre du personnel sera supprimé définitivement.',
                              confirmLabel: isArabic ? 'حذف الموظف' : 'Supprimer le membre',
                              variant: 'danger',
                            });
                            if (confirmed) await deletePersonnel(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد نتائج مطابقة' : 'Aucun membre d\'équipe trouvé'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'يرجى مراجعة معيار البحث الخاص بك.' : 'Faites une autre recherche ou ajoutez un nouveau membre.'}</p>
          </div>
        )}
      </div>
        </>
      )}

      {/* Adding Rich Staff Modal ("PLEINE DE FORMATION") */}
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
                  <h3 className="text-xl font-black">
                    {editingPersonnelId
                      ? (isArabic ? 'تعديل بطاقة الموظف' : 'Modifier le dossier personnel')
                      : (isArabic ? 'إضافة عضو جديد وتعيينه' : 'Nouveau Dossier Personnel')}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تعبئة معلومات الحساب، بطاقة الاتصال، المسؤولية والبيانات الصحية للموظف' : 'Fiche d\'embauche, coordonnées, poste et groupe sanguin'}</p>
                </div>
                <button 
                  onClick={() => { if (!saving) { setEditingPersonnelId(null); setShowModal(false); } }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Last Name & First Name (Row 1) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'اللقب *' : 'Nom de famille *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Benali"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.nom} 
                      onChange={e => setFormData({...formData, nom: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الاسم الشخصي *' : 'Prénom *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Nassima"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.prenom} 
                      onChange={e => setFormData({...formData, prenom: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Job Title & Contact (Row 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوظيفة / التخصص *' : 'Poste occupé *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.poste}
                      onChange={e => setFormData({...formData, poste: e.target.value})}
                    >
                      {!PRESET_POSTES.includes(formData.poste) && formData.poste && (
                        <option value={formData.poste}>{formData.poste}</option>
                      )}
                      <option value="Éducatrice Principale">{isArabic ? 'مربية رئيسية' : 'Éducatrice Principale'}</option>
                      <option value="Puéricultrice">{isArabic ? 'مربية أطفال' : 'Puéricultrice'}</option>
                      <option value="Pédiatre Référent">{isArabic ? 'طبيب أطفال مرجعي' : 'Pédiatre Référent'}</option>
                      <option value="Psychologue Infantile">{isArabic ? 'أخصائي نفساني للأطفال' : 'Psychologue Infantile'}</option>
                      <option value="Cuisinière Chef">{isArabic ? 'طاهية رئيسية' : 'Cuisinière Chef'}</option>
                      <option value="Agent de sécurité">{isArabic ? 'عون أمن / إداري' : 'Agent de sécurité / Admin'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم الهاتف (اختياري)' : 'Téléphone (facultatif)'}
                    </label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 0555 12 34 56"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.telephone} 
                      onChange={e => setFormData({...formData, telephone: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'البريد الإلكتروني' : 'Adresse Email Professionnelle (Optionnel)'}
                  </label>
                  <input 
                    type="email" 
                    placeholder="Ex: nassima.b@rawdha.dz"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                {/* Section assigned & blood type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'القسم / الصف المسند' : 'Classe / Section affectée'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.classeAssignee}
                      onChange={e => setFormData({...formData, classeAssignee: e.target.value})}
                    >
                      <option value="">{isArabic ? 'غير محدد' : 'Non précisée'}</option>
                      {classNames.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                      <option value="Toutes les classes">{isArabic ? 'كل الأقسام / متعدد' : 'Toutes les classes / Polyvalente'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الفصيلة الدموية (اختياري)' : 'Groupe sanguin (facultatif)'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800"
                      value={formData.groupeSanguin}
                      onChange={e => setFormData({...formData, groupeSanguin: e.target.value})}
                    >
                      <option value="">{isArabic ? 'غير محدد' : 'Non renseigné'}</option>
                      <option value="O+">O+</option>
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                      <option value="B-">B-</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                {/* Hire Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'تاريخ التعيين' : 'Date de prise de service'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.dateEmbauche}
                      onChange={e => setFormData({...formData, dateEmbauche: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوضعية اليوم *' : 'Statut de Disponibilité *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.statut} 
                      onChange={e => setFormData({...formData, statut: e.target.value as any})}
                    >
                      <option value="Actif">{isArabic ? 'نشط' : 'Actif (En poste)'}</option>
                      <option value="En congé">{isArabic ? 'في عطلة' : 'En congé'}</option>
                      <option value="Inactif">{isArabic ? 'غير نشط' : 'Inactif'}</option>
                    </select>
                  </div>
                </div>

                {/* ✅ Assurance de l'employé(e) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="assuranceActive"
                      checked={formData.assuranceActive}
                      onChange={e => setFormData({...formData, assuranceActive: e.target.checked})}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="assuranceActive" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                      {isArabic ? 'مؤمَّن(ة) اجتماعياً' : 'Assuré(e) socialement'}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم التأمين (CNAS)' : 'N° Assurance (CNAS)'}
                    </label>
                    <input
                      type="text"
                      disabled={!formData.assuranceActive}
                      placeholder={isArabic ? 'مثال: 123456789012' : 'Ex: 123456789012'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.numeroAssurance}
                      onChange={e => setFormData({...formData, numeroAssurance: e.target.value})}
                    />
                  </div>
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

      {/* Personnel Profile Detail Modal */}
      <AnimatePresence>
        {selectedPersonnel && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setSelectedPersonnel(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Colorful gradient headers */}
              <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-lg flex items-center justify-center shadow-inner">
                    {selectedPersonnel.prenom[0]}{selectedPersonnel.nom[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedPersonnel.prenom} {selectedPersonnel.nom}</h3>
                    <p className="text-xs text-indigo-100 mt-0.5">{selectedPersonnel.poste}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPersonnel(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Contact Coordinates */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2">{isArabic ? 'معلومات الاتصال المباشرة' : 'Coordonnées de l\'employé'}</span>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Phone className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'الهاتف المحمول' : 'Téléphone direct'}</span>
                        {selectedPersonnel.telephone ? <a href={`tel:${selectedPersonnel.telephone}`} className="text-indigo-600 font-extrabold">{selectedPersonnel.telephone}</a> : (isArabic ? 'غير مسجل' : 'Non renseigné')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Mail className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'البريد الإلكتروني' : 'Messagerie'}</span>
                        <span className="text-slate-800 font-bold">{selectedPersonnel.email || (isArabic ? 'غير مسجل' : 'Non renseigné')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assignment & Health specs */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'القسم المسؤول' : 'Classe Affectée'}</span>
                    <span className="font-extrabold text-slate-800 text-xs">{selectedPersonnel.classeAssignee || (isArabic ? 'غير محدد' : 'Non précisée')}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'الفصيلة الدموية' : 'Groupe Sanguin'}</span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded font-black border border-rose-100/30 text-xs inline-block">
                      {isArabic ? 'الفصيلة: ' : 'Groupe : '}{selectedPersonnel.groupeSanguin || '—'}
                    </span>
                  </div>
                </div>

                {/* Hire details */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{isArabic ? 'تاريخ التوظيف' : 'Date d\'embauche'}</span>
                    <span className="font-extrabold text-slate-800">{selectedPersonnel.dateEmbauche || '—'}</span>
                  </div>
                  <div className="text-end">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block text-end mb-1">{isArabic ? 'حالة الحساب' : 'Disponibilité'}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      selectedPersonnel.statut === 'Actif' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {selectedPersonnel.statut === 'Actif'
                        ? (isArabic ? 'نشط' : 'Actif')
                        : selectedPersonnel.statut === 'En congé'
                        ? (isArabic ? 'في عطلة' : 'En congé')
                        : (isArabic ? 'غير نشط' : 'Inactif')}
                    </span>
                  </div>
                </div>

                {canManagePersonnel && (
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedPersonnel)}
                    className="min-h-10! w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="h-4 w-4 shrink-0" />
                    <span>{isArabic ? 'تعديل بطاقة الموظف' : 'Modifier la fiche membre'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
