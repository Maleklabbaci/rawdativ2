import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useOptionalToast } from '../contexts/ToastContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { LEGAL_CONFIG } from '../config/legal';
import {
  getPendingSlickPayOrder,
  type PendingSlickPayOrder,
} from '../utils/slickpayPending';
import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Activity,
  Loader2,
  Baby,
  ClipboardList,
  School,
  CalendarCheck,
  CreditCard,
  ChevronRight,
  ShoppingCart,
  UserCheck,
  Palette,
  Utensils,
  Settings,
  User,
  Crown,
  MessageCircle,
  BarChart3,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';

type NavigationItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export default function Sidebar({
  currentPage,
  activeTab,
  onPageChange,
  setActiveTab,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: {
  currentPage?: string;
  activeTab?: string;
  onPageChange?: (page: string) => void;
  setActiveTab?: (page: string) => void;
  isOpen: boolean;
  onClose?: () => void;
  setIsOpen?: (open: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { user, creche } = useAuth();
  const {
    communityFeatures = [],
    demandesAdmission = [],
    demandesDirecteur = [],
    comptes = [],
    enfants = [],
    presences = [],
    paiements = [],
  } = useDb();
  const { language, t } = useLanguage();
  const optionalToast = useOptionalToast();
  const { activeProfile, canAccessPage, lockProfile } = useWorkspaceProfile();
  const isArabic = language === 'ar';

  const activePage = currentPage ?? activeTab ?? 'dashboard';
  const handleSelectPage = onPageChange ?? setActiveTab;

  const [pendingSlickPay, setPendingSlickPay] = useState<PendingSlickPayOrder | null>(() =>
    user?.role === 'directeur' ? getPendingSlickPayOrder(user.id) : null
  );

  useEffect(() => {
    if (!user?.id || user.role !== 'directeur') {
      setPendingSlickPay(null);
      return;
    }
    const sync = () => setPendingSlickPay(getPendingSlickPayOrder(user.id));
    sync();
    window.addEventListener('rawdha-slickpay-pending-changed', sync);
    window.addEventListener('rawdha-subscription-activated', sync);
    return () => {
      window.removeEventListener('rawdha-slickpay-pending-changed', sync);
      window.removeEventListener('rawdha-subscription-activated', sync);
    };
  }, [user?.id, user?.role]);

  // L'écoute active en arrière-plan est assurée globalement par `App.tsx` et `AbonnementPaiement.tsx` ;
  // `Sidebar` affiche uniquement l'indicateur temps réel sur `#sidebar-subscription-line`.

  const unreadSocialMessages = communityFeatures.filter(
    feature => feature.kind === 'private_message' && feature.recipientId === user?.id && feature.payload?.read !== true,
  ).length;
  const unreadSocialNotifications = communityFeatures.filter(
    feature => feature.kind === 'social_notification' && feature.recipientId === user?.id && feature.payload?.read !== true,
  ).length;
  const socialBadgeCount = unreadSocialMessages + unreadSocialNotifications;

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().split('T')[0];
  const myChildren =
    user?.role === 'directeur' ? enfants.filter(child => child.crecheId === user.id && child.statut === 'Actif') : [];
  const childIds = new Set(myChildren.map(child => child.id));
  const pointedToday = new Set(
    presences.filter(record => childIds.has(record.enfantId) && record.date === today).map(record => record.enfantId)
  );
  const remainingAttendanceCount =
    user?.role === 'directeur' ? myChildren.filter(child => !pointedToday.has(child.id)).length : 0;
  const pendingInvoicesCount =
    user?.role === 'directeur'
      ? paiements.filter(inv => childIds.has(inv.enfantId) && (inv.statut === 'En attente' || inv.statut === 'Retard'))
          .length
      : 0;

  const pendingAdmissionsCount =
    user?.role === 'directeur'
      ? demandesAdmission.filter(item => item.crecheId === user.id && item.statut === 'en_attente').length
      : 0;
  const pendingDirectorsCount =
    user?.role === 'admin'
      ? demandesDirecteur.filter(item => item.statut === 'en_attente').length +
        comptes.filter(acc => acc.role === 'directeur' && acc.approvalStatus === 'pending').length
      : 0;

  const primaryItems: NavigationItem[] =
    user?.role === 'admin'
      ? [
          { key: 'admin', label: 'admin', icon: Crown },
          { key: 'comptes', label: 'comptes', icon: User },
          { key: 'logs', label: 'logs', icon: Activity },
          { key: 'communication', label: 'communication', icon: MessageCircle },
        ]
      : user?.role === 'directeur'
        ? [
            { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard },
            { key: 'presences', label: 'attendance', icon: CalendarCheck },
            { key: 'enfants', label: 'children', icon: Baby },
            { key: 'paiements', label: 'invoices', icon: CreditCard },
            { key: 'classes', label: 'classes', icon: School },
            { key: 'repas', label: 'meals', icon: Utensils },
            { key: 'activites', label: 'activities', icon: Palette },
            { key: 'personnel', label: 'staff', icon: UserCheck },
            { key: 'achats', label: 'purchases', icon: ShoppingCart },
            { key: 'admissions', label: 'admissions', icon: ClipboardList },
            { key: 'rapports', label: 'reports', icon: BarChart3 },
            { key: 'communication', label: 'communication', icon: MessageCircle },
          ].filter(item => canAccessPage(item.key))
        : [];

  const getTabLabel = (key: string, originalLabel: string) => {
    if (key === 'logs') return isArabic ? 'السجل والأحداث' : 'Historique & logs';
    if (key === 'admin') return isArabic ? 'مركز الإدارة' : 'Pilotage';
    if (key === 'comptes' && user?.role === 'admin') return isArabic ? 'مدراء الروضات' : 'Comptes crèches';
    if (key === 'admissions') return isArabic ? 'طلبات التسجيل' : 'Admissions';
    if (key === 'community') return 'Rawdha Connect';
    if (key === 'communication')
      return user?.role === 'directeur'
        ? isArabic
          ? 'التواصل مع العائلات'
          : 'Communication'
        : isArabic
          ? 'الرسائل والملاحظات'
          : 'Messages & retours';
    return t(originalLabel);
  };

  const activate = (key: string) => {
    handleSelectPage?.(key);
    onClose?.();
  };

  const handleLogoClick = () => {
    if (window.innerWidth >= 1024) onToggleCollapse?.();
    else onClose?.();
  };

  const topFilletBackground = isArabic
    ? 'radial-gradient(circle at 100% 0, transparent 18px, #f8fafc 18.5px)'
    : 'radial-gradient(circle at 0 0, transparent 18px, #f8fafc 18.5px)';
  const bottomFilletBackground = isArabic
    ? 'radial-gradient(circle at 100% 100%, transparent 18px, #f8fafc 18.5px)'
    : 'radial-gradient(circle at 0 100%, transparent 18px, #f8fafc 18.5px)';

  const renderItem = (item: NavigationItem) => {
    const IconComponent = item.icon;
    const isActive = activePage === item.key;
    const label = getTabLabel(item.key, item.label);
    const badgeCount =
      item.key === 'community'
        ? socialBadgeCount
        : item.key === 'admissions'
          ? pendingAdmissionsCount
          : item.key === 'presences'
            ? remainingAttendanceCount
            : item.key === 'paiements'
              ? pendingInvoicesCount
              : item.key === 'comptes'
                ? pendingDirectorsCount
                : 0;

    return (
      <div key={item.key} className={`relative ${isCollapsed ? 'px-2 lg:ps-2 lg:pe-0' : 'ps-3 pe-2.5 lg:pe-0'}`}>
        {isActive && (
          <motion.span
            layoutId="rawdha-curved-sidebar-active"
            transition={{ type: 'spring', stiffness: 430, damping: 35 }}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 start-3 end-2.5 rounded-2xl bg-[#f8fafc] lg:end-0 lg:rounded-e-none lg:rounded-s-full ${
              isCollapsed ? 'lg:start-2' : 'lg:start-3'
            }`}
          >
            <span
              style={{ background: topFilletBackground }}
              className="hidden lg:block absolute -top-[18px] end-0 h-[18px] w-[18px]"
            />
            <span
              style={{ background: bottomFilletBackground }}
              className="hidden lg:block absolute -bottom-[18px] end-0 h-[18px] w-[18px]"
            />
          </motion.span>
        )}

        <button
          id={`sidebar-tab-${item.key}`}
          type="button"
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          title={isCollapsed ? label : undefined}
          onPointerEnter={() => prefetchRouteChunk(item.key)}
          onTouchStart={() => prefetchRouteChunk(item.key)}
          onFocus={() => prefetchRouteChunk(item.key)}
          onClick={() => activate(item.key)}
          className={`relative z-10 flex w-full items-center justify-between py-2.5 transition-colors cursor-pointer ${
            isCollapsed ? 'px-2 lg:justify-center lg:ps-2 lg:pe-3' : 'ps-4 pe-3.5 lg:pe-4'
          } ${
            isActive
              ? 'text-slate-900 font-bold'
              : 'text-slate-300/85 hover:text-white font-medium'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <IconComponent
              className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                isActive ? 'text-indigo-600 stroke-[2.3]' : 'text-slate-400'
              }`}
            />
            <span className={`truncate text-[13.5px] ${isCollapsed ? 'lg:hidden' : ''}`}>{label}</span>
          </span>
          {!isCollapsed && badgeCount > 0 && (
            <span
              className={`shrink-0 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 tabular-nums ${
                item.key === 'community'
                  ? 'bg-rose-500 text-white'
                  : isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <aside
      className={`rawdha-sidebar rawdha-sidebar-curved w-[min(17.5rem,86vw)] ${
        isCollapsed ? 'lg:w-20' : 'lg:w-64'
      } fixed top-0 z-40 flex h-[100dvh] flex-col overflow-y-auto overscroll-contain bg-[#0f172a] text-slate-200 shadow-2xl lg:shadow-none transition-[transform,width] duration-200 select-none ${
        isOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none lg:visible lg:pointer-events-auto'
      } ${
        isArabic
          ? `right-0 ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`
          : `left-0 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`
      }`}
    >
      <div className={`border-b border-slate-800/80 ${isCollapsed ? 'p-3' : 'px-4 py-3.5'}`}>
        <div className={`flex items-center justify-between gap-2 ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex min-w-0 items-center gap-2.5 text-start cursor-pointer"
            title={isArabic ? 'فتح أو طي القائمة' : 'Ouvrir ou replier le menu'}
            aria-label={isArabic ? 'فتح أو طي القائمة' : 'Ouvrir ou replier le menu'}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
              {creche?.logoUrl ? (
                <img src={creche.logoUrl} alt="Logo" className="h-full w-full object-contain bg-white p-1" />
              ) : (
                <School className="h-4.5 w-4.5" />
              )}
            </span>
            <span className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate text-base font-bold tracking-tight text-white">Rawdha+</span>
              <span className="block truncate text-[11px] font-medium text-slate-400">
                {isArabic ? 'تسيير الحضانة' : 'Gestion de crèche'}
              </span>
            </span>
          </button>

          {!isCollapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isArabic ? 'طي الشريط الجانبي' : 'Replier la barre latérale'}
              aria-label={isArabic ? 'طي الشريط الجانبي' : 'Replier la barre latérale'}
              className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/70 text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <PanelLeftClose className={`h-3.5 w-3.5 ${isArabic ? 'rotate-180' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer"
            aria-label={isArabic ? 'إغلاق القائمة' : 'Fermer le menu'}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {isCollapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isArabic ? 'توسيع الشريط الجانبي' : 'Déplier la barre latérale'}
            aria-label={isArabic ? 'توسيع الشريط الجانبي' : 'Déplier la barre latérale'}
            className="mt-2 hidden lg:flex w-full h-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-800/70 text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <PanelLeftOpen className={`h-3.5 w-3.5 ${isArabic ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <nav className="rawdha-sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-5 [@media(max-height:430px)]:py-2">
        <div className="space-y-1 [@media(max-height:430px)]:space-y-0.5">
          {primaryItems.map(item => renderItem(item))}
        </div>
      </nav>

      <div className="rawdha-sidebar-footer flex flex-col gap-1 border-t border-slate-800/80 py-3">
        {(user?.role !== 'directeur' || canAccessPage('community')) &&
          renderItem({ key: 'community', label: 'community', icon: Network })}
        {(user?.role !== 'directeur' || canAccessPage('parametres')) &&
          renderItem({ key: 'parametres', label: 'settings', icon: Settings })}
        <div className={isCollapsed ? 'px-2 pt-1 space-y-1.5' : 'px-3 pt-1 space-y-1.5'}>
          <button
            type="button"
            onClick={() => {
              if (user?.role === 'directeur' && activeProfile) {
                lockProfile();
                onClose?.();
                return;
              }
              activate('parametres');
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-800/55 p-2 text-start transition hover:bg-slate-800 cursor-pointer ${
              isCollapsed ? 'lg:justify-center' : ''
            }`}
            aria-label={
              user?.role === 'directeur' && activeProfile
                ? isArabic
                  ? 'تبديل الحساب النشط'
                  : 'Changer de profil'
                : isArabic
                  ? 'فتح إعدادات الحساب'
                  : 'Ouvrir les paramètres du compte'
            }
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300">
              {activeProfile && user?.role === 'directeur'
                ? activeProfile.name.slice(0, 2).toUpperCase()
                : user
                  ? (`${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.trim() || user.email?.[0] || 'R').toUpperCase()
                  : 'AD'}
            </span>
            <span className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate text-xs font-bold text-white">
                {activeProfile && user?.role === 'directeur'
                  ? activeProfile.name
                  : user
                    ? [user.prenom, user.nom].filter(Boolean).join(' ') || user.email
                    : 'Admin'}
              </span>
              <span className="block truncate text-[11px] text-slate-400">
                {user?.role === 'admin'
                  ? isArabic
                    ? 'مدير المنصة'
                    : 'Administrateur'
                  : activeProfile
                    ? `${activeProfile.roleLabel} · ${isArabic ? 'تبديل' : 'Changer'}`
                    : isArabic
                      ? 'مديرة الروضة'
                      : 'Direction'}
              </span>
            </span>
          </button>

          {user?.role === 'directeur' && (!activeProfile || activeProfile.isOwner || canAccessPage('parametres')) && (() => {
            const liveDirector = comptes.find(item => item.id === user.id) || user;
            const endRaw = liveDirector?.dateFinAbonnement;
            let daysLeft: number | null = null;
            let shortEnd = '';
            if (endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
              const todayMidnight = new Date();
              todayMidnight.setHours(0, 0, 0, 0);
              const endDate = new Date(`${endRaw}T00:00:00`);
              if (!Number.isNaN(endDate.getTime())) {
                daysLeft = Math.ceil((endDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
                const dd = String(endDate.getDate()).padStart(2, '0');
                const mm = String(endDate.getMonth() + 1).padStart(2, '0');
                const yy = String(endDate.getFullYear()).slice(-2);
                shortEnd = `${dd}/${mm}/${yy}`;
              }
            }
            const isUrgent = daysLeft !== null && daysLeft <= 7;
            const priceLabel = `${LEGAL_CONFIG.monthlyPlanPriceDzd.toLocaleString('fr-FR')} ${isArabic ? 'د.ج' : 'DA'}`;
            const summaryLine = pendingSlickPay
              ? (isArabic ? 'جاري تأكيد دفع SATIM…' : 'Confirmation SATIM en cours…')
              : isUrgent
                ? (isArabic
                    ? `تجديد · ${Math.max(0, daysLeft!)}ي · ${priceLabel}`
                    : `Renouveler · ${Math.max(0, daysLeft!)}j · ${priceLabel}`)
                : shortEnd
                  ? (isArabic
                      ? `الاشتراك · ${shortEnd} · ${priceLabel}`
                      : `Abonnement · ${shortEnd} · ${priceLabel}`)
                  : (isArabic
                      ? `الاشتراك · تجريبي · ${priceLabel}`
                      : `Abonnement · Essai · ${priceLabel}`);
            const isSubActivePage = activePage === 'abonnement';

            return (
              <button
                id="sidebar-subscription-line"
                type="button"
                title={summaryLine}
                aria-label={isArabic ? 'فتح صفحة الاشتراك والدفع' : 'Ouvrir la page d’abonnement et paiement'}
                onPointerEnter={() => prefetchRouteChunk('abonnement')}
                onTouchStart={() => prefetchRouteChunk('abonnement')}
                onFocus={() => prefetchRouteChunk('abonnement')}
                onClick={() => activate('abonnement')}
                className={`min-h-8! flex w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                  isCollapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  isSubActivePage
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                    : pendingSlickPay
                      ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100'
                      : isUrgent
                        ? 'border-amber-500/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800/90 hover:text-white'
                }`}
              >
                <span className={`flex min-w-0 items-center gap-1.5 ${isCollapsed ? 'lg:justify-center' : ''}`}>
                  {isCollapsed ? (
                    <CreditCard className="hidden lg:block h-4 w-4 shrink-0 text-indigo-300" />
                  ) : null}
                  {pendingSlickPay ? (
                    <Loader2 className={`h-3 w-3 shrink-0 animate-spin text-indigo-300 ${isCollapsed ? 'lg:hidden' : ''}`} />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCollapsed ? 'lg:hidden' : ''} ${
                        isSubActivePage ? 'bg-white' : isUrgent ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                  <span className={`min-w-0 truncate whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''}`}>
                    {summaryLine}
                  </span>
                </span>
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 opacity-75 ${isArabic ? 'rotate-180' : ''} ${
                    isCollapsed ? 'lg:hidden' : ''
                  }`}
                />
              </button>
            );
          })()}
        </div>
      </div>
    </aside>
  );
}
