// Style navigation Rawdha+ : hiérarchie légère, repères épinglés et accès opérationnels sans surcharge visuelle.
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Baby,
  School,
  CalendarCheck,
  CreditCard,
  ShoppingCart,
  UserCheck,
  Sparkles,
  Utensils,
  Settings,
  User,
  Crown,
  MapPin,
  MessageCircle,
  BarChart3,
  Network,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';

type NavigationItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
};

export default function Sidebar({ currentPage, onPageChange, isOpen, onClose, isCollapsed = false, onToggleCollapse }: any) {
  const { user, creche } = useAuth();
  const { communityFeatures } = useDb();
  const { language, t } = useLanguage();
  const isArabic = language === 'ar';
  const unreadSocialMessages = communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const unreadSocialNotifications = communityFeatures.filter(feature => feature.kind === 'social_notification' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const socialBadgeCount = unreadSocialMessages + unreadSocialNotifications;

  const primaryItems: NavigationItem[] = user?.role === 'admin'
    ? [
      { key: 'comptes', label: 'comptes', icon: User, color: 'text-violet-500' },
      { key: 'communication', label: 'communication', icon: MessageCircle, color: 'text-amber-500' },
    ]
    : user?.role === 'directeur'
      ? [
        { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard, color: 'text-indigo-500' },
        { key: 'enfants', label: 'children', icon: Baby, color: 'text-rose-500' },
        { key: 'classes', label: 'classes', icon: School, color: 'text-amber-500' },
        { key: 'presences', label: 'attendance', icon: CalendarCheck, color: 'text-emerald-500' },
        { key: 'paiements', label: 'invoices', icon: CreditCard, color: 'text-cyan-500' },
        { key: 'achats', label: 'purchases', icon: ShoppingCart, color: 'text-fuchsia-500' },
        { key: 'rapports', label: 'reports', icon: BarChart3, color: 'text-indigo-400' },
        { key: 'personnel', label: 'staff', icon: UserCheck, color: 'text-teal-500' },
        { key: 'activites', label: 'activities', icon: Sparkles, color: 'text-purple-500' },
        { key: 'repas', label: 'meals', icon: Utensils, color: 'text-orange-500' },
        { key: 'communication', label: 'communication', icon: MessageCircle, color: 'text-emerald-500' },
      ]
      : [];

  const getTabLabel = (key: string, originalLabel: string) => {
    if (key === 'comptes' && user?.role === 'admin') return isArabic ? 'مدراء الروضات' : 'Directeurs de Crèches';
    if (key === 'community') return 'Rawdha Connect';
    if (key === 'communication') return user?.role === 'directeur'
      ? (isArabic ? 'التواصل مع العائلات' : 'Communication')
      : (isArabic ? 'الرسائل والتقييمات والملاحظات' : 'Messages, Avis & Retours');
    return t(originalLabel);
  };

  const activate = (key: string) => {
    onPageChange(key);
    onClose?.();
  };

  const handleLogoClick = () => {
    if (window.innerWidth >= 1024) onToggleCollapse?.();
    else onClose?.();
  };

  const renderItem = (item: NavigationItem, { pinned = false }: { pinned?: boolean } = {}) => {
    const IconComponent = item.icon;
    const isActive = currentPage === item.key;
    const label = getTabLabel(item.key, item.label);
    return (
      <button
        id={`sidebar-tab-${item.key}`}
        key={item.key}
        aria-label={label}
        title={isCollapsed ? label : undefined}
        className={`relative group w-full flex items-center justify-between rounded-xl p-3 transition duration-150 cursor-pointer ${isCollapsed ? 'lg:justify-center' : ''} ${
          isActive ? 'text-white' : pinned ? 'text-indigo-100 hover:text-white hover:bg-indigo-500/15' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
        }`}
        onClick={() => activate(item.key)}
      >
        {isActive && <motion.div layoutId="activeTabIndicator" className={pinned ? 'absolute inset-0 rounded-xl bg-indigo-600' : 'absolute inset-0 rounded-xl bg-indigo-700'} transition={{ type: 'spring', stiffness: 350, damping: 28 }} />}
        <span className="relative z-10 flex items-center gap-3">
          <IconComponent className={`h-5 w-5 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-white' : item.color}`} />
          <span className={`text-sm font-semibold tracking-wide ${isCollapsed ? 'lg:hidden' : ''}`}>{label}</span>
        </span>
        {!isActive && !isCollapsed && item.key === 'community' && socialBadgeCount > 0 ? (
          <span className="relative z-10 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-4 text-white shadow-sm">{socialBadgeCount > 99 ? '99+' : socialBadgeCount}</span>
        ) : !isActive && !isCollapsed && !pinned ? <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-slate-700 opacity-60 transition group-hover:opacity-100" /> : null}
      </button>
    );
  };

  return (
    <aside className={`w-[min(18rem,88vw)] ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} fixed top-0 z-40 flex h-[100dvh] flex-col overflow-hidden overscroll-contain border-slate-800 bg-slate-900 text-slate-100 shadow-2xl transition-all duration-300 select-none ${
      isArabic
        ? `right-0 border-l ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`
        : `left-0 border-r ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`
    }`}>
      <div className={`border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'p-3' : 'p-4 lg:p-5'}`}>
        <div className={`flex items-center justify-between gap-3 ${isCollapsed ? 'lg:justify-center' : ''}`}>
          <button type="button" onClick={handleLogoClick} className="flex min-w-0 items-center gap-3 text-left" title={isArabic ? 'فتح أو طي القائمة' : 'Ouvrir ou replier le menu'} aria-label={isArabic ? 'فتح أو طي القائمة' : 'Ouvrir ou replier le menu'}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/20">
              {creche?.logoUrl ? <img src={creche.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" /> : <Baby className="h-6 w-6" />}
            </span>
            <span className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block truncate text-lg font-black tracking-tight text-white">RAWDHA+</span>
              <span className="-mt-0.5 block truncate text-[10px] font-bold uppercase tracking-widest text-indigo-400">{isArabic ? 'منصة التسيير' : 'Nursery Hub'}</span>
            </span>
          </button>
          <button type="button" onClick={onClose} className="flex shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden" aria-label={isArabic ? 'إغلاق القائمة' : 'Fermer le menu'}><X className="h-5 w-5" /></button>
        </div>

        <button type="button" onClick={() => activate('parametres')} className={`mt-4 flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-2.5 text-left transition hover:border-indigo-500/40 hover:bg-slate-800/70 ${isCollapsed ? 'lg:justify-center' : ''}`} aria-label={isArabic ? 'فتح إعدادات الحساب' : 'Ouvrir les paramètres du compte'}>
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/25 bg-indigo-500/20 font-bold tracking-wider text-indigo-300">
            {user ? `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase() : 'AD'}
            <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-900 ${user?.approvalStatus === 'pending' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          </span>
          <span className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <span className="flex items-center gap-1 truncate text-xs font-black text-white">{user ? `${user.prenom} ${user.nom}` : 'Admin'}{user?.role === 'admin' && <Crown className="h-3 w-3 shrink-0 text-amber-400" />}</span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold text-slate-400"><MapPin className="h-2.5 w-2.5 text-indigo-400" />{user?.approvalStatus === 'pending' ? (isArabic ? 'قراءة فقط' : 'Lecture seule') : (isArabic ? 'مدير الروضة' : 'Directeur')}</span>
          </span>
        </button>
      </div>

      <nav className={`min-h-0 flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {!isCollapsed && <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{isArabic ? 'التسيير اليومي' : 'Gestion quotidienne'}</p>}
        <div className="space-y-1">{primaryItems.map(item => renderItem(item))}</div>
      </nav>

      <div className={`border-t border-slate-800 bg-slate-950/40 p-2.5 ${isCollapsed ? 'lg:px-2' : 'lg:px-3'}`}>
        {!isCollapsed && <p className="px-3 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{isArabic ? 'مثبت' : 'Épinglé'}</p>}
        {renderItem({ key: 'community', label: 'community', icon: Network, color: 'text-violet-300' }, { pinned: true })}
        {renderItem({ key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-300' }, { pinned: true })}
      </div>
    </aside>
  );
}
