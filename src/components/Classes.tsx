import { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  School, 
  Users, 
  ChevronDown,
  Check,
  Edit, // Ajout de l'icône Edit
  UserSquare
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { usePagination } from '../hooks/usePagination';
import { Classe } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichClasse extends Classe {
  educateurChef?: string;
  salleNom?: string;
  couleurTheme?: 'emerald' | 'sky' | 'indigo' | 'rose' | 'amber';
  childrenIds?: string[];
}

export default function Classes() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { showToast } = useToast();

  const { classes: allDbClasses, enfants: enfantsData, personnel: personnelData, addClasse, deleteClasse, updateClasse } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbClasses = isDirecteur ? allDbClasses.filter((c: any) => c.crecheId === user!.id) : allDbClasses;

  const classes: RichClasse[] = useMemo(() => {
    return dbClasses.map((c: any, idx: number) => {
      const themes: RichClasse['couleurTheme'][] = ['emerald', 'sky', 'indigo', 'rose', 'amber'];
      return {
        ...c,
        educateurChef: c.educateurChef || (personnelData[idx % personnelData.length] 
          ? `${personnelData[idx % personnelData.length].prenom} ${personnelData[idx % personnelData.length].nom}` 
          : 'Non assigné'),
        salleNom: c.salleNom || `Salle B-${102 + idx}`,
        couleurTheme: c.couleurTheme || themes[idx % themes.length],
        childrenIds: c.childrenIds || []
      };
    });
  }, [dbClasses, personnelData]);

  // State
  const [showModal, setShowModal] = useState(false);
  const [editingClasseId, setEditingClasseId] = useState<string | null>(null); // State pour savoir si on édite
  const [selectedClasse, setSelectedClasse] = useState<RichClasse | null>(null);
  const [expandedClasseId, setExpandedClasseId] = useState<string | null>(null);
  const [showAddChildrenModal, setShowAddChildrenModal] = useState(false);
  const [selectedChildrenToAdd, setSelectedChildrenToAdd] = useState<Set<string>>(new Set());
  const [searchChildTerm, setSearchChildTerm] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    niveau: 'Bébés' as Classe['niveau'],
    capacite: 12,
    educateurChef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : '',
    salleNom: 'Salle C-201',
    couleurTheme: 'indigo' as 'emerald' | 'sky' | 'indigo' | 'rose' | 'amber'
  });

  // ===== MEMOIZED: Get children for selected class =====
  const childrenInSelectedClass = useMemo(() => {
    if (!selectedClasse) return [];
    return enfantsData.filter(e => selectedClasse.childrenIds?.includes(e.id));
  }, [selectedClasse, enfantsData]);

  // ===== MEMOIZED: Get available children to add =====
  const availableChildrenToAdd = useMemo(() => {
    if (!selectedClasse) return [];
    return enfantsData.filter(e => 
      !selectedClasse.childrenIds?.includes(e.id) &&
      `${e.prenom} ${e.nom}`.toLowerCase().includes(searchChildTerm.toLowerCase())
    );
  }, [selectedClasse, enfantsData, searchChildTerm]);

  // ===== PAGINATION for children in class =====
  const {
    paginatedItems: paginatedChildrenInClass,
    currentPage: classChildrenPage,
    totalPages: classChildrenTotalPages,
    goToPage: goToClassChildrenPage
  } = usePagination(childrenInSelectedClass, 20);

  // ===== PAGINATION for available children to add =====
  const {
    paginatedItems: paginatedAvailableChildren,
    currentPage: availableChildrenPage,
    totalPages: availableChildrenTotalPages,
    goToPage: goToAvailableChildrenPage
  } = usePagination(availableChildrenToAdd, 20);

  // ===== HANDLERS =====

  // Ouvrir le formulaire pré-rempli pour modification
  const handleEditClick = (e: React.MouseEvent, classe: RichClasse) => {
    e.stopPropagation(); // Évite de fermer l'onglet déroulant
    setEditingClasseId(classe.id);
    setFormData({
      nom: classe.nom,
      niveau: classe.niveau,
      capacite: classe.capacite,
      educateurChef: classe.educateurChef || '',
      salleNom: classe.salleNom || '',
      couleurTheme: classe.couleurTheme || 'indigo'
    });
    setShowModal(true);
  };

  const handleAjouterOuModifier = useCallback(() => {
    if (!formData.nom || formData.capacite <= 0) {
      showToast(isArabic ? 'يرجى ملء جميع الحقول' : 'Veuillez remplir tous les champs', 'error');
      return;
    }
    try {
      if (editingClasseId) {
        // Mode Modification
        updateClasse(editingClasseId, formData as any);
        showToast(isArabic ? 'تم تعديل الفصل بنجاح ✅' : 'Classe modifiée avec succès ✅', 'success');
      } else {
        // Mode Ajout standard
        addClasse({ ...formData, crecheId: isDirecteur ? user!.id : undefined } as any);
        showToast(isArabic ? 'تمت إضافة الفصل بنجاح ✅' : 'Classe ajoutée avec succès ✅', 'success');
      }
      
      setShowModal(false);
      setEditingClasseId(null);
      // Reset formulaire
      setFormData({
        nom: '',
        niveau: 'Bébés',
        capacite: 12,
        educateurChef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : '',
        salleNom: 'Salle C-201',
        couleurTheme: 'indigo'
      });
    } catch (error) {
      showToast(isArabic ? 'فشل العملية ❌' : 'Erreur lors de l\'opération ❌', 'error');
    }
  }, [formData, addClasse, updateClasse, editingClasseId, isDirecteur, user, showToast, isArabic, personnelData]);

  const handleDeleteClasse = useCallback((id: string) => {
    if (confirm(isArabic ? 'هل أنت متأكد من حذف هذا الفصل؟' : 'Êtes-vous sûr de vouloir supprimer cette classe ?')) {
      try {
        deleteClasse(id);
        showToast(isArabic ? 'تم حذف الفصل بنجاح ✅' : 'Classe supprimée ✅', 'success');
        setSelectedClasse(null);
        setExpandedClasseId(null);
      } catch (error) {
        showToast(isArabic ? 'فشل الحذف ❌' : 'Erreur de suppression ❌', 'error');
      }
    }
  }, [deleteClasse, showToast, isArabic]);

  // ===== BULK ADD CHILDREN TO CLASS =====
  const handleBulkAddChildren = useCallback(async () => {
    if (selectedChildrenToAdd.size === 0 || !selectedClasse) {
      showToast(isArabic ? 'اختر أطفالاً أولاً' : 'Sélectionnez d\'abord des enfants', 'error');
      return;
    }

    try {
      const newChildrenIds = [
        ...(selectedClasse.childrenIds || []),
        ...Array.from(selectedChildrenToAdd)
      ];
      
      await updateClasse(selectedClasse.id, { childrenIds: newChildrenIds });
      
      showToast(
        isArabic 
          ? `تمت إضافة ${selectedChildrenToAdd.size} أطفال ✅`
          : `${selectedChildrenToAdd.size} enfants ajoutés ✅`,
        'success'
      );
      
      setSelectedChildrenToAdd(new Set());
      setShowAddChildrenModal(false);
      setSearchChildTerm('');
      goToAvailableChildrenPage(1);
      
      // Refresh selected class
      const updatedClass = classes.find(c => c.id === selectedClasse.id);
      if (updatedClass) {
        setSelectedClasse(updatedClass);
      }
    } catch (error) {
      console.error('Error adding children:', error);
      showToast(isArabic ? 'فشل إضافة الأطفال ❌' : 'Erreur lors de l\'ajout ❌', 'error');
    }
  }, [selectedClasse, selectedChildrenToAdd, classes, updateClasse, showToast, isArabic, goToAvailableChildrenPage]);

  // ===== BULK REMOVE CHILDREN FROM CLASS =====
  const handleBulkRemoveChildren = useCallback(async (childrenIdsToRemove: string[]) => {
    if (!selectedClasse || childrenIdsToRemove.length === 0) return;

    try {
      const newChildrenIds = (selectedClasse.childrenIds || []).filter(
        id => !childrenIdsToRemove.includes(id)
      );
      
      await updateClasse(selectedClasse.id, { childrenIds: newChildrenIds });
      
      showToast(
        isArabic 
          ? `تم حذف ${childrenIdsToRemove.length} أطفال ✅`
          : `${childrenIdsToRemove.length} enfants supprimés ✅`,
        'success'
      );
      
      // Refresh selected class
      const updatedClass = classes.find(c => c.id === selectedClasse.id);
      if (updatedClass) {
        setSelectedClasse(updatedClass);
      }
    } catch (error) {
      console.error('Error removing children:', error);
      showToast(isArabic ? 'فشل الحذف ❌' : 'Erreur de suppression ❌', 'error');
    }
  }, [selectedClasse, classes, updateClasse, showToast, isArabic]);

  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'emerald':
        return {
          border: 'border-emerald-100 hover:border-emerald-300',
          bg: 'bg-emerald-50/70',
          badge: 'bg-emerald-100 text-emerald-800',
          icon: 'text-emerald-600'
        };
      case 'sky':
        return {
          border: 'border-sky-100 hover:border-sky-300',
          bg: 'bg-sky-50/70',
          badge: 'bg-sky-100 text-sky-800',
          icon: 'text-sky-600'
        };
      case 'indigo':
        return {
          border: 'border-indigo-100 hover:border-indigo-300',
          bg: 'bg-indigo-50/70',
          badge: 'bg-indigo-100 text-indigo-800',
          icon: 'text-indigo-600'
        };
      case 'rose':
        return {
          border: 'border-rose-100 hover:border-rose-300',
          bg: 'bg-rose-50/70',
          badge: 'bg-rose-100 text-rose-800',
          icon: 'text-rose-600'
        };
      case 'amber':
        return {
          border: 'border-amber-100 hover:border-amber-300',
          bg: 'bg-amber-50/70',
          badge: 'bg-amber-100 text-amber-800',
          icon: 'text-amber-600'
        };
      default:
        return {
          border: 'border-slate-200 hover:border-slate-300',
          bg: 'bg-slate-50',
          badge: 'bg-slate-100 text-slate-800',
          icon: 'text-slate-600'
        };
    }
  };

  return (
    <div className={`p-6 space-y-6 ${isArabic ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <School className="w-8 h-8" />
          {isArabic ? 'الفصول الدراسية' : 'Classes'}
        </h1>
        <button
          onClick={() => {
            setEditingClasseId(null); // S'assurer que le mode édition est réinitialisé
            setShowModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 cursor-pointer transition font-bold"
        >
          <Plus className="w-5 h-5" />
          {isArabic ? 'إضافة فصل' : 'Ajouter Classe'}
        </button>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(classe => {
          const theme = getThemeClasses(classe.couleurTheme || 'indigo');
          const isExpanded = expandedClasseId === classe.id;
          const childCount = classe.childrenIds?.length || 0;

          return (
            <motion.div
              key={classe.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition ${theme.border} ${isExpanded ? theme.bg : 'bg-white hover:shadow-md'}`}
              onClick={() => {
                setSelectedClasse(classe);
                setExpandedClasseId(isExpanded ? null : classe.id);
              }}
            >
              {/* Class header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{classe.nom}</h3>
                  <p className="text-sm text-slate-600">
                    {classe.niveau} • {classe.salleNom}
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 transition transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>

              {/* Class info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>{childCount}/{classe.capacite} enfants</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <UserSquare className="w-4 h-4 text-slate-500" />
                  <span>{classe.educateurChef}</span>
                </div>
              </div>

              {/* Capacity bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition`}
                  style={{
                    width: `${Math.min((childCount / classe.capacite) * 100, 100)}%`,
                    backgroundColor: childCount / classe.capacite > 0.9 ? '#ef4444' : childCount / classe.capacite > 0.7 ? '#f59e0b' : '#10b981'
                  }}
                />
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-slate-200"
                    onClick={(e) => e.stopPropagation()} // Évite de fermer l'accordéon au clic sur les éléments internes
                  >
                    {/* Children list */}
                    {childCount > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm">
                            {isArabic ? 'الأطفال' : 'Enfants'} ({childCount})
                          </h4>
                          <button
                            onClick={() => setShowAddChildrenModal(true)}
                            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 cursor-pointer font-bold"
                          >
                            +{isArabic ? ' إضافة' : ' Ajouter'}
                          </button>
                        </div>

                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {paginatedChildrenInClass.map(child => (
                            <div
                              key={child.id}
                              className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded text-sm hover:bg-slate-50"
                            >
                              <span>{child.prenom} {child.nom}</span>
                              <button
                                onClick={() => handleBulkRemoveChildren([child.id])}
                                className="text-red-500 hover:text-red-750 p-1 rounded hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {classChildrenTotalPages > 1 && (
                          <div className="text-xs text-center text-slate-500 mt-2">
                            Page {classChildrenPage}/{classChildrenTotalPages}
                            <div className="flex gap-1 justify-center mt-1">
                              <button
                                onClick={() => goToClassChildrenPage(classChildrenPage - 1)}
                                disabled={classChildrenPage === 1}
                                className="px-2 py-1 bg-slate-200 rounded disabled:opacity-50 cursor-pointer"
                              >
                                ←
                              </button>
                              <button
                                onClick={() => goToClassChildrenPage(classChildrenPage + 1)}
                                disabled={classChildrenPage === classChildrenTotalPages}
                                className="px-2 py-1 bg-slate-200 rounded disabled:opacity-50 cursor-pointer"
                              >
                                →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {childCount === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500 mb-2">
                          {isArabic ? 'لا توجد أطفال في هذا الفصل' : 'Aucun enfant dans cette classe'}
                        </p>
                        <button
                          onClick={() => setShowAddChildrenModal(true)}
                          className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 cursor-pointer"
                        >
                          +{isArabic ? ' إضافة أطفال' : ' Ajouter des enfants'}
                        </button>
                      </div>
                    )}

                    {/* Double Boutons : Modifier & Supprimer */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200">
                      {/* BOUTON MODIFIER */}
                      <button
                        onClick={(e) => handleEditClick(e, classe)}
                        className="flex-1 px-3 py-2 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 flex items-center justify-center gap-2 text-sm font-bold transition cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                        {isArabic ? 'تعديل الفصل' : 'Modifier'}
                      </button>

                      {/* BOUTON SUPPRIMER */}
                      <button
                        onClick={() => handleDeleteClasse(classe.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-750 rounded hover:bg-red-200 flex items-center justify-center gap-2 text-sm font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isArabic ? 'حذف الفصل' : 'Supprimer'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ADD / EDIT CLASS MODAL */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {editingClasseId 
                    ? (isArabic ? 'تعديل بيانات الفصل' : 'Modifier la classe') 
                    : (isArabic ? 'إضافة فصل جديد' : 'Ajouter une nouvelle classe')
                  }
                </h2>
                <button 
                  onClick={() => {
                    setShowModal(false);
                    setEditingClasseId(null);
                  }} 
                  className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'اسم الفصل *' : 'Nom *'}</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold"
                    placeholder={isArabic ? 'مثال: الرضع' : 'Ex: Bébés'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'المستوى' : 'Niveau'}</label>
                  <select
                    value={formData.niveau}
                    onChange={(e) => setFormData({ ...formData, niveau: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option>Bébés</option>
                    <option>Moyens</option>
                    <option>Grands</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'السعة القصوى *' : 'Capacité *'}</label>
                  <input
                    type="number"
                    value={formData.capacite}
                    onChange={(e) => setFormData({ ...formData, capacite: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'المعلم الرئيسي' : 'Éducateur Chef'}</label>
                  <select
                    value={formData.educateurChef}
                    onChange={(e) => setFormData({ ...formData, educateurChef: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    {personnelData.map(p => (
                      <option key={p.id} value={`${p.prenom} ${p.nom}`}>{p.prenom} {p.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'اسم الغرفة' : 'Nom Salle'}</label>
                  <input
                    type="text"
                    value={formData.salleNom}
                    onChange={(e) => setFormData({ ...formData, salleNom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">{isArabic ? 'اللون المميز' : 'Couleur'}</label>
                  <div className="flex gap-2">
                    {['emerald', 'sky', 'indigo', 'rose', 'amber'].map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData({ ...formData, couleurTheme: color as any })}
                        className={`w-8 h-8 rounded-full border-2 transition cursor-pointer ${
                          formData.couleurTheme === color ? 'border-slate-800 scale-110 shadow' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: {
                            emerald: '#10b981',
                            sky: '#0ea5e9',
                            indigo: '#4f46e5',
                            rose: '#f43f5e',
                            amber: '#f59e0b'
                          }[color]
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleAjouterOuModifier}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold cursor-pointer transition text-center"
                >
                  {editingClasseId ? (isArabic ? 'حفظ التعديلات' : 'Sauvegarder') : (isArabic ? 'إضافة' : 'Ajouter')}
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingClasseId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold cursor-pointer transition text-center"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD CHILDREN TO CLASS MODAL */}
      <AnimatePresence>
        {showAddChildrenModal && selectedClasse && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {isArabic ? 'إضافة أطفال إلى' : 'Ajouter enfants à'} {selectedClasse.nom}
                </h2>
                <button
                  onClick={() => {
                    setShowAddChildrenModal(false);
                    setSelectedChildrenToAdd(new Set());
                    setSearchChildTerm('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={isArabic ? 'البحث عن أطفال...' : 'Rechercher enfants...'}
                  value={searchChildTerm}
                  onChange={(e) => {
                    setSearchChildTerm(e.target.value);
                    goToAvailableChildrenPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Available children */}
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {paginatedAvailableChildren.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-slate-500">
                      {isArabic ? 'لا توجد أطفال متاحين' : 'Aucun enfant disponible'}
                    </p>
                  </div>
                ) : (
                  paginatedAvailableChildren.map(child => (
                    <label
                      key={child.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChildrenToAdd.has(child.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedChildrenToAdd);
                          if (e.target.checked) {
                            newSelected.add(child.id);
                          } else {
                            newSelected.delete(child.id);
                          }
                          setSelectedChildrenToAdd(newSelected);
                        }}
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="flex-1 font-semibold text-slate-800">
                        {child.prenom} {child.nom}
                      </span>
                      {selectedChildrenToAdd.has(child.id) && (
                        <Check className="w-5 h-5 text-indigo-600" />
                      )}
                    </label>
                  ))
                )}
              </div>

              {/* Pagination */}
              {availableChildrenTotalPages > 1 && (
                <div className="flex gap-2 justify-center mb-4">
                  <button
                    onClick={() => goToAvailableChildrenPage(availableChildrenPage - 1)}
                    disabled={availableChildrenPage === 1}
                    className="px-3 py-1 bg-slate-250 hover:bg-slate-200 rounded disabled:opacity-50 cursor-pointer"
                  >
                    ←
                  </button>
                  <span className="text-sm font-semibold flex items-center">
                    {availableChildrenPage}/{availableChildrenTotalPages}
                  </span>
                  <button
                    onClick={() => goToAvailableChildrenPage(availableChildrenPage + 1)}
                    disabled={availableChildrenPage === availableChildrenTotalPages}
                    className="px-3 py-1 bg-slate-250 hover:bg-slate-200 rounded disabled:opacity-50 cursor-pointer"
                  >
                    →
                  </button>
                </div>
              )}

              {/* Selected count */}
              <div className="text-sm text-slate-500 mb-4 font-bold">
                {selectedChildrenToAdd.size} {isArabic ? 'أطفال مختارين' : 'enfants sélectionnés'}
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleBulkAddChildren}
                  disabled={selectedChildrenToAdd.size === 0}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold cursor-pointer transition"
                >
                  +{isArabic ? ' إضافة' : ' Ajouter'} ({selectedChildrenToAdd.size})
                </button>
                <button
                  onClick={() => {
                    setShowAddChildrenModal(false);
                    setSelectedChildrenToAdd(new Set());
                    setSearchChildTerm('');
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 font-semibold cursor-pointer transition text-center"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
