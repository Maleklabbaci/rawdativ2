import { useEffect, useRef, useState } from 'react';
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

function buildNotchedBarPath(width: number, cx: number): string {
  const W = Math.max(260, width);
  const topY = 20;
  const botY = 80;
  const cornerR = 20;
  const notchHalfW = 32;
  const notchDepth = 29;

  const clampedCx = Math.max(38, Math.min(W - 38, cx));
  const nStart = clampedCx - notchHalfW;
  const nEnd = clampedCx + notchHalfW;
  const tlR = Math.max(5, Math.min(cornerR, nStart - 2));
  const trR = Math.max(5, Math.min(cornerR, W - 2 - nEnd));

  return [
    `M 1 ${topY + tlR}`,
    `Q 1 ${topY} ${1 + tlR} ${topY}`,
    `L ${nStart} ${topY}`,
    `C ${nStart + 11} ${topY}, ${clampedCx - 23} ${topY + notchDepth}, ${clampedCx} ${topY + notchDepth}`,
    `C ${clampedCx + 23} ${topY + notchDepth}, ${nEnd - 11} ${topY}, ${nEnd} ${topY}`,
    `L ${W - 1 - trR} ${topY}`,
    `Q ${W - 1} ${topY} ${W - 1} ${topY + trR}`,
    `L ${W - 1} ${botY - cornerR}`,
    `Q ${W - 1} ${botY} ${W - 1 - cornerR} ${botY}`,
    `L ${1 + cornerR} ${botY}`,
    `Q 1 ${botY} 1 ${botY - cornerR}`,
    'Z',
  ].join(' ');
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(364);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 180) setBarWidth(next);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  const menuSlotIndex = items.length;
  const slotCount = items.length + 1;
  const matchedTabIndex = items.findIndex(item => item.key === currentPage);
  const activeLogicalIndex = isMenuOpen ? menuSlotIndex : matchedTabIndex >= 0 ? matchedTabIndex : menuSlotIndex;
  const visualColumn = isArabic ? slotCount - 1 - activeLogicalIndex : activeLogicalIndex;

  const padX = 12;
  const slotWidth = (barWidth - padX * 2) / slotCount;
  const targetCx = padX + slotWidth * (visualColumn + 0.5);

  const [animCx, setAnimCx] = useState(targetCx);
  const animRef = useRef(targetCx);
  animRef.current = animCx;

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined' || Math.abs(targetCx - animRef.current) < 1) {
      setAnimCx(targetCx);
      return;
    }
    const startCx = animRef.current;
    const delta = targetCx - startCx;
    const duration = 220;
    const startTime = performance.now();
    let frameId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startCx + delta * eased;
      setAnimCx(next);
      if (t < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [targetCx]);

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
      active: activeLogicalIndex === menuSlotIndex,
    },
  ];

  const activeSlot = allSlots[activeLogicalIndex];
  const ActiveIcon = activeSlot.icon;
  const svgPath = buildNotchedBarPath(barWidth, animCx);

  return (
    <nav
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-label={isArabic ? 'التنقل السريع على الهاتف' : 'Navigation mobile'}
      className="rawdha-mobile-notch-nav fixed inset-x-0 bottom-0 z-30 pointer-events-none px-2.5 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] lg:hidden [@media(max-height:430px)]:hidden"
    >
      {/* Fondu doux sous la barre pour qu'aucun texte défilé ne dépasse en bas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/92 to-transparent"
      />
      <div ref={containerRef} className="relative mx-auto h-[82px] w-full max-w-md select-none">
        {/* Forme blanche découpée en vague creuse (notch) sous l'onglet actif */}
        <svg
          width={barWidth}
          height={82}
          viewBox={`0 0 ${barWidth} 82`}
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-[82px] w-full drop-shadow-[0_10px_24px_rgba(15,23,42,0.11)]"
        >
          <path d={svgPath} fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
          <rect
            x={Math.round(barWidth / 2 - 42)}
            y={74}
            width={84}
            height={3}
            rx={1.5}
            fill="#cbd5e1"
            opacity="0.7"
          />
        </svg>

        {/* Médaillon circulaire flottant dans l'encoche courbe */}
        <div
          aria-hidden="true"
          style={{ left: `${animCx}px` }}
          className="pointer-events-none absolute top-0 z-20 flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-indigo-600 bg-white text-indigo-600 shadow-[0_6px_16px_rgba(79,70,229,0.24)]"
        >
          <ActiveIcon className="h-[20px] w-[20px] stroke-[2.3]" />
          {activeSlot.badge > 0 && (
            <span
              className={`absolute -end-1 -top-1 min-w-4 rounded-full px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white tabular-nums ${activeSlot.badgeTone}`}
            >
              {activeSlot.badge > 99 ? '99+' : activeSlot.badge}
            </span>
          )}
        </div>

        {/* Grille interactive des onglets */}
        <div
          style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
          className="pointer-events-auto relative z-10 grid h-full items-end px-[12px] pb-[11px] pt-[20px]"
        >
          {allSlots.map(slot => {
            const Icon = slot.icon;
            if (slot.isMenu) {
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={onOpenMenu}
                  aria-expanded={isMenuOpen}
                  aria-label={isArabic ? 'فتح القائمة' : 'Ouvrir le menu'}
                  className="relative flex h-full min-w-0 flex-col items-center justify-end gap-1 px-0.5 cursor-pointer"
                >
                  <span
                    className={`relative flex h-6 w-7 items-center justify-center transition-opacity duration-150 ${
                      slot.active ? 'opacity-0' : 'opacity-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-[19px] w-[19px] stroke-[1.85]" />
                    {!slot.active && slot.badge > 0 && (
                      <span className="absolute -end-1.5 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white tabular-nums">
                        {slot.badge > 99 ? '99+' : slot.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`w-full truncate text-center text-[10px] leading-tight transition-colors ${
                      slot.active ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'
                    }`}
                  >
                    {slot.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={slot.key}
                type="button"
                onPointerEnter={() => prefetchRouteChunk(slot.key)}
                onTouchStart={() => prefetchRouteChunk(slot.key)}
                onFocus={() => prefetchRouteChunk(slot.key)}
                onClick={() => onNavigate(slot.key)}
                aria-current={slot.active ? 'page' : undefined}
                className="relative flex h-full min-w-0 flex-col items-center justify-end gap-1 px-0.5 cursor-pointer"
              >
                <span
                  className={`relative flex h-6 w-7 items-center justify-center transition-opacity duration-150 ${
                    slot.active ? 'opacity-0' : 'opacity-100 text-slate-500'
                  }`}
                >
                  <Icon className="h-[19px] w-[19px] stroke-[1.85]" />
                  {!slot.active && slot.badge > 0 && (
                    <span
                      className={`absolute -end-1.5 -top-1 min-w-4 rounded-full px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white tabular-nums ${slot.badgeTone}`}
                    >
                      {slot.badge > 99 ? '99+' : slot.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] leading-tight transition-colors ${
                    slot.active ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'
                  }`}
                >
                  {slot.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
