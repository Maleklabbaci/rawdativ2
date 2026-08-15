import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Baby, 
  School, 
  CalendarCheck, 
  CreditCard, 
  UserCheck, 
  Sparkles, 
  Utensils, 
  Settings, 
  User,
  Crown,
  MapPin,
  Bell,
  MessageSquareQuote,
  BarChart3,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Sidebar({ currentPage, onPageChange, isOpen, onClose, isCollapsed = false, onToggleCollapse }: any) {
  const { user, creche } = useAuth();
  const { language, t } = useLanguage();

  let items: any[] = [];
  if (user?.role === 'admin') {
    items = [
      { key: 'comptes', label: 'comptes', icon: User, color: 'text-violet-500' },
      { key: 'notifications', label: 'notifications', icon: Bell, color: 'text-pink-500' },
      { key: 'communication', label: 'communication', icon: MessageSquareQuote, color: 'text-amber-500' },
      { key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-500' },
    ];
  } else if (user?.role === 'directeur') {
    items = [
      { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard, color: 'text-indigo-500' },
      { key: 'enfants', label: 'children', icon: Baby, color: 'text-rose-500' },
      { key: 'classes', label: 'classes', icon: School, color: 'text-amber-500' },
      { key: 'presences', label: 'attendance', icon: CalendarCheck, color: 'text-emerald-500' },
      { key: 'paiements', label: 'invoices', icon: CreditCard, color: 'text-cyan-500' },
      { key: 'rapports', label: 'reports', icon: BarChart3, color: 'text-indigo-400' },
      { key: 'personnel', label: 'staff', icon: UserCheck, color: 'text-teal-500' },
      { key: 'activites', label: 'activities', icon: Sparkles, color: 'text-purple-500' },
      { key: 'repas', label: 'meals', icon: Utensils, color: 'text-orange-500' },
      { key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-500' },
    ];
  }

  const getTabLabel = (key: string, originalLabel: string) => {
    if (key === 'comptes' && user?.role === 'admin') {
      return language === 'ar' ? 'مدراء الروضات' : 'Directeurs de Crèches';
    }
    if (key === 'notifications') {
      return language === 'ar' ? 'الإشعارات' : 'Notifications';
    }
    if (key === 'communication') {
      return language === 'ar' ? 'الرسائل والتقييمات والملاحظات' : 'Messages, Avis & Retours';
    }
    return t(originalLabel);
  };

  return (
    <>
      <aside 
        className={`w-72 ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-slate-900 text-slate-100 fixed h-screen top-0 shadow-2xl z-40 flex flex-col justify-between overflow-hidden select-none transition-all duration-300 ${
          language === 'ar'
            ? 'right-0 border-l border-slate-800 ' + (isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
            : 'left-0 border-r border-slate-800 ' + (isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-16 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className={`border-b border-slate-800 transition-all duration-300 ${isCollapsed ? 'p-4 lg:p-3' : 'p-6'}`}>
          <div className={`flex items-center justify-between gap-3.5 ${isCollapsed ? 'lg:justify-center' : ''}`}>
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-indigo-500/20 text-white flex-shrink-0 w-11 h-11 flex items-center justify-center overflow-hidden">
                {creche?.logoUrl ? (
                  <img src={creche.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Baby className="w-6 h-6" />
                )}
              </div>
              <div className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  RAWDHA+
                </h1>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block -mt-1 truncate">
                  {language === 'ar' ? 'روضتي بريميوم' : 'Nursery Hub'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title={language === 'ar' ? (isCollapsed ? 'فتح القائمة' : 'طي القائمة') : (isCollapsed ? 'Ouvrir la barre' : 'Replier la barre')}
                  className="hidden lg:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto ${isCollapsed ? 'px-2 lg:px-2' : 'px-4'}`}>
          {items.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentPage === item.key;
            
            return (
              <button 
                id={`sidebar-tab-${item.key}`}
                key={item.key} 
                aria-label={getTabLabel(item.key, item.label)}
                className={`relative group w-full flex items-center justify-between p-3.5 rounded-xl transition duration-150 cursor-pointer ${isCollapsed ? 'lg:justify-center' : ''} ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                }`}
                onClick={() => {
                  onPageChange(item.key);
                  if (onClose) onClose();
                }}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-600/15"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}

                <span className="relative flex items-center gap-3.5 z-10">
                  <IconComponent className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-white' : item.color
                  }`} />
                  <span className={`text-sm font-semibold tracking-wide ${isCollapsed ? 'lg:hidden' : ''}`}>{getTabLabel(item.key, item.label)}</span>
                </span>

                {!isActive && !isCollapsed && (
                  <span className="w-1.5 h-1.5 bg-slate-700 rounded-full opacity-60 group-hover:opacity-100 transition z-10" />
                )}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-md relative z-10 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center gap-3 p-2 bg-slate-900/60 rounded-2xl border border-slate-800/50 ${isCollapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-11 h-11 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold tracking-wider relative flex-shrink-0 border border-indigo-500/25">
              <span>
                {user ? `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase() : 'AD'}
              </span>
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-slate-900" />
            </div>
            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-xs font-black text-white truncate flex items-center gap-1">
                {user ? `${user.prenom} ${user.nom}` : 'Admin'}
                {user?.role === 'admin' && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
              </p>
              <p className="text-[10px] text-slate-400 font-bold truncate">
                {user ? (user.role === 'admin' ? (language === 'ar' ? 'مدير النظام' : 'Administrateur') : (language === 'ar' ? 'مدير الروضة' : 'Directeur')) : 'Administrateur'}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-[10px]">
                <MapPin className="w-2.5 h-2.5 text-indigo-400" />
                <span className="truncate">{language === 'ar' ? 'منصة التسيير' : 'Plateforme'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
