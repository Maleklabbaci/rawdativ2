import React, { useContext, useMemo, useState } from 'react';
import {
  Check,
  Crown,
  Edit3,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DbContext } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  buildFullPagePermissions,
  normalizeProfilePermissions,
  PAGE_PERMISSION_CATALOG,
  ROLE_PRESET_PERMISSIONS,
  useWorkspaceProfile,
  type CreateSubProfileInput,
  type PagePermissionsMap,
  type ProfileAvatarColor,
  type WorkspaceRolePreset,
  type WorkspaceSubProfile,
} from '../contexts/WorkspaceProfileContext';

export const PROFILE_AVATAR_STYLES: Record<ProfileAvatarColor, string> = {
  terracotta: 'bg-[#c94b30] text-white',
  petrol: 'bg-[#25434c] text-white',
  indigo: 'bg-indigo-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  amber: 'bg-amber-500 text-slate-950',
  rose: 'bg-rose-600 text-white',
  sky: 'bg-sky-600 text-white',
  slate: 'bg-slate-700 text-white',
};

export function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R+';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

interface ProfileEditorModalProps {
  initialProfile?: WorkspaceSubProfile | null;
  onClose: () => void;
}

export function ProfilePermissionEditorModal({
  initialProfile,
  onClose,
}: ProfileEditorModalProps) {
  const { user } = useAuth();
  const db = useContext(DbContext);
  const allClasses = db?.classes || [];
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { saveSubProfile, deleteSubProfile } = useWorkspaceProfile();

  const crecheClasses = useMemo(
    () => allClasses.filter((cls: any) => !user?.id || !cls.crecheId || cls.crecheId === user.id),
    [allClasses, user?.id]
  );

  const editingIsOwner = Boolean(initialProfile?.isOwner);

  const [formName, setFormName] = useState(() => initialProfile?.name || '');
  const [formRoleLabel, setFormRoleLabel] = useState(
    () => initialProfile?.roleLabel || (isAr ? 'مربية' : 'Éducatrice')
  );
  const [formPreset, setFormPreset] = useState<WorkspaceRolePreset>(
    () => initialProfile?.preset || 'educatrice'
  );
  const [formColor, setFormColor] = useState<ProfileAvatarColor>(
    () => initialProfile?.color || 'emerald'
  );
  const [formPassword, setFormPassword] = useState('');
  const [formPagePerms, setFormPagePerms] = useState<PagePermissionsMap>(() => {
    if (initialProfile) {
      return normalizeProfilePermissions(initialProfile);
    }
    const clone: PagePermissionsMap = {};
    for (const [k, v] of Object.entries(ROLE_PRESET_PERMISSIONS.educatrice.pagePermissions)) {
      clone[k] = [...v];
    }
    return clone;
  });

  const [restrictClasses, setRestrictClasses] = useState<boolean>(
    () => Boolean(initialProfile?.allowedClassIds && initialProfile.allowedClassIds.length > 0)
  );
  const [formClassIds, setFormClassIds] = useState<string[]>(
    () => (initialProfile?.allowedClassIds ? [...initialProfile.allowedClassIds] : [])
  );
  const [formHideFinancials, setFormHideFinancials] = useState<boolean>(
    () => (initialProfile ? initialProfile.hideFinancials : true)
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const applyPreset = (preset: Exclude<WorkspaceRolePreset, 'owner'>) => {
    setFormPreset(preset);
    const cfg = ROLE_PRESET_PERMISSIONS[preset];
    const cloned: PagePermissionsMap = {};
    for (const [k, v] of Object.entries(cfg.pagePermissions)) {
      cloned[k] = [...v];
    }
    setFormPagePerms(cloned);
    setFormHideFinancials(cfg.hideFinancials);
    if (preset === 'educatrice') setFormRoleLabel(isAr ? 'مربية قسم' : 'Éducatrice');
    else if (preset === 'accueil') setFormRoleLabel(isAr ? 'استقبال / أمانة' : 'Accueil / Secrétariat');
    else if (preset === 'cuisine') setFormRoleLabel(isAr ? 'المطعم والوجبات' : 'Cuisine & Repas');
    else setFormRoleLabel(isAr ? 'صلاحيات مخصصة' : 'Accès personnalisé');
  };

  const togglePageEnabled = (pageKey: string) => {
    setFormPreset('custom');
    setFormPagePerms(prev => {
      const next = { ...prev };
      if (next[pageKey]?.includes('view')) {
        delete next[pageKey];
      } else {
        next[pageKey] = ['view'];
        if (pageKey === 'paiements' || pageKey === 'achats') {
          setFormHideFinancials(false);
        }
      }
      return next;
    });
  };

  const toggleSpecificPermission = (pageKey: string, permId: string) => {
    if (permId === 'view') {
      togglePageEnabled(pageKey);
      return;
    }
    setFormPreset('custom');
    setFormPagePerms(prev => {
      const current = prev[pageKey] || ['view'];
      const hasPerm = current.includes(permId);
      const updated = hasPerm
        ? current.filter(id => id !== permId)
        : [...new Set(['view', ...current, permId])];
      return {
        ...prev,
        [pageKey]: updated,
      };
    });
  };

  const selectAllPagePerms = (pageKey: string, allIds: string[]) => {
    setFormPreset('custom');
    setFormPagePerms(prev => ({
      ...prev,
      [pageKey]: [...allIds],
    }));
  };

  const toggleClassId = (classId: string) => {
    setFormClassIds(prev => (prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]));
  };

  const enabledPageCount = (Object.values(formPagePerms) as (string[] | undefined)[]).filter(
    arr => arr?.includes('view')
  ).length;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (!formName.trim()) {
      setError(isAr ? 'يرجى إدخال اسم الحساب.' : 'Veuillez saisir le nom du profil.');
      return;
    }
    if (!initialProfile && formPassword.trim().length < 4) {
      setError(
        isAr
          ? 'يرجى تحديد كلمة مرور من 4 أحرف أو أرقام على الأقل.'
          : 'Définissez un mot de passe d’au moins 4 caractères.'
      );
      return;
    }
    if (initialProfile && formPassword.trim().length > 0 && formPassword.trim().length < 4) {
      setError(
        isAr
          ? 'كلمة المرور الجديدة يجب أن تضم 4 أحرف على الأقل.'
          : 'Le nouveau mot de passe doit contenir au moins 4 caractères.'
      );
      return;
    }
    if (!editingIsOwner && enabledPageCount === 0) {
      setError(
        isAr ? 'يرجى تفعيل صفحة واحدة على الأقل لهذا الحساب.' : 'Activez l’accès à au moins une page.'
      );
      return;
    }
    if (!editingIsOwner && restrictClasses && formClassIds.length === 0) {
      setError(
        isAr
          ? 'اختاري قسماً واحداً على الأقل أو اسمحي بكل الأقسام.'
          : 'Cochez au moins une classe ou sélectionnez « Toutes les classes ».'
      );
      return;
    }

    const input: CreateSubProfileInput = {
      id: initialProfile?.id,
      name: formName,
      roleLabel: formRoleLabel,
      preset: editingIsOwner ? 'owner' : formPreset,
      color: formColor,
      password: formPassword.trim() || undefined,
      pagePermissions: editingIsOwner ? buildFullPagePermissions() : formPagePerms,
      allowedClassIds: !editingIsOwner && restrictClasses ? formClassIds : null,
      hideFinancials: editingIsOwner ? false : formHideFinancials,
    };

    setBusy(true);
    try {
      const res = await saveSubProfile(input);
      if (!res.ok) {
        setError(isAr ? 'تعذر حفظ الحساب.' : 'Impossible d’enregistrer ce profil.');
        return;
      }
      onClose();
    } catch {
      setError(isAr ? 'تعذر حفظ الحساب. تحققي من الاتصال وحاولي مجدداً.' : 'Impossible d’enregistrer ce profil. Vérifiez la connexion puis réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[1050] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 sm:items-center sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        onClick={e => e.stopPropagation()}
        className="my-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#25434c]">
              {initialProfile
                ? isAr
                  ? `تعديل صلاحيات حساب «${initialProfile.name}»`
                  : `Modifier le profil « ${initialProfile.name} »`
                : isAr
                  ? 'إنشاء حساب جديد للفريق وتحديد صلاحياته'
                  : 'Nouveau profil d’équipe & permissions par page'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAr
                ? 'حددي كلمة المرور الخاصة به، ثم اختاري لكل صفحة ما يُسمح له برؤيته أو تعديله.'
                : 'Définissez son mot de passe, puis cochez pour chaque page ses permissions exactes (lecture seule ou actions).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-4 max-h-[66vh] space-y-5 overflow-y-auto pe-1">
          {/* Identité & Mot de passe */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                {isAr ? 'اسم الحساب *' : 'Prénom ou nom du profil *'}
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={isAr ? 'مثال: مريم' : 'Ex. : Meriem'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#c94b30]"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                {isAr ? 'الصفة / المنصب' : 'Fonction affichée'}
              </label>
              <input
                type="text"
                value={formRoleLabel}
                onChange={e => setFormRoleLabel(e.target.value)}
                placeholder={isAr ? 'مثال: مربية الرضع' : 'Ex. : Éducatrice Bébés'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#c94b30]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-700">
                {initialProfile
                  ? isAr
                    ? 'كلمة مرور جديدة (اتركيها فارغة للاحتفاظ بالحالية)'
                    : 'Nouveau mot de passe (laisser vide pour conserver l’actuel)'
                  : isAr
                    ? 'كلمة مرور هذا الحساب *'
                    : 'Mot de passe personnel du profil *'}
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                placeholder={isAr ? '4 أحرف أو أرقام على الأقل' : 'Minimum 4 caractères ou chiffres'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#c94b30]"
              />
            </div>
          </div>

          {/* Couleur */}
          <div>
            <span className="mb-1.5 block text-xs font-bold text-slate-700">
              {isAr ? 'لون البطاقة' : 'Couleur du profil'}
            </span>
            <div className="flex flex-wrap gap-2">
              {(['terracotta', 'petrol', 'emerald', 'amber', 'indigo', 'rose', 'sky', 'slate'] as ProfileAvatarColor[]).map(
                c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    aria-label={c}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer ${
                      PROFILE_AVATAR_STYLES[c]
                    } ${formColor === c ? 'ring-2 ring-[#25434c] ring-offset-2' : 'opacity-75 hover:opacity-100'}`}
                  >
                    {formColor === c && <Check className="h-4 w-4" />}
                  </button>
                )
              )}
            </div>
          </div>

          {!editingIsOwner ? (
            <>
              {/* Modèles rapides */}
              <div>
                <span className="mb-1.5 block text-xs font-bold text-slate-700">
                  {isAr ? 'قالب سريع للصلاحيات' : 'Modèle rapide de rôle'}
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: 'educatrice' as const, fr: 'Éducatrice', ar: 'مربية' },
                    { id: 'accueil' as const, fr: 'Accueil / Bureau', ar: 'استقبال' },
                    { id: 'cuisine' as const, fr: 'Cuisine / Repas', ar: 'مطعم' },
                    { id: 'custom' as const, fr: 'Sur mesure', ar: 'مخصص' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyPreset(item.id)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        formPreset === item.id
                          ? 'border-[#25434c] bg-[#25434c] text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isAr ? item.ar : item.fr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrice granulaire : CHAQUE PAGE + SES PERMISSIONS */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#25434c]">
                    {isAr
                      ? `الوصول والصلاحيات حسب كل صفحة (${enabledPageCount} مفعّلة)`
                      : `Accès et permissions par page (${enabledPageCount} activée(s))`}
                  </span>
                </div>

                <div className="space-y-2">
                  {PAGE_PERMISSION_CATALOG.map(mod => {
                    const currentPerms = formPagePerms[mod.key] || [];
                    const isEnabled = currentPerms.includes('view');
                    const actionPerms = mod.permissions.filter(p => p.id !== 'view');

                    return (
                      <div
                        key={mod.key}
                        className={`rounded-2xl border p-3 transition ${
                          isEnabled
                            ? 'border-[#25434c]/30 bg-[#fdfaf7]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex cursor-pointer items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => togglePageEnabled(mod.key)}
                              className="h-4 w-4 shrink-0 accent-[#c94b30]"
                            />
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {isAr ? mod.ar : mod.fr}
                            </span>
                            {mod.sensitive && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                {isAr ? 'حساس / مالي' : 'Direction'}
                              </span>
                            )}
                          </label>

                          {isEnabled && actionPerms.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                selectAllPagePerms(
                                  mod.key,
                                  mod.permissions.map(p => p.id)
                                )
                              }
                              className="min-h-0 text-[11px] font-bold text-[#c94b30] hover:underline cursor-pointer"
                            >
                              {isAr ? 'تحديد الكل' : 'Tout autoriser'}
                            </button>
                          )}
                        </div>

                        {/* Sous-permissions propres à cette page */}
                        {isEnabled && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-2.5">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                              <Check className="h-3 w-3" />
                              {isAr ? 'عرض وقراءة' : 'Lecture / Consultation'}
                            </span>

                            {actionPerms.map(perm => {
                              const checked = currentPerms.includes(perm.id);
                              return (
                                <button
                                  key={perm.id}
                                  type="button"
                                  onClick={() => toggleSpecificPermission(mod.key, perm.id)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                                    checked
                                      ? 'border-[#25434c] bg-[#25434c] text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <span
                                    className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                                      checked ? 'border-white bg-white/20' : 'border-slate-300'
                                    }`}
                                  >
                                    {checked && <Check className="h-2.5 w-2.5" />}
                                  </span>
                                  <span>{isAr ? perm.ar : perm.fr}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Limitation par classes */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {isAr ? 'الأقسام المسموح لهذا الحساب برؤيتها' : 'Classes visibles par ce profil'}
                  </span>
                  <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setRestrictClasses(false)}
                      className={`min-h-0 rounded-md px-2.5 py-1 cursor-pointer ${
                        !restrictClasses ? 'bg-[#25434c] text-white' : 'text-slate-600'
                      }`}
                    >
                      {isAr ? 'كل الأقسام' : 'Toutes les classes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestrictClasses(true)}
                      className={`min-h-0 rounded-md px-2.5 py-1 cursor-pointer ${
                        restrictClasses ? 'bg-[#25434c] text-white' : 'text-slate-600'
                      }`}
                    >
                      {isAr ? 'أقسام محددة' : 'Classes choisies'}
                    </button>
                  </div>
                </div>

                {restrictClasses &&
                  (crecheClasses.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {crecheClasses.map((cls: any) => {
                        const selected = formClassIds.includes(cls.id);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => toggleClassId(cls.id)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                              selected
                                ? 'border-[#c94b30] bg-[#c94b30] text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {cls.nom}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {isAr ? 'لا توجد أقسام منشأة بعد.' : 'Aucune classe créée pour le moment.'}
                    </p>
                  ))}
              </div>

              {/* Masquage financier */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={formHideFinancials}
                  onChange={e => setFormHideFinancials(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#c94b30]"
                />
                <span>
                  <strong className="font-bold text-slate-900">
                    {isAr ? 'إخفاء المبالغ المالية والفواتير' : 'Masquer les montants financiers et factures'}
                  </strong>{' '}
                  —{' '}
                  {isAr
                    ? 'يمنع ظهور الفواتير والمشتريات داخل ملفات الأطفال والبحث.'
                    : 'masque les montants et l’onglet paiements jusque dans les fiches enfants.'}
                </span>
              </label>
            </>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c94b30]" />
              <span>
                {isAr
                  ? 'هذا هو حساب الإدارة الرئيسي للروضة: يحتفظ دائماً بجميع الصلاحيات على كل الصفحات والأقسام، وهو الوحيد المخول بإدارة حسابات الفريق.'
                  : 'Ce profil est l’administrateur principal de la crèche : il conserve toutes les permissions sur toutes les pages et reste le seul habilité à gérer les accès de l’équipe.'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {initialProfile && !editingIsOwner ? (
            <button
              type="button"
              onClick={async () => {
                await deleteSubProfile(initialProfile.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isAr ? 'حذف الحساب' : 'Supprimer ce profil'}</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Annuler'}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#c94b30] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#b53f26] disabled:opacity-50 cursor-pointer"
            >
              {isAr ? 'حفظ الصلاحيات' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Panneau complet de gestion des profils d'équipe et permissions par page.
 * Réservé exclusivement au profil Administrateur Crèche (`isOwnerProfile === true`),
 * affiché dans Équipe (`Personnel.tsx`) et dans `Parametres.tsx`.
 */
export default function TeamAccessManager() {
  const { user } = useAuth();
  const db = useContext(DbContext);
  const allClasses = db?.classes || [];
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { profiles, isOwnerProfile } = useWorkspaceProfile();

  const [editorTarget, setEditorTarget] = useState<WorkspaceSubProfile | 'new' | null>(null);

  if (user?.role !== 'directeur' || !isOwnerProfile) {
    return null;
  }

  const classMap = new Map(allClasses.map(c => [c.id, c.nom]));

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f7efe7] text-[#c94b30]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#25434c]">
              {isAr
                ? 'حسابات الفريق وصلاحيات كل صفحة'
                : 'Profils d’équipe & permissions par page'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAr
                ? 'حساب واحد للمؤسسة: أنشئي حساباً لكل مربية أو موظفة بكلمة مرور مستقلة وصلاحيات دقيقة لكل صفحة.'
                : 'Un seul compte crèche : créez un profil protégé par mot de passe pour chaque membre et choisissez ses droits exacts sur chaque page.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditorTarget('new')}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#c94b30] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#b53f26] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{isAr ? 'إضافة حساب للفريق' : 'Ajouter un profil'}</span>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map(profile => {
          const perms = normalizeProfilePermissions(profile);
          const pageKeys = Object.keys(perms);
          const classNames =
            profile.allowedClassIds && profile.allowedClassIds.length > 0
              ? profile.allowedClassIds.map(id => classMap.get(id) || id).join(', ')
              : isAr
                ? 'جميع الأقسام'
                : 'Toutes les classes';

          return (
            <div
              key={profile.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#fcfdff] p-4 transition hover:border-[#c94b30]/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold shadow-xs ${
                        PROFILE_AVATAR_STYLES[profile.color] || PROFILE_AVATAR_STYLES.terracotta
                      }`}
                    >
                      {getProfileInitials(profile.name)}
                      {profile.isOwner && (
                        <span className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 ring-2 ring-white">
                          <Crown className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{profile.name}</p>
                      <p className="truncate text-xs text-slate-500">{profile.roleLabel}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditorTarget(profile)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#25434c] hover:bg-slate-50 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{isAr ? 'الصلاحيات' : 'Gérer'}</span>
                  </button>
                </div>

                <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-[#c94b30]" />
                    <span>
                      {profile.passwordHash
                        ? isAr
                          ? 'كلمة المرور مفعّلة'
                          : 'Mot de passe configuré'
                        : isAr
                          ? 'لم يتم تحديد كلمة مرور بعد'
                          : 'Mot de passe à définir'}
                    </span>
                  </p>
                  <p className="truncate">
                    <strong className="text-slate-800">{isAr ? 'الأقسام:' : 'Classes :'}</strong> {classNames}
                  </p>
                  <p>
                    <strong className="text-slate-800">{isAr ? 'الوصول:' : 'Accès :'}</strong>{' '}
                    {profile.isOwner
                      ? isAr
                        ? 'إدارة كاملة لجميع الصفحات'
                        : 'Accès administrateur complet'
                      : isAr
                        ? `${pageKeys.length} صفحة مفعّلة`
                        : `${pageKeys.length} page(s) autorisée(s)`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editorTarget && (
        <ProfilePermissionEditorModal
          initialProfile={editorTarget === 'new' ? null : editorTarget}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </section>
  );
}
