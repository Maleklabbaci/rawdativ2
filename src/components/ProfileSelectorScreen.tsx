import React, { useContext, useMemo, useState } from 'react';
import {
  Building2,
  Crown,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DbContext } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useWorkspaceProfile,
  type WorkspaceSubProfile,
} from '../contexts/WorkspaceProfileContext';
import {
  getProfileInitials,
  PROFILE_AVATAR_STYLES,
  ProfilePermissionEditorModal,
} from './TeamAccessManager';

export default function ProfileSelectorScreen() {
  const { user, logout } = useAuth();
  const db = useContext(DbContext);
  const allClasses = db?.classes || [];
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';

  const {
    profiles,
    unlockProfile,
    setupOwnerPasswordAndUnlock,
    verifyOwnerPassword,
  } = useWorkspaceProfile();

  const ownerHasPassword = Boolean(profiles.find(p => p.isOwner)?.passwordHash);

  const crecheClasses = useMemo(
    () => allClasses.filter((cls: any) => !user?.id || !cls.crecheId || cls.crecheId === user.id),
    [allClasses, user?.id]
  );

  // Déverrouillage d'un profil existant
  const [selectedForUnlock, setSelectedForUnlock] = useState<WorkspaceSubProfile | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  // Première définition du mot de passe Direction
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupPwd, setSetupPwd] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  // Vérification Admin Crèche avant ajout rapide d'un profil depuis cet écran
  const [ownerGateOpen, setOwnerGateOpen] = useState(false);
  const [ownerGatePwd, setOwnerGatePwd] = useState('');
  const [ownerGateError, setOwnerGateError] = useState('');
  const [createProfileModalOpen, setCreateProfileModalOpen] = useState(false);

  const handleProfileClick = (profile: WorkspaceSubProfile) => {
    setUnlockError('');
    setUnlockPassword('');
    if (profile.isOwner && !profile.passwordHash) {
      setSetupPwd('');
      setSetupConfirm('');
      setSetupError('');
      setSetupOpen(true);
      return;
    }
    setSelectedForUnlock(profile);
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForUnlock || unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError('');
    try {
      const res = await unlockProfile(selectedForUnlock.id, unlockPassword);
      if (!res.ok) {
        setUnlockError(
          isAr
            ? 'كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.'
            : 'Mot de passe incorrect. Veuillez réessayer.'
        );
      } else {
        setSelectedForUnlock(null);
        setUnlockPassword('');
      }
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleSetupOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupBusy) return;
    if (setupPwd.trim().length < 4) {
      setSetupError(
        isAr
          ? 'يجب أن تتكون كلمة مرور الإدارة من 4 أحرف أو أرقام على الأقل.'
          : 'Le mot de passe Direction doit contenir au moins 4 caractères ou chiffres.'
      );
      return;
    }
    if (setupPwd.trim() !== setupConfirm.trim()) {
      setSetupError(
        isAr ? 'كلمتا المرور غير متطابقتين.' : 'Les deux mots de passe ne correspondent pas.'
      );
      return;
    }
    setSetupBusy(true);
    setSetupError('');
    try {
      const res = await setupOwnerPasswordAndUnlock(setupPwd);
      if (!res.ok) {
        setSetupError(isAr ? 'تعذر حفظ كلمة المرور.' : 'Impossible d’enregistrer le mot de passe.');
      } else {
        setSetupOpen(false);
      }
    } catch {
      setSetupError(isAr ? 'تعذر حفظ كلمة المرور. تحققي من الاتصال وحاولي مجدداً.' : 'Impossible d’enregistrer le code. Vérifiez la connexion puis réessayez.');
    } finally {
      setSetupBusy(false);
    }
  };

  const handleAddProfileClick = () => {
    if (!ownerHasPassword) {
      setSetupPwd('');
      setSetupConfirm('');
      setSetupError(
        isAr
          ? 'أنشئي أولاً كلمة مرور الإدارة لحماية إعدادات الصلاحيات.'
          : 'Créez d’abord votre mot de passe Direction afin de sécuriser la gestion des profils.'
      );
      setSetupOpen(true);
      return;
    }
    setOwnerGatePwd('');
    setOwnerGateError('');
    setOwnerGateOpen(true);
  };

  const handleOwnerGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyOwnerPassword(ownerGatePwd);
    if (!ok) {
      setOwnerGateError(
        isAr
          ? 'كلمة مرور الإدارة غير صحيحة.'
          : 'Mot de passe Direction incorrect.'
      );
      return;
    }
    setOwnerGateOpen(false);
    setCreateProfileModalOpen(true);
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#fcfdff] text-slate-900 flex flex-col justify-between selection:bg-[#c94b30]/15 selection:text-[#c94b30]"
    >
      {/* En-tête identique à l'univers LandingPage / SignIn */}
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/rawdah-logo.png"
              alt="Rawdha+"
              className="h-10 w-auto shrink-0 object-contain sm:h-11"
            />
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-xs sm:text-sm font-extrabold text-[#25434c]">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[#c94b30]" />
                <span className="truncate">
                  {user?.crecheNom || user?.name || (isAr ? 'فضاء الروضة' : 'Espace Crèche')}
                </span>
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {isAr ? 'اختيار الحساب الشخصي' : 'Sélection du profil d’équipe'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(isAr ? 'fr' : 'ar')}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#25434c] transition hover:bg-slate-100 cursor-pointer"
            >
              {isAr ? 'FR' : 'عربي'}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isAr ? 'تسجيل الخروج' : 'Déconnexion crèche'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Zone centrale chaleureuse & épurée */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-14">
        <div className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#ebcbb9] bg-[#f7efe7] px-3 py-1 text-[11px] font-bold text-[#c94b30]">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {isAr
              ? 'حساب المؤسسة · صلاحيات حسب الملف'
              : 'Compte crèche · Permissions sur mesure'}
          </span>
        </div>

        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[#25434c] sm:text-4xl">
          {isAr ? 'من يستخدم فضاء الروضة الآن؟' : 'Qui utilise l’espace crèche\u00A0?'}
        </h1>
        <p className="mt-2 max-w-lg text-center text-xs sm:text-sm text-slate-600">
          {isAr
            ? 'اختاري حسابك وأدخلي كلمة المرور الخاصة بك للوصول إلى أقسامك وصفحاتك المسموح بها.'
            : 'Choisissez votre profil et saisissez votre mot de passe personnel pour ouvrir votre espace.'}
        </p>

        {/* Grille centrée des profils */}
        <div className="mt-8 flex w-full max-w-4xl flex-wrap items-stretch justify-center gap-4 sm:mt-10 sm:gap-5">
          {profiles.map(profile => {
            const avatarClass =
              PROFILE_AVATAR_STYLES[profile.color] || PROFILE_AVATAR_STYLES.terracotta;
            const restrictedCount = profile.allowedClassIds?.length || 0;
            const restrictedNames =
              restrictedCount > 0
                ? crecheClasses
                    .filter((c: any) => profile.allowedClassIds?.includes(c.id))
                    .map((c: any) => c.nom)
                : [];

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileClick(profile)}
                className="group relative flex w-[calc(50%-0.5rem)] max-w-[205px] sm:w-[195px] flex-col items-center rounded-3xl border border-slate-200/90 bg-white p-5 text-center shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-[#c94b30]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b30] cursor-pointer"
              >
                <div
                  className={`relative flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center rounded-3xl text-xl sm:text-2xl font-extrabold shadow-sm transition group-hover:scale-[1.03] ${avatarClass}`}
                >
                  <span>{getProfileInitials(profile.name)}</span>
                  {profile.isOwner && (
                    <span
                      title={isAr ? 'إدارة الروضة' : 'Admin Crèche'}
                      className="absolute -top-2 -end-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xs ring-2 ring-white"
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <span className="mt-3.5 line-clamp-1 text-sm sm:text-base font-extrabold text-[#25434c] group-hover:text-[#c94b30]">
                  {profile.name}
                </span>

                <span className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">
                  {profile.roleLabel}
                </span>

                <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-[#faf6f2] px-2.5 py-1 text-[11px] font-bold text-[#25434c]">
                  <Lock className="h-3 w-3 text-[#c94b30]" />
                  {profile.isOwner && !profile.passwordHash
                    ? isAr
                      ? 'تفعيل الرمز'
                      : 'Créer le code'
                    : restrictedCount > 0
                      ? restrictedNames.length === 1
                        ? restrictedNames[0]
                        : isAr
                          ? `${restrictedCount} أقسام`
                          : `${restrictedCount} classes`
                      : profile.isOwner
                        ? isAr
                          ? 'إدارة كاملة'
                          : 'Admin crèche'
                        : isAr
                          ? 'مفعل'
                          : 'Protégé'}
                </span>
              </button>
            );
          })}

          {/* Carte d'ajout rapide réservée à l'Admin Crèche */}
          <button
            type="button"
            onClick={handleAddProfileClick}
            className="group flex w-[calc(50%-0.5rem)] max-w-[205px] sm:w-[195px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#decbc0] bg-[#faf6f2]/70 p-5 text-center transition hover:border-[#c94b30] hover:bg-[#f7efe7] cursor-pointer"
          >
            <div className="flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center rounded-3xl bg-white text-[#c94b30] shadow-2xs ring-1 ring-[#ebcbb9] transition group-hover:scale-[1.03]">
              <Plus className="h-8 w-8" />
            </div>
            <span className="mt-3.5 text-sm font-extrabold text-[#25434c]">
              {isAr ? 'إضافة حساب' : 'Ajouter un profil'}
            </span>
            <span className="mt-0.5 text-[11px] text-slate-500">
              {isAr ? 'خاص بإدارة الروضة' : 'Réservé Admin crèche'}
            </span>
          </button>
        </div>
      </main>

      {/* Pied de page discret indiquant où gérer les permissions */}
      <footer className="border-t border-slate-200/70 bg-white px-4 py-3.5 text-center text-xs text-slate-500">
        {isAr
          ? 'تُدار الحسابات وصلاحيات كل صفحة من طرف مديرة الروضة في قسم «الفريق» أو «الإعدادات».'
          : 'Les profils et les permissions de chaque page se gèrent par l’Admin de la crèche dans « Équipe » ou « Paramètres ».'}
      </footer>

      {/* MODALE 1 : Saisie du mot de passe d'ouverture */}
      {selectedForUnlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          onClick={() => setSelectedForUnlock(null)}
        >
          <form
            onSubmit={handleUnlockSubmit}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold ${
                    PROFILE_AVATAR_STYLES[selectedForUnlock.color] || PROFILE_AVATAR_STYLES.terracotta
                  }`}
                >
                  {getProfileInitials(selectedForUnlock.name)}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#25434c]">{selectedForUnlock.name}</h2>
                  <p className="text-xs text-slate-500">{selectedForUnlock.roleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForUnlock(null)}
                aria-label={isAr ? 'إغلاق' : 'Fermer'}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <label
                htmlFor="subprofile-unlock-pwd"
                className="mb-1.5 block text-xs font-bold text-slate-700"
              >
                {isAr ? 'كلمة مرور الحساب' : 'Mot de passe personnel'}
              </label>
              <input
                id="subprofile-unlock-pwd"
                type="password"
                autoFocus
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                placeholder={isAr ? 'أدخلي كلمة المرور...' : 'Votre mot de passe...'}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#c94b30]"
                required
              />
              {unlockError && (
                <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
                  {unlockError}
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedForUnlock(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="submit"
                disabled={unlockBusy || !unlockPassword.trim()}
                className="rounded-xl bg-[#c94b30] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#b53f26] disabled:opacity-50 cursor-pointer"
              >
                {isAr ? 'دخول' : 'Ouvrir ma session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE 2 : Première définition du mot de passe Admin Crèche */}
      {setupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          onClick={() => setSetupOpen(false)}
        >
          <form
            onSubmit={handleSetupOwnerSubmit}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f7efe7] text-[#c94b30]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#25434c]">
                    {isAr ? 'حماية حساب مديرة الروضة' : 'Sécuriser le profil Admin Crèche'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? 'يمنع المربيات من تعديل الصلاحيات أو فتح الإدارة والمالية'
                      : 'Protège les finances et l’attribution des permissions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSetupOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Fermer'}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  {isAr ? 'كلمة مرور الإدارة الجديدة' : 'Nouveau mot de passe Direction'}
                </label>
                <input
                  type="password"
                  autoFocus
                  value={setupPwd}
                  onChange={e => setSetupPwd(e.target.value)}
                  placeholder={isAr ? '4 أحرف أو أرقام على الأقل' : 'Minimum 4 caractères ou chiffres'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#c94b30]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  {isAr ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}
                </label>
                <input
                  type="password"
                  value={setupConfirm}
                  onChange={e => setSetupConfirm(e.target.value)}
                  placeholder={isAr ? 'أعيدي كتابة الرمز' : 'Répétez le mot de passe'}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#c94b30]"
                  required
                />
              </div>
              {setupError && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {setupError}
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSetupOpen(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="submit"
                disabled={setupBusy}
                className="rounded-xl bg-[#c94b30] px-4 py-2 text-xs font-bold text-white hover:bg-[#b53f26] disabled:opacity-50 cursor-pointer"
              >
                {isAr ? 'حفظ والدخول' : 'Enregistrer et ouvrir'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE 3 : Vérification mot de passe Admin Crèche avant ajout rapide */}
      {ownerGateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          onClick={() => setOwnerGateOpen(false)}
        >
          <form
            onSubmit={handleOwnerGateSubmit}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 className="text-base font-extrabold text-[#25434c]">
              {isAr ? 'تأكيد هوية مديرة الروضة' : 'Confirmation Admin Crèche'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isAr
                ? 'أدخلي كلمة مرور الإدارة لإضافة حساب جديد للفريق.'
                : 'Saisissez le mot de passe Direction pour créer un profil et définir ses permissions.'}
            </p>
            <input
              type="password"
              autoFocus
              value={ownerGatePwd}
              onChange={e => setOwnerGatePwd(e.target.value)}
              placeholder={isAr ? 'كلمة مرور الإدارة...' : 'Mot de passe Direction...'}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#c94b30]"
              required
            />
            {ownerGateError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
                {ownerGateError}
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOwnerGateOpen(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#25434c] px-4 py-2 text-xs font-bold text-white hover:bg-[#1c343b] cursor-pointer"
              >
                {isAr ? 'متابعة' : 'Continuer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE 4 : Création complète d'un profil avec permissions par page */}
      {createProfileModalOpen && (
        <ProfilePermissionEditorModal
          initialProfile={null}
          onClose={() => setCreateProfileModalOpen(false)}
        />
      )}
    </div>
  );
}
