import {
  Baby,
  Bell,
  CalendarCheck,
  CreditCard,
  Crown,
  Layers,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Palette,
  Users,
  Utensils,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import { attendanceChildren } from '../utils/attendanceGroups';
import { prefetchRouteChunk } from '../utils/routePrefetch';

interface MobileBottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
}

function localTodayKey(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().split('T')[0];
}

export default function MobileBottomNav({
  currentPage,
  onNavigate,
  onOpenMenu,
  isMenuOpen,
}: MobileBottomNavProps) {
  const { user } = useAuth();
  const {
    enfants = [],
    presences = [],
    paiements = [],
    demandesAdmission = [],
    demandesDirecteur = [],
    comptes = [],
    communityFeatures = [],
    notifications = [],
  } = useDb();
  const { language } = useLanguage();
  const { canAccessPage } = useWorkspaceProfile();
  const isArabic = language === 'ar';

  const today = localTodayKey();
  const myChildren = user?.role === 'directeur' ? enfants.filter(child => child.crecheId === user.id) : [];
  const childIds = new Set(myChildren.map(child => child.id));
  const myTodayPresences = presences.filter(record => childIds.has(record.enfantId) && record.date === today);
  const expectedToday = attendanceChildren(myChildren, myTodayPresences);
  const pointedIds = new Set(myTodayPresences.map(record => record.enfantId));
  const remainingAttendance = expectedToday.filter(child => !pointedIds.has(child.id)).length;

  const pendingInvoices =
    user?.role === 'directeur'
      ? paiements.filter(
          inv => childIds.has(inv.enfantId) && (inv.statut === 'En attente' || inv.statut === 'Retard')
        ).length
      : 0;

  const pendingAdmissions =
    user?.role === 'directeur'
      ? demandesAdmission.filter(req => req.crecheId === user.id && req.statut === 'en_attente').length
      : 0;
  const unreadSocial = user
    ? communityFeatures.filter(
        feature =>
          (feature.kind === 'private_message' || feature.kind === 'social_notification') &&
          feature.recipientId === user.id &&
          feature.payload?.read !== true
      ).length
    : 0;
  const unreadAnnouncements =
    user?.role === 'directeur'
      ? notifications.filter(
          notif =>
            (notif.recipientRole === 'all_directeurs' ||
              notif.recipientRole === user.id ||
              notif.recipientIds?.includes(user.id)) &&
            !(notif.readBy || []).includes(user.id)
        ).length
      : 0;
  const pendingDirectors =
    user?.role === 'admin'
      ? demandesDirecteur.filter(req => req.statut === 'en_attente').length +
        comptes.filter(acc => acc.role === 'directeur' && acc.approvalStatus === 'pending').length
      : 0;

  const directorCandidates = [
    { key: 'dashboard', label: isArabic ? 'الرئيسية' : 'Accueil', icon: LayoutDashboard, badge: 0 },
    { key: 'presences', label: isArabic ? 'الحضور' : 'Présences', icon: CalendarCheck, badge: remainingAttendance },
    { key: 'enfants', label: isArabic ? 'الأطفال' : 'Enfants', icon: Baby, badge: 0 },
    { key: 'paiements', label: isArabic ? 'الفواتير' : 'Factures', icon: CreditCard, badge: pendingInvoices },
    { key: 'repas', label: isArabic ? 'الوجبات' : 'Repas', icon: Utensils, badge: 0 },
    { key: 'activites', label: isArabic ? 'الأنشطة' : 'Activités', icon: Palette, badge: 0 },
    { key: 'classes', label: isArabic ? 'الأقسام' : 'Classes', icon: Layers, badge: 0 },
  ];

  const items =
    user?.role === 'admin'
      ? [
          { key: 'admin', label: isArabic ? 'الإدارة' : 'Pilotage', icon: Crown, badge: 0 },
          { key: 'comptes', label: isArabic ? 'الحسابات' : 'Comptes', icon: Users, badge: pendingDirectors },
          { key: 'communication', label: isArabic ? 'الرسائل' : 'Messages', icon: MessageCircle, badge: 0 },
          { key: 'notifications', label: isArabic ? 'الإعلانات' : 'Annonces', icon: Bell, badge: 0 },
        ]
      : directorCandidates.filter(item => canAccessPage(item.key)).slice(0, 4);

  const menuBadge =
    (canAccessPage('admissions') ? pendingAdmissions : 0) +
    (canAccessPage('community') ? unreadSocial : 0) +
    (canAccessPage('notifications') ? unreadAnnouncements : 0);

  const matchedTabIndex = items.findIndex(item => item.key === currentPage);
  const activeLogicalIndex = isMenuOpen || matchedTabIndex < 0 ? items.length : matchedTabIndex;

  if (!user || (user.role === 'directeur' && user.approvalStatus === 'pending')) {
    return null;
  }

  const allSlots = [
    ...items.map((item, index) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      badge: item.badge,
      badgeTone: item.key === 'paiements' ? 'bg-amber-500' : 'bg-indigo-600',
      isMenu: false,
      active: activeLogicalIndex === index,
    })),
    {
      key: '__menu__',
      label: isArabic ? 'القائمة' : 'Menu',
      icon: Menu,
      badge: menuBadge,
      badgeTone: 'bg-rose-500',
      isMenu: true,
      active: activeLogicalIndex === items.length,
    },
  ];

  return (
    <nav dir={isArabic ? 'rtl' : 'ltr'} aria-label={isArabic ? 'التنقل السريع على الهاتف' : 'Navigation mobile'} className="director-mobile-nav fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] lg:hidden [@media(max-height:430px)]:hidden pointer-events-none">
      <div className="director-mobile-nav-inner pointer-events-auto mx-auto flex w-full max-w-md items-stretch justify-around rounded-[22px] bg-[#112c56] p-1.5 shadow-xl">
        {allSlots.map(slot => {
          const Icon = slot.icon;
          return <button key={slot.key} type="button" onClick={slot.isMenu ? onOpenMenu : () => onNavigate(slot.key)}
            onPointerEnter={() => { if (!slot.isMenu) prefetchRouteChunk(slot.key); }}
            aria-current={!slot.isMenu && slot.active ? 'page' : undefined}
            aria-expanded={slot.isMenu ? isMenuOpen : undefined}
            aria-label={slot.isMenu ? (isArabic ? 'فتح القائمة' : 'Ouvrir le menu') : undefined}
            className={`director-nav-item relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 ${slot.active ? 'director-nav-active' : ''}`}>
            <span className="relative"><Icon size={19} strokeWidth={1.9} />{slot.badge > 0 && <span className="director-nav-badge">{slot.badge > 99 ? '99+' : slot.badge}</span>}</span>
            <span className="w-full truncate text-center text-[10px] font-bold leading-tight">{slot.label}</span>
          </button>;
        })}
      </div>
    </nav>
  );
}
