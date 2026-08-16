
import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { School, LogOut, Menu, CircleHelp, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { DbProvider, useDb } from './contexts/DbContext';
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
// ✅ FIX (bundle size): ces pages ne sont chargées que quand l'utilisateur y navigue
// réellement, au lieu d'être toutes téléchargées dès le login (chunk unique 962 Ko avant).
// ✅ Récupération des chunks périmés : un onglet ouvert avant un déploiement peut
// conserver l'ancien index.js et demander un fichier hashé qui n'existe plus.
const CHUNK_RELOAD_KEY = 'rawdha_chunk_reload_once';

const reloadForStaleChunk = () => {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    const refreshedUrl = new URL(window.location.href);
    refreshedUrl.searchParams.set('__rawdha_refresh', String(Date.now()));
    window.location.replace(refreshedUrl.toString());
    return true;
  } catch {
    return false;
  }
};

const lazyWithRecovery = <T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const module = await loader();
      if (typeof window !== 'undefined') sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Failed to fetch dynamically imported module') && reloadForStaleChunk()) {
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });

const Enfants = lazyWithRecovery(() => import('./components/Enfants'));
const Classes = lazyWithRecovery(() => import('./components/Classes'));
const Presences = lazyWithRecovery(() => import('./components/Presences'));
const Paiements = lazyWithRecovery(() => import('./components/Paiements'));
const Personnel = lazyWithRecovery(() => import('./components/Personnel'));
const Activites = lazyWithRecovery(() => import('./components/Activites'));
const Repas = lazyWithRecovery(() => import('./components/Repas'));
const Parametres = lazyWithRecovery(() => import('./components/Parametres'));
const Comptes = lazyWithRecovery(() => import('./components/Comptes'));
const Notifications = lazyWithRecovery(() => import('./components/Notifications'));
const CommunicationAdmin = lazyWithRecovery(() => import('./components/CommunicationAdmin'));
const Rapports = lazyWithRecovery(() => import('./components/Rapports'));
const Admissions = lazyWithRecovery(() => import('./components/Admissions'));
const Community = lazyWithRecovery(() => import('./components/Community'));
import PublicAdmission from './components/PublicAdmission';
import NotificationBell from './components/NotificationBell';
import SubscriptionStatusBadge from './components/SubscriptionStatusBadge';
import NotificationPopup from './components/NotificationPopup';
import ChatBubble from './components/ChatBubble';
import { AlertCircle, Lock, Check } from 'lucide-react';
import OnboardingCrecheModal, { hasCompletedOnboarding } from './components/OnboardingCrecheModal';
import WelcomeDirectorModal from './components/WelcomeDirectorModal';
import LanguageChoiceModal from './components/LanguageChoiceModal';
import HelpCenterModal from './components/HelpCenterModal';

function AppContent() {
  const { isAuthenticated, user, creche, logout, loading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [showCouponInput, setShowCouponInput] = useState(false); // ✅ champ coupon replié par défaut, pour ne pas distraire du CTA principal // ✅ champ code coupon sur l'écran d'abonnement expiré
  const { language, setLanguage, t } = useLanguage();
  const { loading: dbLoading, comptes } = useDb();
  const isPublicAdmission = window.location.pathname.replace(/\/+$/, '') === '/admission';

  // ✅ Onboarding premier login : on vérifie une fois si le directeur a déjà rempli
  // ses infos de crèche (existence du doc "parametres/creche_{id}"). null = pas encore vérifié.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLanguageChoice, setShowLanguageChoice] = useState(false);

  useEffect(() => {
    if (user?.role === 'directeur') {
      const welcomeKey = `rawdha_welcome_seen_${user.id}`;
      const languageKey = `rawdha_language_selected_${user.id}`;
      const introCompletedKey = `rawdha_director_intro_completed_v2_${user.id}`;
      const readStoredFlag = (key: string) => {
        const value = localStorage.getItem(key)?.trim().toLowerCase();
        return value === '1' || value === 'true' || value === 'yes' || value === 'done';
      };
      const welcomeSeen = readStoredFlag(welcomeKey) || readStoredFlag('rawdha_welcome_seen');
      const accountLanguageSelected = readStoredFlag(languageKey);
      // Les anciennes versions stockaient la langue sans identifiant de compte.
      // Cette valeur est aussi la preuve que l’ancien onboarding a déjà été
      // franchi : elle doit donc fermer les deux fenêtres, pas uniquement celle
      // du choix de langue.
      const globalLanguage = localStorage.getItem('rawdha_language')?.trim().toLowerCase();
      const globalLanguageSelected = globalLanguage === 'fr' || globalLanguage === 'ar';
      const globalIntroCompleted = readStoredFlag('rawdha_director_intro_completed');
      const languageSelected = accountLanguageSelected || globalLanguageSelected;
      const introCompleted = readStoredFlag(introCompletedKey)
        || globalIntroCompleted
        || (welcomeSeen && languageSelected);

      // Migration vers les marqueurs par compte et vers le marqueur global de
      // compatibilité. La langue seule ferme uniquement le choix de langue ;
      // le bouton « Commencer maintenant » reste responsable de la fin d’accueil.
      if (globalLanguageSelected && !accountLanguageSelected) {
        localStorage.setItem(languageKey, '1');
      }
      if (introCompleted) {
        localStorage.setItem(introCompletedKey, '1');
        localStorage.setItem('rawdha_director_intro_completed', '1');
        localStorage.setItem('rawdha_welcome_seen', '1');
      }
      setShowWelcome(!introCompleted && !welcomeSeen);
      setShowLanguageChoice(!introCompleted && !languageSelected);
    } else {
      setShowWelcome(false);
      setShowLanguageChoice(false);
    }
  }, [user?.id, user?.role]);

  const chooseInitialLanguage = (selectedLanguage: 'fr' | 'ar') => {
    setLanguage(selectedLanguage);
    if (user?.id) {
      localStorage.setItem(`rawdha_language_selected_${user.id}`, '1');
    }
    // Double écriture volontaire : la clé globale est conservée pour les
    // anciens comptes et la clé par compte pour les prochaines connexions.
    localStorage.setItem('rawdha_language', selectedLanguage);
    localStorage.setItem('rawdha_language_selected', '1');
    setShowLanguageChoice(false);
  };

  const closeWelcome = () => {
    if (user?.id) {
      localStorage.setItem(`rawdha_welcome_seen_${user.id}`, '1');
      localStorage.setItem(`rawdha_language_selected_${user.id}`, '1');
      localStorage.setItem(`rawdha_director_intro_completed_v2_${user.id}`, '1');
      localStorage.setItem('rawdha_welcome_seen', '1');
      localStorage.setItem('rawdha_director_intro_completed', '1');
    }
    setShowWelcome(false);
    setShowLanguageChoice(false);
  };

  useEffect(() => {
    if (user?.role === 'directeur') {
      hasCompletedOnboarding(user.id).then(done => setNeedsOnboarding(!done));
    } else {
      setNeedsOnboarding(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.warn('Le mode plein écran n’est pas disponible dans ce navigateur.', error);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      if (currentPage !== 'comptes' && currentPage !== 'parametres' && currentPage !== 'notifications' && currentPage !== 'communication' && currentPage !== 'community') {
        setCurrentPage('comptes');
      }
    } else {
      if (currentPage === 'comptes') {
        setCurrentPage('dashboard');
      }
    }
  }, [user, currentPage]);

  // ✅ Favicon + titre d'onglet dynamiques : le logo PNG uploadé dans Paramètres
  // remplace l'icône par défaut de RAWDHA+ dans la barre de tâches / onglet du navigateur.
  useEffect(() => {
    const faviconHref = creche?.logoUrl || '/favicon.png';
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconHref;

    document.title = creche?.nom ? `${creche.nom} — RAWDHA+` : 'RAWDHA+';
  }, [creche?.logoUrl, creche?.nom]);

  if (isPublicAdmission) {
    return <PublicAdmission />;
  }

  // Attendre la restauration de la session avant de décider si l’utilisateur est déconnecté.
  // Sans ce garde placé avant SignIn, chaque reload affichait brièvement l’écran de connexion.
  // La restauration Auth doit être terminée avant tout rendu de SignIn.
  // Les données métier peuvent ensuite continuer à charger sans faire clignoter le login.
  if (authLoading || (isAuthenticated && dbLoading)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <School className="w-12 h-12 text-indigo-600 animate-bounce" />
        <p id="loading-text" className="text-sm font-bold text-slate-600 animate-pulse">
          {authLoading
            ? (language === 'ar' ? 'جاري استعادة جلسة روضتي...' : 'Restauration de votre session Rawdha+...')
            : (language === 'ar' ? 'جاري تحميل بيانات روضتي...' : 'Chargement des données Rawdha+...')}
        </p>
      </div>
    );
  }

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

  // ✅ Codes promo : modifie cette liste pour ajouter/changer tes codes.
  // Format : 'CODE': montant de réduction en DA
  const COUPON_CODES: Record<string, number> = {
    'RAWDHA500': 500,
    'RAWDHA1000': 1000,
  };
  const BASE_PLAN_PRICE = 3500;
  const couponDiscount = COUPON_CODES[couponCode.trim().toUpperCase()] || 0;
  const finalPrice = BASE_PLAN_PRICE - couponDiscount;

  const whatsappMessage = language === 'ar'
    ? `مرحباً، أنا ${liveUser?.prenom || ''} ${liveUser?.nom || ''} (${liveUser?.nomCreche || ''}). أرغب في تفعيل خطة Rawdha+ بسعر ${finalPrice} د.ج${couponDiscount > 0 ? ` (باستخدام الكود ${couponCode.trim().toUpperCase()})` : ''}. البريد الإلكتروني: ${liveUser?.email || ''}. شكراً لتفعيل حسابي.`
    : `Bonjour, je suis ${liveUser?.prenom || ''} ${liveUser?.nom || ''} (${liveUser?.nomCreche || ''}). Je souhaite activer le plan Rawdha+ à ${finalPrice} DA${couponDiscount > 0 ? ` (avec le code ${couponCode.trim().toUpperCase()})` : ''}. Email : ${liveUser?.email || ''}. Merci de valider mon compte.`;

  const whatsappLink = `https://wa.me/213697660969?text=${encodeURIComponent(whatsappMessage)}`;

if (isSubscriptionExpired) {
    const isAr = language === 'ar';
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/40 flex flex-col items-center justify-center p-4 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-2xl shadow-indigo-900/10 overflow-hidden">

          {/* Header */}
          <div className="text-center px-8 pt-9 pb-6">
            <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mb-1.5">
              {isAr ? 'حسابك في انتظارك 👋' : 'Ton compte t\'attend 👋'}
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
              {isAr
                ? 'أطفالك، الحضور، الدفعات — كل شيء محفوظ بأمان. فعّل اشتراكك للمتابعة من حيث توقفت.'
                : 'Enfants, présences, paiements — tout est sauvegardé en sécurité. Réactive ton accès pour reprendre où tu t\'es arrêté.'}
            </p>
            {expiryDateString && (
              <p className="mt-2 text-[11px] text-slate-400 font-medium">
                {isAr ? `منتهي منذ ${expiryDateString}` : `Expiré depuis le ${expiryDateString}`}
              </p>
            )}
          </div>

          {/* Plan card — élément signature, gradient plein */}
          <div className="mx-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-5 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
            <div className="relative flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100">
                  {isAr ? 'خطة Rawdha+' : 'Plan Rawdha+'}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  {couponDiscount > 0 && (
                    <span className="text-sm text-indigo-200 line-through">3500 DA</span>
                  )}
                  <span className="text-3xl font-black">{finalPrice} DA</span>
                  <span className="text-xs text-indigo-200">/{isAr ? 'شهر' : 'mois'}</span>
                </div>
              </div>
              {couponDiscount > 0 && (
                <span className="text-[10px] font-black text-indigo-700 bg-white px-2.5 py-1 rounded-full">
                  -{couponDiscount} DA
                </span>
              )}
            </div>
            <div className="relative flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-white/20">
              {[
                isAr ? 'كل الأطفال والدفعات' : 'Tous les enfants & paiements',
                isAr ? 'دعم مباشر' : 'Support direct',
                isAr ? 'بدون التزام' : 'Sans engagement',
              ].map((txt, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] text-indigo-100 font-medium">
                  <Check className="w-3 h-3" /> {txt}
                </span>
              ))}
            </div>
          </div>

          {/* CTA principal — WhatsApp, plein, mis en avant */}
          <div className="px-6 pt-5 pb-2">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/30 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <span>{isAr ? 'تفعيل حسابي الآن' : 'Réactiver mon accès maintenant'}</span>
            </a>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              {isAr ? 'رد سريع عبر واتساب، عادة خلال دقائق' : 'Réponse rapide sur WhatsApp, généralement en quelques minutes'}
            </p>
          </div>

          {/* Coupon — discret, replié par défaut */}
          <div className="px-6 pb-1">
            {!showCouponInput ? (
              <button
                onClick={() => setShowCouponInput(true)}
                className="text-[12px] font-semibold text-indigo-500 hover:text-indigo-600 transition cursor-pointer"
              >
                {isAr ? 'لدي كود خصم' : 'J\'ai un code promo'}
              </button>
            ) : (
              <div>
                <input
                  type="text"
                  autoFocus
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder={isAr ? 'كود الخصم' : 'Code promo'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800 text-center tracking-widest uppercase"
                />
                {couponCode && (
                  couponDiscount > 0 ? (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 text-center">
                      {isAr ? `✓ خصم ${couponDiscount} د.ج مطبق` : `✓ Réduction de ${couponDiscount} DA appliquée`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1.5 text-center">
                      {isAr ? 'الكود غير صالح' : 'Code invalide'}
                    </p>
                  )
                )}
              </div>
            )}
          </div>

          {/* Déconnexion — discret, plus un bouton concurrent */}
          <div className="text-center py-4 border-t border-slate-100 mt-3">
            <button
              onClick={logout}
              className="text-[12px] font-semibold text-slate-400 hover:text-rose-500 transition cursor-pointer"
            >
              {isAr ? 'تسجيل الخروج' : 'Se déconnecter'}
            </button>
          </div>
        </div>

        {/* Support Chat Bubble (Déjà présent et fonctionnel) */}
        <ChatBubble />
      </div>
    );
  }

  const renderPage = () => {
    const page = (() => {
      switch (currentPage) {
        case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
        case 'enfants': return <Enfants />;
        case 'admissions': return <Admissions />;
        case 'community': return <Community />;
        case 'classes': return <Classes />;
        case 'presences': return <Presences />;
        case 'paiements': return <Paiements />;
        case 'personnel': return <Personnel />;
        case 'activites': return <Activites />;
        case 'repas': return <Repas />;
        case 'comptes': return <Comptes />;
        case 'notifications': return <Notifications />;
        case 'communication': return <CommunicationAdmin />;
        case 'rapports': return <Rapports />;
        case 'parametres': return <Parametres />;
        default: return <Dashboard />;
      }
    })();
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400">Chargement...</div>}>
        {page}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#f8fafc]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(value => !value)}
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
      <div className={`min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ltr:pl-20 lg:rtl:pr-20' : 'lg:ltr:pl-72 lg:rtl:pr-72'}`}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 shadow-xs">
          <div className="min-w-0 px-3 sm:px-6 lg:px-10 py-3 sm:py-4">
            <div className="flex min-w-0 flex-col sm:flex-row gap-3 sm:gap-4 justify-between sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                  id="mobile-sidebar-toggle"
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex-shrink-0"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hidden sm:flex items-center justify-center flex-shrink-0 w-10 h-10 overflow-hidden">
                    {creche?.logoUrl ? (
                      <img src={creche.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <School className="w-5 h-5 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h1 className="min-w-0 max-w-[58vw] truncate text-sm sm:max-w-none sm:text-base md:text-lg lg:text-xl font-extrabold text-slate-950 tracking-tight flex items-center gap-1.5 leading-tight">
                      {creche?.nom}
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 rounded-md uppercase tracking-wider">PRO</span>
                    </h1>
                    <p className="max-w-[58vw] truncate text-[10px] sm:max-w-none sm:text-xs text-slate-500 font-medium leading-none mt-0.5">{creche?.adresse}</p>
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Statut essai/abonnement — uniquement pour les directeurs */}
                {user?.role === 'directeur' && (
                  <div className="min-w-0 max-w-full basis-full sm:basis-auto">
                    <SubscriptionStatusBadge
                    dateFinAbonnement={liveUser?.dateFinAbonnement}
                    abonnementActif={liveUser?.abonnementActif}
                    />
                  </div>
                )}

                {/* Cloche de notifications — uniquement pour les directeurs */}
                {user?.role === 'directeur' && (
                  <NotificationBell onNavigateToPaiements={() => setCurrentPage('paiements')} />
                )}

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowHelp(true)}
                    title={language === 'ar' ? 'شرح المنصة' : 'Comment fonctionne Rawdha+ ?'}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 cursor-pointer"
                  >
                    <CircleHelp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(value => !value)}
                    title={language === 'ar' ? (isSidebarCollapsed ? 'فتح القائمة' : 'طي القائمة') : (isSidebarCollapsed ? 'Ouvrir la barre' : 'Replier la barre')}
                    className="hidden lg:flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleBrowserFullscreen}
                    title={language === 'ar' ? (isBrowserFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة') : (isBrowserFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
                    className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 cursor-pointer"
                  >
                    {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Language Selector */}
                <div className="flex shrink-0 gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
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
                  className="shrink-0 px-3 sm:px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all font-bold text-xs flex items-center gap-2 cursor-pointer border border-rose-100/50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
<main className="min-w-0 overflow-x-hidden p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">
  {showLanguageChoice && user?.role === 'directeur' && (
    <LanguageChoiceModal onChoose={chooseInitialLanguage} />
  )}
  {!showLanguageChoice && showWelcome && user?.role === 'directeur' && (
    <WelcomeDirectorModal
      user={user}
      language={language as 'fr' | 'ar'}
      onLanguageChange={setLanguage}
      onDone={closeWelcome}
    />
  )}
  {!showLanguageChoice && !showWelcome && needsOnboarding && (
    <OnboardingCrecheModal onDone={() => setNeedsOnboarding(false)} />
  )}
  {renderPage()}
        </main>
      </div>

      <HelpCenterModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        currentPage={currentPage}
        language={language as 'fr' | 'ar'}
      />

      {/* Le support, les avis et les retours sont disponibles pour tous les comptes sauf l’admin. */}
      {user && user.role !== 'admin' && <ChatBubble />}

      {/* Popup d'annonce admin personnalisé — uniquement pour les directeurs */}
      {user?.role === 'directeur' && <NotificationPopup onNavigate={setCurrentPage} />}
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
