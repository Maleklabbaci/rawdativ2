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
  LogOut,
  User,
  Crown,
  MapPin,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Sidebar({ currentPage, onPageChange, isOpen, onClose }: any) {
  const { logout, creche, user } = useAuth();
  const { language, t } = useLanguage();

  // Define dynamic menu items based on exact user role
  let items: any[] = [];
  if (user?.role === 'admin') {
    items = [
      { key: 'comptes', label: 'comptes', icon: User, color: 'text-violet-500' },
      { key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-500' },
    ];
  } else if (user?.role === 'directeur') {
    items = [
      { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard, color: 'text-indigo-500' },
      { key: 'enfants', label: 'children', icon: Baby, color: 'text-rose-500' },
      { key: 'classes', label: 'classes', icon: School, color: 'text-amber-500' },
      { key: 'presences', label: 'attendance', icon: CalendarCheck, color: 'text-emerald-500' },
      { key: 'paiements', label: 'invoices', icon: CreditCard, color: 'text-cyan-500' },
      { key: 'personnel', label: 'staff', icon: UserCheck, color: 'text-teal-500' },
      { key: 'activites', label: 'activities', icon: Sparkles, color: 'text-purple-500' },
      { key: 'repas', label: 'meals', icon: Utensils, color: 'text-orange-500' },
      { key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-500' },
    ];
  } else {
    // Parent Account Portal (Can be left as minimal fallback, but won't be accessed as they don't have login screens)
    items = [
      { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard, color: 'text-indigo-500' },
      { key: 'presences', label: 'attendance', icon: CalendarCheck, color: 'text-emerald-500' },
      { key: 'paiements', label: 'invoices', icon: CreditCard, color: 'text-cyan-500' },
      { key: 'activites', label: 'activities', icon: Sparkles, color: 'text-purple-500' },
      { key: 'repas', label: 'meals', icon: Utensils, color: 'text-orange-500' },
      { key: 'parametres', label: 'settings', icon: Settings, color: 'text-slate-500' },
    ];
  }

  // Dynamic Label translation for accounts tab depending on role
  const getTabLabel = (key: string, originalLabel: string) => {
    if (key === 'comptes') {
      if (user?.role === 'admin') {
        return language === 'ar' ? 'مدراء الروضات' : 'Directeurs de Crèches';
      } else {
        return language === 'ar' ? 'حسابات الأولياء' : 'Parents d\'élèves';
      }
    }
    return t(originalLabel);
  };

  return (
    <>
      {/* Sidebar background wrapper */}
      <aside 
        className={`w-72 bg-slate-900 text-slate-100 fixed h-screen top-0 shadow-2xl z-40 flex flex-col justify-between overflow-hidden select-none transition-transform duration-300 ${
          language === 'ar'
            ? 'right-0 border-l border-slate-800 ' + (isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')
            : 'left-0 border-r border-slate-800 ' + (isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }`}
      >
        {/* Subtle glowing gradients on the sidebar background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-16 left-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand container */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 overflow-hidden">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-indigo-500/20 text-white flex-shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div className="truncate">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  RAWDATI
                </h1>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block -mt-1 truncate">
                  {language === 'ar' ? 'روضتي بريميوم' : 'Nursery Hub'}
                </span>
              </div>
            </div>

            {/* Close Mobile Menu Button */}
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer flex-shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {items.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentPage === item.key;
            
            return (
              <button 
                id={`sidebar-tab-${item.key}`}
                key={item.key} 
                className={`relative group w-full flex items-center justify-between p-3.5 rounded-xl transition duration-150 cursor-pointer ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                }`}
                onClick={() => {
                  onPageChange(item.key);
                  if (onClose) onClose();
                }}
              >
                {/* Active Backdrop pill with framer motion/motion */}
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md shadow-indigo-600/15"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}

                {/* Left group alignment */}
                <span className="relative flex items-center gap-3.5 z-10">
                  <IconComponent className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-white' : item.color
                  }`} />
                  <span className="text-sm font-semibold tracking-wide">{getTabLabel(item.key, item.label)}</span>
                </span>

                {/* Right chevron or dot */}
                {!isActive && (
                  <span className="w-1.5 h-1.5 bg-slate-700 rounded-full opacity-60 group-hover:opacity-100 transition z-10" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin profile and info block */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3 p-2 bg-slate-900/60 rounded-2xl border border-slate-800/50">
            <div className="w-11 h-11 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold tracking-wider relative flex-shrink-0 border border-indigo-500/25">
              <span>
                {user ? `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase() : 'AL'}
              </span>
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate flex items-center gap-1">
                {user ? `${user.prenom} ${user.nom}` : 'Labbaci Abdelmalek'}
                {user?.role === 'admin' && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
              </p>
              <p className="text-[10px] text-slate-400 font-bold truncate">
                {user ? (user.role === 'admin' ? (language === 'ar' ? 'مدير الروضة' : 'Directeur') : (language === 'ar' ? 'ولي أمر' : 'Parent')) : 'Directeur'}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-[10px]">
                <MapPin className="w-2.5 h-2.5 text-indigo-400" />
                <span>Alger</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
