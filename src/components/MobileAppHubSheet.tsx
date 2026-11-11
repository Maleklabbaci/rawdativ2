import { useEffect } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronRight,
  CreditCard,
  Headset,
  Layers,
  LogOut,
  Network,
  Palette,
  Phone,
  QrCode,
  Search,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LEGAL_CONFIG } from '../config/legal';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import { prefetchRouteChunk } from '../utils/routePrefetch';

interface MobileAppHubSheetProps {
  isOpen: boolean;
  currentPage: string;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onOpenQuickSearch: () => void;
  onLogout?: () => void;
}

export default function MobileAppHubSheet({
  isOpen,
  currentPage,
  onClose,
  onNavigate,
  onOpenQuickSearch,
  onLogout,
}: MobileAppHubSheetProps) {
  const { user } = useAuth();
  const {
    comptes = [],
    demandesAdmission = [],
    communityFeatures = [],
    notifications = [],
  } = useDb();
  const { language } = useLanguage();
  const { activeProfile, canAccessPage, lockProfile } = useWorkspaceProfile();
  const isArabic = language === 'ar';

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!user || (user.role === 'directeur' && user.approvalStatus === 'pending')) {
    return null;
  }

  const isAdmin = user.role === 'admin';

  const pendingAdmissions = isAdmin
    ? 0
    : demandesAdmission.filter(req => req.crecheId === user.id && req.statut === 'en_attente').length;

  const unreadSocial = communityFeatures.filter(
    feature =>
      (feature.kind === 'private_message' || feature.kind === 'social_notification') &&
      feature.recipientId === user.id &&
      feature.payload?.read !== true
  ).length;

  const unreadAnnouncements = isAdmin
    ? 0
    : notifications.filter(
        notif =>
          (notif.recipientRole === 'all_directeurs' ||
            notif.recipientRole === user.id ||
            notif.recipientIds?.includes(user.id)) &&
          !(notif.readBy || []).includes(user.id)
      ).length;

  const go = (page: string) => {
    onClose();
    onNavigate(page);
  };

  const modules = isAdmin
    ? [
        { key: 'community', label: 'Rawdha Connect', icon: Network, badge: unreadSocial },
        { key: 'parametres', label: isArabic ? 'الإعدادات' : 'Paramètres', icon: Settings, badge: 0 },
      ]
    : [
        { key: 'repas', label: isArabic ? 'الوجبات' : 'Repas', icon: Utensils, badge: 0 },
        { key: 'activites', label: isArabic ? 'الأنشطة' : 'Activités', icon: Palette, badge: 0 },
        { key: 'classes', label: isArabic ? 'الأقسام' : 'Classes', icon: Layers, badge: 0 },
        { key: 'achats', label: isArabic ? 'المصاريف' : 'Achats', icon: ShoppingCart, badge: 0 },
        { key: 'personnel', label: isArabic ? 'الفريق' : 'Équipe', icon: UserCheck, badge: 0 },
        { key: 'admissions', label: isArabic ? 'القبول' : 'Admissions', icon: QrCode, badge: pendingAdmissions },
        { key: 'rapports', label: isArabic ? 'التقارير' : 'Rapports', icon: BarChart3, badge: 0 },
        { key: 'communication', label: isArabic ? 'مراسلة الأولياء' : 'Parents', icon: Phone, badge: 0 },
        { key: 'notifications', label: isArabic ? 'الإعلانات' : 'Annonces', icon: Bell, badge: unreadAnnouncements },
        { key: 'community', label: 'Rawdha Connect', icon: Network, badge: unreadSocial },
        { key: 'parametres', label: isArabic ? 'الإعدادات' : 'Paramètres', icon: Settings, badge: 0 },
        { key: 'aide', label: isArabic ? 'الدليل' : 'Guide', icon: BookOpen, badge: 0 },
        { key: 'support', label: isArabic ? 'الدعم' : 'Support', icon: Headset, badge: 0 },
      ].filter(mod => canAccessPage(mod.key));

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 flex items-end justify-center lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={isArabic ? 'قائمة الوحدات' : 'Menu des modules'}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            className="relative z-10 flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            {/* En-tête simple */}
            <div className="shrink-0 border-b border-slate-100 px-4 pt-2.5 pb-3">
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300" />
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold text-slate-900">
                  {isArabic ? 'القائمة' : 'Menu'}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenQuickSearch();
                  }}
                  className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-start text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-white cursor-pointer"
                >
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {isArabic ? 'بحث عن طفل أو ولي أمر…' : 'Chercher un enfant ou un parent…'}
                  </span>
                </button>
              )}
            </div>

            {/* Grille calme 2 colonnes */}
            <div className="overflow-y-auto overscroll-contain p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {modules.map(mod => {
                  const Icon = mod.icon;
                  const active = currentPage === mod.key;
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onTouchStart={() => prefetchRouteChunk(mod.key)}
                      onPointerEnter={() => prefetchRouteChunk(mod.key)}
                      onClick={() => go(mod.key)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition cursor-pointer ${
                        active
                          ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700'
                          : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">{mod.label}</span>
                      {mod.badge > 0 && (
                        <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                          {mod.badge > 99 ? '99+' : mod.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {(onLogout || !isAdmin) && (
                <div className="border-t border-slate-100 pt-2 space-y-2">
                  {!isAdmin && activeProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        lockProfile();
                      }}
                      className="min-h-9! flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {isArabic
                          ? `تبديل الحساب (${activeProfile.name})`
                          : `Changer de profil (${activeProfile.name})`}
                      </span>
                    </button>
                  )}

                  {!isAdmin && (!activeProfile || activeProfile.isOwner || canAccessPage('parametres')) && (() => {
                    const liveDirector = comptes.find(item => item.id === user.id) || user;
                    const endRaw = liveDirector?.dateFinAbonnement;
                    let shortEnd = '';
                    if (endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
                      const endDate = new Date(`${endRaw}T00:00:00`);
                      if (!Number.isNaN(endDate.getTime())) {
                        const dd = String(endDate.getDate()).padStart(2, '0');
                        const mm = String(endDate.getMonth() + 1).padStart(2, '0');
                        const yy = String(endDate.getFullYear()).slice(-2);
                        shortEnd = `${dd}/${mm}/${yy}`;
                      }
                    }
                    const priceLabel = `${LEGAL_CONFIG.monthlyPlanPriceDzd.toLocaleString('fr-FR')} ${isArabic ? 'د.ج' : 'DA'}`;
                    const lineLabel = shortEnd
                      ? (isArabic ? `الاشتراك · ${shortEnd} · ${priceLabel}` : `Abonnement · ${shortEnd} · ${priceLabel}`)
                      : (isArabic ? `الاشتراك · تجريبي · ${priceLabel}` : `Abonnement · Essai · ${priceLabel}`);
                    return (
                      <button
                        type="button"
                        onTouchStart={() => prefetchRouteChunk('abonnement')}
                        onPointerEnter={() => prefetchRouteChunk('abonnement')}
                        onClick={() => go('abonnement')}
                        className="min-h-9! flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-indigo-200/80 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-indigo-50/70 hover:text-indigo-700 cursor-pointer"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          <span className="min-w-0 truncate whitespace-nowrap">{lineLabel}</span>
                        </span>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 ${isArabic ? 'rotate-180' : ''}`} />
                      </button>
                    );
                  })()}

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{isArabic ? 'تسجيل الخروج' : 'Se déconnecter'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
