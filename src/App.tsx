
import { useState, useEffect } from 'react';
import { School, LogOut, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { DbProvider, useDb } from './contexts/DbContext';
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Enfants from './components/Enfants';
import Classes from './components/Classes';
import Presences from './components/Presences';
import Paiements from './components/Paiements';
import Personnel from './components/Personnel';
import Activites from './components/Activites';
import Repas from './components/Repas';
import Parametres from './components/Parametres';
import Comptes from './components/Comptes';
import ChatBubble from './components/ChatBubble';
import { AlertCircle } from 'lucide-react';

function AppContent() {
  const { isAuthenticated, user, creche, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { loading, comptes } = useDb();

  useEffect(() => {
    if (user?.role === 'admin') {
      if (currentPage !== 'comptes' && currentPage !== 'parametres') {
        setCurrentPage('comptes');
      }
    } else {
      if (currentPage === 'comptes') {
        setCurrentPage('dashboard');
      }
    }
  }, [user, currentPage]);

  if (!isAuthenticated) {
    return <SignIn />;
  }

  // --- Real-time Subscription Expiry Guard (Checks end date & active status) ---
  const liveUser = user && comptes ? (comptes.find(c => c.id === user.id) || user) : user;
  
  let isSubscriptionExpired = false;
  let expiryDateString = '';
  
  if (liveUser && liveUser.role !== 'admin') {
    if (!liveUser.abonnementActif) {
      isSubscriptionExpired = true;
    } else if (liveUser.dateFinAbonnement) {
      const todayStr = new Date().toISOString().split('T')[0]; // e.g. "2026-06-18"
      expiryDateString = liveUser.dateFinAbonnement;
      if (todayStr > liveUser.dateFinAbonnement) {
        isSubscriptionExpired = true;
      }
    }
  }

if (isSubscriptionExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
          {/* Top colored accent line */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-rose-500 to-amber-500" />
          
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-500 border border-rose-100">
            <AlertCircle className="w-8 h-8 text-rose-500 animate-pulse" />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {language === 'ar' ? 'انتهت صلاحية الحساب' : 'Abonnement Terminé'}
            </h1>
            
            <p className="text-slate-600 text-sm leading-relaxed">
              {language === 'ar' 
                ? 'عذراً، لقد انتهت صلاحية اشتراككم الشهري الخاص ببرنامج روضتي. يرجى التواصل معنا لتجديد الاشتراك.' 
                : 'Votre abonnement mensuel Rawdati est arrivé à expiration. Veuillez nous contacter pour renouveler votre accès.'}
            </p>

            {expiryDateString && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">
                <span>{language === 'ar' ? `تاريخ الانتهاء: ${expiryDateString}` : `Expiré le : ${expiryDateString}`}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            {/* زر الواتساب الجديد */}
            <a
              href="https://wa.me/213555000000" // بدّل هذا برقم الهاتف تاعك
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition font-bold text-sm tracking-wide flex items-center justify-center gap-2 border border-emerald-100 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <span>{language === 'ar' ? 'تواصل معنا عبر واتساب' : 'Contactez-nous sur WhatsApp'}</span>
            </a>

            <button
              onClick={logout}
              className="w-full py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition font-bold text-sm tracking-wide cursor-pointer flex items-center justify-center gap-2 border border-rose-100/50"
            >
              <LogOut className="w-4 h-4" />
              <span>{language === 'ar' ? 'تسجيل الخروج' : 'Se déconnecter'}</span>
            </button>
          </div>
        </div>
        
        {/* Support Chat Bubble (Déjà présent et fonctionnel) */}
        <ChatBubble />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <School className="w-12 h-12 text-indigo-600 animate-bounce" />
        <p id="loading-text" className="text-sm font-bold text-slate-600 animate-pulse">
          {language === 'ar' ? 'جاري الاتصال بقاعدة البيانات روضتي...' : 'Connexion à la base de données Rawdati en cours...'}
        </p>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'enfants':
        return <Enfants />;
      case 'classes':
        return <Classes />;
      case 'presences':
        return <Presences />;
      case 'paiements':
        return <Paiements />;
      case 'personnel':
        return <Personnel />;
      case 'activites':
        return <Activites />;
      case 'repas':
        return <Repas />;
      case 'comptes':
        return <Comptes />;
      case 'parametres':
        return <Parametres />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Sidebar Backdrop Overlay on mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="lg:ltr:pl-72 lg:rtl:pr-72 transition-all duration-300">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 shadow-xs">
          <div className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                  id="mobile-sidebar-toggle"
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex-shrink-0"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hidden sm:block flex-shrink-0">
                    <School className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-1.5 leading-tight">
                      {creche?.nom}
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 rounded-md uppercase tracking-wider">PRO</span>
                    </h1>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-none mt-0.5">{creche?.adresse}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                {/* Language Selector */}
                <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
                  <button
                    onClick={() => setLanguage('fr')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      language === 'fr'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    FR
                  </button>
                  <button
                    onClick={() => setLanguage('ar')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      language === 'ar'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    عربي
                  </button>
                </div>
                
                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all font-bold text-xs flex items-center gap-2 cursor-pointer border border-rose-100/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto animate-fade-in">
          {renderPage()}
        </main>
      </div>

      {/* Persistent Live Chat Bubble */}
      <ChatBubble />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DbProvider>
          <AppContent />
        </DbProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
