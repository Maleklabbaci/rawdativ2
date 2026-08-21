
import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react';
import { ArrowLeft, ArrowRight, School, LogOut, Menu, CircleHelp, Bell, MessageCircle, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { DbProvider, useDb } from './contexts/DbContext';
import SignIn from './components/SignIn';
import MobileWelcome from './components/MobileWelcome';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { ConfirmProvider } from './contexts/ConfirmDialogContext';
import {
  clearPushSessionUser,
  registerAndroidPushNotifications,
} from './services/pushNotifications';
// ✅ FIX (bundle size): ces pages ne sont chargées que quand l'utilisateur y navigue
// réellement, au lieu d'être toutes téléchargées dès le login (chunk unique 962 Ko avant).
// ✅ Récupération des chunks périmés : un onglet ouvert avant un déploiement peut
// conserver l'ancien index.js et demander un fichier hashé qui n'existe plus.
const CHUNK_RELOAD_KEY = 'rawdha_chunk_reload_once';

const PAGE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  enfants: '/enfants',
  admissions: '/admissions',
  community: '/community',
  classes: '/classes',
  presences: '/presences',
  paiements: '/factures',
  personnel: '/personnel',
  activites: '/activites',
  repas: '/repas',
  comptes: '/comptes',
  notifications: '/notifications',
  communication: '/communication',
  demarrage: '/demarrage',
  aide: '/aide',
  support: '/support',
  rapports: '/reports',
  parametres: '/parametres',
};

const PAGE_FROM_PATH: Record<string, string> = Object.entries(PAGE_PATHS).reduce(
  (routes, [page, path]) => {
    routes[path] = page;
    return routes;
  },
  {} as Record<string, string>,
);

const pageFromPathname = (pathname: string) => {
  const normalizedPath = `/${pathname.replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '/dashboard');
  return PAGE_FROM_PATH[normalizedPath] || 'dashboard';
};

const AUTH_PATHS = new Set(['/signin', '/login']);

const normalizeAuthPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

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
const NotificationsDirecteur = lazyWithRecovery(() => import('./components/NotificationsDirecteur'));
const Communication = lazyWithRecovery(() => import('./components/Communication'));
const CommunicationAdmin = lazyWithRecovery(() => import('./components/CommunicationAdmin'));
const Demarrage = lazyWithRecovery(() => import('./components/Demarrage'));
const Aide = lazyWithRecovery(() => import('./components/Aide'));
const Support = lazyWithRecovery(() => import('./components/Support'));
const Rapports = lazyWithRecovery(() => import('./components/Rapports'));
const Admissions = lazyWithRecovery(() => import('./components/Admissions'));
const Community = lazyWithRecovery(() => import('./components/Community'));
import PublicAdmission from './components/PublicAdmission';
import PrivacyPolicy from './components/PrivacyPolicy';
import SubscriptionStatusBadge from './components/SubscriptionStatusBadge';
import { AlertCircle, Lock, Check } from 'lucide-react';
import { hasCompletedOnboarding } from './components/OnboardingCrecheModal';

function AppContent() {
  const { isAuthenticated, user, creche, logout, loading: authLoading } = useAuth();
  const isPendingApproval = user?.role === 'directeur' && user.approvalStatus === 'pending';
  // La route est conservée dans l’état React : history.pushState() seul ne déclenche
  // pas de rendu, notamment dans certains WebViews Android.
  const [routeVersion, setRouteVersion] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => pageFromPathname(window.location.pathname));
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [showCouponInput, setShowCouponInput] = useState(false); // ✅ champ coupon replié par défaut, pour ne pas distraire du CTA principal // ✅ champ code coupon sur l'écran d'abonnement expiré
  const { language, setLanguage, t } = useLanguage();
  const { loading: dbLoading, comptes, communityFeatures } = useDb();
  const unreadSocialMessages = communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const unreadSocialNotifications = communityFeatures.filter(feature => feature.kind === 'social_notification' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const socialUnreadCount = unreadSocialMessages + unreadSocialNotifications;
  const { showToast } = useToast();
  // routeVersion est volontairement lu ici : il force le recalcul des routes après
  // toute modification interne de l’historique, sans dépendre d’un PopStateEvent.
  void routeVersion;
  const isPublicAdmission = window.location.pathname.replace(/\/+$/, '') === '/admission';
  const isPublicPrivacy = window.location.pathname.replace(/\/+$/, '') === '/confidentialite';
  const normalizedPathname = normalizeAuthPath(window.location.pathname);
  const isAccessRequest = normalizedPathname === '/signin';
  const isPublicWelcome = normalizedPathname === '/welcome';
  const isMobileWelcomeScreen = isPublicWelcome && !isDesktopViewport;

  const navigateToPage = (page: string, options?: { replace?: boolean }) => {
    const nextPage = PAGE_PATHS[page] ? page : 'dashboard';
    const nextPath = PAGE_PATHS[nextPage];
    setCurrentPage(nextPage);

    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      const method = options?.replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', nextPath);
      setRouteVersion((version) => version + 1);
    }
  };

  const navigateToPublicPath = (path: '/login/' | '/signin/', options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;
    const nextPath = path;
    if (window.location.pathname !== nextPath) {
      const method = options?.replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', `${nextPath}${window.location.search}${window.location.hash}`);
    }
    // Cette mise à jour est indispensable : pushState/replaceState ne déclenchent
    // pas l’évènement popstate par eux-mêmes.
    setRouteVersion((version) => version + 1);
  };

  // ✅ Onboarding premier login : on vérifie une fois si le directeur a déjà rempli
  // ses infos de crèche (existence du doc "parametres/creche_{id}"). null = pas encore vérifié.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  useEffect(() => {
    if (user?.role === 'directeur' && user.approvalStatus !== 'pending') {
      hasCompletedOnboarding(user.id).then(done => {
        setNeedsOnboarding(!done);
        if (!done && window.location.pathname !== PAGE_PATHS.demarrage) {
          window.history.replaceState({}, '', PAGE_PATHS.demarrage);
          setCurrentPage('demarrage');
        }
      });
    } else {
      setNeedsOnboarding(false);
    }
  }, [user?.id, user?.role, user?.approvalStatus]);

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
    const updateViewport = () => setIsDesktopViewport(window.innerWidth >= 1024);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(pageFromPathname(window.location.pathname));
      setRouteVersion((version) => version + 1);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Les notifications natives sont initialisées uniquement après connexion : le jeton
  // Firebase reste ainsi associé au bon compte Rawdha+ et à aucune session anonyme.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      clearPushSessionUser();
      return;
    }

    let cancelled = false;
    void registerAndroidPushNotifications(user.id).then((result) => {
      if (cancelled || result.status !== 'error') return;
      console.error('Rawdha+ : notifications Android indisponibles.', result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Une alerte reçue lorsque l’application est déjà ouverte est rendue visible dans
  // Rawdha+ au lieu d’être silencieusement ignorée par le système Android.
  useEffect(() => {
    const handleForegroundPush = (event: Event) => {
      const notification = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      if (!notification) return;
      const content = [notification.title, notification.body].filter(Boolean).join(' — ');
      if (content) showToast(content, 'info', 6500);
    };

    window.addEventListener('rawdha:push-received', handleForegroundPush);
    return () => window.removeEventListener('rawdha:push-received', handleForegroundPush);
  }, [showToast]);

  // Toucher une notification Android ouvre l’écran sélectionné par l’administrateur.
  // Les liens externes sont limités à HTTP(S) afin de ne jamais exécuter d’URI non sûre.
  useEffect(() => {
    const handlePushAction = (event: Event) => {
      const detail = (event as CustomEvent<{ page?: unknown; url?: unknown }>).detail;
      const page = typeof detail?.page === 'string' ? detail.page : '';
      const url = typeof detail?.url === 'string' ? detail.url : '';

      if (page && PAGE_PATHS[page]) navigateToPage(page);
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
    };

    window.addEventListener('rawdha:push-action', handlePushAction);
    return () => window.removeEventListener('rawdha:push-action', handlePushAction);
  }, [currentPage]);

  useEffect(() => {
    if (isAuthenticated || isPublicAdmission || isPublicPrivacy) return;
    const normalizedPath = normalizeAuthPath(window.location.pathname);
    const queryAndHash = `${window.location.search}${window.location.hash}`;

    if (AUTH_PATHS.has(normalizedPath) || (normalizedPath === '/welcome' && !isDesktopViewport)) {
      const canonicalPath = `${normalizedPath}/${queryAndHash}`;
      if (window.location.pathname !== `${normalizedPath}/`) {
        window.history.replaceState({}, '', canonicalPath);
        setRouteVersion((version) => version + 1);
      }
      return;
    }

    // L’accueil est réservé au téléphone ; sur ordinateur, on ouvre directement le formulaire.
    window.history.replaceState({}, '', `${isDesktopViewport ? '/login/' : '/welcome/'}${queryAndHash}`);
    setRouteVersion((version) => version + 1);
  }, [isAuthenticated, isDesktopViewport, isPublicAdmission, isPublicPrivacy]);

  useEffect(() => {
    if (!isAuthenticated || isPublicAdmission || isPublicPrivacy) return;
    const expectedPath = PAGE_PATHS[currentPage] || PAGE_PATHS.dashboard;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath);
    }
  }, [isAuthenticated, isPublicAdmission, currentPage]);

  useEffect(() => {
    if (user?.role === 'admin') {
      if (currentPage !== 'comptes' && currentPage !== 'parametres' && currentPage !== 'notifications' && currentPage !== 'communication' && currentPage !== 'community') {
        navigateToPage('comptes', { replace: true });
      }
    } else if (currentPage === 'comptes') {
      navigateToPage('dashboard', { replace: true });
    }
  }, [user?.role, currentPage]);

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

    if (!isAuthenticated && !isPublicAdmission && !isPublicPrivacy) {
      document.title = isMobileWelcomeScreen
        ? (language === 'ar' ? 'مرحباً — روضة+' : 'Bienvenue — RAWDHA+')
        : isAccessRequest
          ? (language === 'ar' ? 'طلب الوصول — RAWDHA+' : 'Demander un accès — RAWDHA+')
          : (language === 'ar' ? 'تسجيل الدخول — RAWDHA+' : 'Connexion — RAWDHA+');
      return;
    }

    const pageTitleKeys: Record<string, string> = {
      dashboard: 'dashboard',
      enfants: 'children',
      classes: 'classes',
      presences: 'attendance',
      paiements: 'invoices',
      rapports: 'reports',
      personnel: 'staff',
      activites: 'activities',
      repas: 'meals',
      parametres: 'settings',
      comptes: 'comptes',
    };
    const fallbackPageTitles: Record<string, string> = {
      admissions: language === 'ar' ? 'طلبات التسجيل' : 'Admissions',
      notifications: language === 'ar' ? 'الإشعارات' : 'Notifications',
      communication: language === 'ar' ? 'الرسائل والتقييمات والملاحظات' : 'Messages, Avis & Retours',
      community: 'Rawdha Connect',
    };
    const pageName = pageTitleKeys[currentPage]
      ? t(pageTitleKeys[currentPage])
      : fallbackPageTitles[currentPage] || 'RAWDHA+';
    document.title = `${pageName} — RAWDHA+`;
  }, [creche?.logoUrl, creche?.nom, currentPage, isAccessRequest, isAuthenticated, isMobileWelcomeScreen, isPublicAdmission, isPublicPrivacy, language, t]);

  if (isPublicPrivacy) {
    return <PrivacyPolicy />;
  }

  if (isPublicAdmission) {
    return <PublicAdmission />;
  }

  // Les routes publiques ne doivent jamais montrer un écran technique de restauration.
  // L’accueil et la connexion restent immédiatement visibles, même durant la vérification silencieuse de session.
  if (!isAuthenticated) {
    if (isMobileWelcomeScreen) {
      return <MobileWelcome onContinue={() => navigateToPublicPath('/login/', { replace: true })} />;
    }
    return <SignIn mode={isAccessRequest ? 'request' : 'signin'} />;
  }

  // Pour un utilisateur déjà connecté, on attend la restauration de session et des données métier.
  if (authLoading || dbLoading) {
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

if (isSubscriptionExpired && !isPendingApproval) {
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

      </div>
    );
  }

  if (currentPage === 'community') {
    const isAr = language === 'ar';
    return (
      <div className="min-h-screen bg-[#f5f7fb]" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <Network className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-black tracking-tight text-slate-900 sm:text-lg">Rawdha Connect</h1>
                  <span className="hidden rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 sm:inline-flex">Extension Rawdha+</span>
                  {socialUnreadCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700"><Bell className="h-3 w-3" />{socialUnreadCount > 99 ? '99+' : socialUnreadCount}</span>}
                </div>
                <p className="truncate text-[11px] font-semibold text-slate-500">{isAr ? 'المساحة الاجتماعية المهنية لدور الحضانة' : 'L’espace social professionnel des crèches'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 lg:flex">
                <img src="/rawdah-logo.png" alt="Rawdha+" className="h-5 w-5 rounded-md object-contain" />
                <span>{isAr ? 'متصل بمنصة Rawdha+' : 'Connecté à la plateforme Rawdha+'}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setLanguage('fr')} aria-pressed={!isAr} className={`rounded-lg px-2 py-1.5 text-[10px] font-black transition ${!isAr ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>FR</button>
                <button type="button" onClick={() => setLanguage('ar')} aria-pressed={isAr} className={`rounded-lg px-2 py-1.5 text-[10px] font-black transition ${isAr ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>عربي</button>
              </div>
              <button type="button" onClick={() => navigateToPage('dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[0.98] sm:px-4">
                {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                <span className="hidden sm:inline">{isAr ? 'العودة إلى التسيير' : 'Retour à la gestion'}</span>
                <span className="sm:hidden">{isAr ? 'التسيير' : 'Gestion'}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-73px)]">
          <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-slate-400">{isAr ? 'جارٍ تحميل Rawdha Connect...' : 'Chargement de Rawdha Connect...'}</div>}>
            <Community />
          </Suspense>
        </main>
      </div>
    );
  }

  const renderPage = () => {
    const page = (() => {
      switch (currentPage) {
        case 'dashboard': return <Dashboard onNavigate={navigateToPage} />;
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
        case 'notifications': return user?.role === 'directeur' ? <NotificationsDirecteur onNavigateToPaiements={() => navigateToPage('paiements')} /> : <Notifications />;
        case 'communication': return user?.role === 'directeur' ? <Communication /> : <CommunicationAdmin />;
        case 'demarrage': return <Demarrage onDone={() => { setNeedsOnboarding(false); navigateToPage('dashboard'); }} />;
        case 'aide': return <Aide />;
        case 'support': return <Support />;
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
        onPageChange={navigateToPage}
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
                {/* Statut d’approbation / abonnement — uniquement pour les directeurs */}
                {isPendingApproval ? (
                  <div className="min-w-0 max-w-full basis-full sm:basis-auto inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    {language === 'ar' ? 'في انتظار موافقة الإدارة — وضع القراءة فقط' : 'En attente de validation — lecture seule'}
                  </div>
                ) : user?.role === 'directeur' && (
                  <div className="min-w-0 max-w-full basis-full sm:basis-auto">
                    <SubscriptionStatusBadge
                    dateFinAbonnement={liveUser?.dateFinAbonnement}
                    abonnementActif={liveUser?.abonnementActif}
                    />
                  </div>
                )}

                {/* Notifications : accès à une page classique, sans panneau flottant */}
                {user?.role === 'directeur' && (
                  <button type="button" onClick={() => navigateToPage('notifications')} aria-label={language === 'ar' ? 'الإشعارات' : 'Notifications'} title={language === 'ar' ? 'الإشعارات' : 'Notifications'} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 cursor-pointer">
                    <Bell className="w-4 h-4" />
                  </button>
                )}
                {unreadSocialMessages > 0 && <button type="button" onClick={() => navigateToPage('community')} aria-label={language === 'ar' ? 'رسائل Rawdha Connect الجديدة' : 'Nouveaux messages Rawdha Connect'} title={language === 'ar' ? 'رسائل Rawdha Connect الجديدة' : 'Nouveaux messages Rawdha Connect'} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 cursor-pointer"><MessageCircle className="w-4 h-4" /><span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white">{unreadSocialMessages > 99 ? '99+' : unreadSocialMessages}</span></button>}

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigateToPage('aide')}
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
          {isPendingApproval && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
              <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700"><Lock className="h-5 w-5" /></div>
              <div>
                <p className="font-black">{language === 'ar' ? 'حسابك في انتظار موافقة الإدارة' : 'Votre compte est en attente de validation'}</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  {language === 'ar' ? 'يمكنك تصفح المنصة، لكن لن تتمكن من إضافة أو تعديل أو حذف أي بيانات حتى يؤكد المسؤول حسابك.' : 'Vous pouvez consulter la plateforme, mais aucun ajout, modification ou suppression ne sera autorisé avant la confirmation manuelle de l’administrateur.'}
                </p>
              </div>
            </div>
          )}
          {renderPage()}
        </main>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ConfirmProvider>
        <ToastProvider>
        <AuthProvider>
          <DbProvider>
            <AppContent />
            <ToastContainer />
          </DbProvider>
        </AuthProvider>
      </ToastProvider>
      </ConfirmProvider>
    </LanguageProvider>
  );
}
