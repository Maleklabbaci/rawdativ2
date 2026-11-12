// Style shell Rawdha+ : modules métier isolés, navigation mobile compacte et routes explicites pour chaque outil de direction.
import { useState, useEffect, useRef, useTransition, lazy, Suspense, type ComponentType } from 'react';
import { ArrowLeft, ArrowRight, School, LogOut, Menu, Bell, MessageCircle, Maximize2, Minimize2, Network, Search, Users, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { DbProvider, useDb } from './contexts/DbContext';
import { WorkspaceProfileProvider, useWorkspaceProfile } from './contexts/WorkspaceProfileContext';
import ProfileSelectorScreen from './components/ProfileSelectorScreen';
import Sidebar from './components/Sidebar';
import SupportBubble from './components/SupportBubble';
import NotificationBell from './components/NotificationBell';
import MobileBottomNav from './components/MobileBottomNav';
import MobileAppHubSheet from './components/MobileAppHubSheet';
import QuickSearchModal from './components/QuickSearchModal';
import PageSkeleton from './components/PageSkeleton';
import CookieConsentBanner from './components/CookieConsentBanner';
import SubscriptionRenewalModal from './components/SubscriptionRenewalModal';
import SlickPayFullScreenLock from './components/SlickPayFullScreenLock';
import { isLegalPathname, LEGAL_CONFIG } from './config/legal';
import {
  clearPendingSlickPayOrder,
  getPendingSlickPayOrder,
  savePendingSlickPayOrder,
  SUBSCRIPTION_PROMO_CODES,
  verifySlickPaySubscriptionOrder,
  watchSlickPayOrderInBackground,
  type PendingSlickPayOrder,
} from './utils/subscriptionRenewal';
import { prefetchCoreRoutesOnIdle } from './utils/routePrefetch';
import { initNotificationAudioUnlock, playNotificationChime } from './utils/notificationSound';
import { installUnsavedFormGuard } from './utils/unsavedFormGuard';
import type { Enfant } from './types';

const LazyDemoProviders =
  import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true'
    ? lazy(() => import('./demo/DemoProviders').then(mod => ({ default: mod.DemoProviders })))
    : null;
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
  achats: '/achats',
  personnel: '/personnel',
  activites: '/activites',
  repas: '/repas',
  admin: '/admin',
  logs: '/logs',
  comptes: '/comptes',
  notifications: '/notifications',
  communication: '/communication',
  demarrage: '/demarrage',
  aide: '/aide',
  support: '/support',
  rapports: '/reports',
  parametres: '/parametres',
  abonnement: '/abonnement',
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

const Dashboard = lazyWithRecovery(() => import('./components/Dashboard'));
const LandingPage = lazyWithRecovery(() => import('./components/LandingPage'));
const SignIn = lazyWithRecovery(() => import('./components/SignIn'));
const MobileWelcome = lazyWithRecovery(() => import('./components/MobileWelcome'));
const PublicAdmission = lazyWithRecovery(() => import('./components/PublicAdmission'));
const PublicParentPortal = lazyWithRecovery(() => import('./components/PublicParentPortal'));
const PrivacyPolicy = lazyWithRecovery(() => import('./components/PrivacyPolicy'));
const Enfants = lazyWithRecovery(() => import('./components/Enfants'));
const Classes = lazyWithRecovery(() => import('./components/Classes'));
const Presences = lazyWithRecovery(() => import('./components/Presences'));
const Paiements = lazyWithRecovery(() => import('./components/Paiements'));
const Achats = lazyWithRecovery(() => import('./components/Achats'));
const Personnel = lazyWithRecovery(() => import('./components/Personnel'));
const Activites = lazyWithRecovery(() => import('./components/Activites'));
const Repas = lazyWithRecovery(() => import('./components/Repas'));
const Parametres = lazyWithRecovery(() => import('./components/Parametres'));
const AdminCenter = lazyWithRecovery(() => import('./components/AdminCenter'));
const ApplicationLogs = lazyWithRecovery(() => import('./components/ApplicationLogs'));
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
const AbonnementPaiement = lazyWithRecovery(() => import('./components/AbonnementPaiement'));
const EnfantDetails = lazyWithRecovery(() => import('./components/EnfantDetails'));
import SubscriptionStatusBadge from './components/SubscriptionStatusBadge';
import { AlertCircle, Lock, Check, CreditCard } from 'lucide-react';
import { hasCompletedOnboarding } from './components/OnboardingCrecheModal';
import DataLoadGuard from './components/DataLoadGuard';
import FirstRunOnboarding, { type OnboardingProgress, type OnboardingPage } from './components/FirstRunOnboarding';
import { prepareSetupTask } from './utils/onboardingTask';
import { supabase } from './supabase';
import { recordApplicationEvent, recordCodeError } from './utils/applicationEvents';

function AppContent() {
  const { isAuthenticated, user, creche, logout, loading: authLoading } = useAuth();
  const isPendingApproval = user?.role === 'directeur' && user.approvalStatus === 'pending';
  // La route est conservée dans l’état React : history.pushState() seul ne déclenche
  // pas de rendu, notamment dans certains WebViews Android.
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return;
    return installUnsavedFormGuard(document, window);
  }, [isAuthenticated, user?.id]);
  const [routeVersion, setRouteVersion] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => pageFromPathname(window.location.pathname));
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    recordApplicationEvent('page_view', currentPage);
    const onError = (event: ErrorEvent) => recordCodeError(currentPage, event);
    const onRejection = (event: PromiseRejectionEvent) => recordApplicationEvent('async_error', currentPage, undefined, event.reason);
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, [isAuthenticated, user?.id, currentPage]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileHubOpen, setIsMobileHubOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [quickDossierChild, setQuickDossierChild] = useState<Enfant | null>(null);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine === false : false));
  const [isRoutePending, startRouteTransition] = useTransition();
  const [couponCode, setCouponCode] = useState('');
  const [showCouponInput, setShowCouponInput] = useState(false); // ✅ champ coupon replié par défaut, pour ne pas distraire du CTA principal // ✅ champ code coupon sur l'écran d'abonnement expiré
  const [showExpiredRenewalModal, setShowExpiredRenewalModal] = useState(false);
  const [expiredRenewalSent, setExpiredRenewalSent] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const {
    loading: dbLoading,
    dataLoading = false,
    dataErrors = [],
    refreshAll,
    comptes,
    communityFeatures,
    notifications,
    enfants,
    demandesAdmission = [],
    demandesDirecteur = [],
    messages = [],
    signalements = [],
  } = useDb();
  const { activeProfile, loadingProfiles, requiresProfileSelection, canAccessPage, lockProfile } = useWorkspaceProfile();
  const unreadSocialMessages = communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const unreadSocialNotifications = communityFeatures.filter(feature => feature.kind === 'social_notification' && feature.recipientId === user?.id && feature.payload?.read !== true).length;
  const socialUnreadCount = unreadSocialMessages + unreadSocialNotifications;
  const seenAlertIdsRef = useRef<{ userId: string | null; ids: Set<string> }>({
    userId: null,
    ids: new Set(),
  });
  const { showToast } = useToast();
  // routeVersion est volontairement lu ici : il force le recalcul des routes après
  // toute modification interne de l’historique, sans dépendre d’un PopStateEvent.
  void routeVersion;
  const isPublicAdmission = window.location.pathname.replace(/\/+$/, '') === '/admission';
  const isPublicParentSpace = window.location.pathname.replace(/\/+$/, '') === '/espace-parent' || Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' && import.meta.env.VITE_DEMO_PARENT === 'true' && window.location.pathname === '/');
  const isPublicPrivacy = isLegalPathname(window.location.pathname);
  const normalizedPathname = normalizeAuthPath(window.location.pathname);
  const isPasswordRecoveryUrl =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('type=recovery') ||
      new URLSearchParams(window.location.search).get('reset') === '1');
  const isPublicLanding = normalizedPathname === '/';
  const isAccessRequest = normalizedPathname === '/signin';
  const isPublicWelcome = normalizedPathname === '/welcome';
  const isMobileWelcomeScreen = isPublicWelcome && !isDesktopViewport;

  const navigateToPage = (page: string, options?: { replace?: boolean }) => {
    const nextPage = PAGE_PATHS[page] ? page : 'dashboard';
    const nextPath = PAGE_PATHS[nextPage];

    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      const method = options?.replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', nextPath);
    }
    startRouteTransition(() => {
      setCurrentPage(nextPage);
      setRouteVersion((version) => version + 1);
    });
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

  // New accounts have their own server-side progress. Existing accounts keep the legacy flow.
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);
  const [onboardingState, setOnboardingState] = useState<'checking' | 'ready' | 'inactive' | 'error'>('checking');
  const [onboardingReload, setOnboardingReload] = useState(0);
  const [onboardingBannerError, setOnboardingBannerError] = useState(false);
  const isDemoOnboarding = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' && typeof window !== 'undefined' && (import.meta.env.VITE_DEMO_ONBOARDING === 'true' || new URLSearchParams(window.location.search).get('setup_preview') === '1' || sessionStorage.getItem('rawdha:setup-demo') === '1'));
  useEffect(() => {
    let cancelled = false;
    if (!user?.id || user.role !== 'directeur' || isPendingApproval) { setOnboarding(null); setOnboardingState('inactive'); return; }
    if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') {
      if (isDemoOnboarding) {
        sessionStorage.setItem('rawdha:setup-demo', '1');
        const stored = sessionStorage.getItem(`rawdha:setup-demo:${user.id}`);
        let progress: OnboardingProgress = { account_id: user.id, step: 'welcome', language: null, task_page: null };
        try { if (stored) progress = JSON.parse(stored) as OnboardingProgress; } catch { /* start preview over */ }
        setOnboarding(progress); setOnboardingState('ready');
      } else { setOnboarding(null); setOnboardingState('inactive'); }
      return;
    }
    setOnboardingState('checking'); setOnboarding(null);
    void (async () => {
      try {
        const { data, error } = await supabase.from('director_onboarding').select('account_id,step,language,task_page').eq('account_id', user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data) {
          const progress = data as OnboardingProgress;
          setOnboarding(progress); setOnboardingState('ready');
          if (progress.language) setLanguage(progress.language);
        } else {
          setOnboardingState('inactive');
          // Preserve the old first-configuration screen for legacy accounts.
          const done = await hasCompletedOnboarding(user.id);
          if (!cancelled && !done && window.location.pathname !== PAGE_PATHS.demarrage) navigateToPage('demarrage', { replace: true });
        }
      } catch { if (!cancelled) setOnboardingState('error'); }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.approvalStatus, onboardingReload]);
  const saveOnboarding = async (patch: Partial<OnboardingProgress>) => {
    if (!user?.id || !onboarding || onboarding.account_id !== user.id) throw new Error('onboarding unavailable');
    if (isDemoOnboarding) {
      const next = { ...onboarding, ...patch }; sessionStorage.setItem(`rawdha:setup-demo:${user.id}`, JSON.stringify(next)); setOnboarding(next); if (patch.step === 'done') navigateToPage('dashboard'); return;
    }
    const { data, error } = await supabase.from('director_onboarding').update({ ...patch, updated_at: new Date().toISOString() }).eq('account_id', user.id).select('account_id,step,language,task_page').single();
    if (error || !data) throw error || new Error('onboarding save failed');
    setOnboarding(data as OnboardingProgress);
    if (patch.step === 'done') navigateToPage('dashboard');
  };
  const openOnboardingTask = async (page: OnboardingPage) => {
    await saveOnboarding({ task_page: page });
    if (user?.id) prepareSetupTask(user.id, page);
    navigateToPage(page);
  };
  const resumeOnboarding = async () => {
    if (!onboarding) return;
    const next = onboarding.step === 'children' ? 'classes' : onboarding.step === 'classes' ? 'team' : 'done';
    try { setOnboardingBannerError(false); await saveOnboarding({ task_page: null, step: next }); }
    catch { setOnboardingBannerError(true); }
  };

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
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      showToast(language === 'ar' ? 'عاد الاتصال بالإنترنت.' : 'Connexion Internet rétablie.', 'success');
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [language, showToast]);

  useEffect(() => {
    if (!isAuthenticated || isPendingApproval) return;
    prefetchCoreRoutesOnIdle(user?.role);
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, isPendingApproval, user?.role]);

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
    if ((import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') || !isAuthenticated || !user?.id) {
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

  // Déverrouillage passif Web Audio au premier geste utilisateur
  useEffect(() => {
    initNotificationAudioUnlock();
  }, []);

  // Capture globale de `?slickpay_order=...` au retour de SATIM (même sur un compte expiré)
  // + verrouillage plein écran global sur toute la plateforme jusqu'à confirmation du paiement.
  const [globalPendingSlickPay, setGlobalPendingSlickPay] = useState<PendingSlickPayOrder | null>(() => {
    if (typeof window === 'undefined') return null;
    return getPendingSlickPayOrder(user?.id);
  });
  const [globalPollAttempt, setGlobalPollAttempt] = useState(0);
  const [globalRechecking, setGlobalRechecking] = useState(false);
  const [globalConfirmedEndDate, setGlobalConfirmedEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || user.role !== 'directeur') {
      setGlobalPendingSlickPay(null);
      return;
    }
    const urlOrderId =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('slickpay_order') : null;
    if (urlOrderId) {
      const saved: PendingSlickPayOrder = {
        orderId: urlOrderId,
        invoiceId: '',
        directorId: user.id,
        paymentUrl: '',
        amountDzd: LEGAL_CONFIG.monthlyPlanPriceDzd,
        planMonths: 1,
        mode: 'live',
        createdAt: new Date().toISOString(),
      };
      savePendingSlickPayOrder(saved);
      setGlobalPendingSlickPay(saved);
      setCurrentPage('abonnement');
    }
    const syncPending = () => {
      setGlobalPendingSlickPay(getPendingSlickPayOrder(user.id));
    };
    syncPending();
    window.addEventListener('rawdha-slickpay-pending-changed', syncPending);
    window.addEventListener('rawdha-subscription-activated', syncPending);
    return () => {
      window.removeEventListener('rawdha-slickpay-pending-changed', syncPending);
      window.removeEventListener('rawdha-subscription-activated', syncPending);
    };
  }, [user?.id, user?.role]);

  const liveAccountForWatcher = user ? comptes.find(c => c.id === user.id) || user : null;
  const isAccountCurrentlyExpired = (() => {
    if (!liveAccountForWatcher || liveAccountForWatcher.role !== 'directeur') return false;
    if (!liveAccountForWatcher.abonnementActif) return true;
    if (liveAccountForWatcher.dateFinAbonnement) {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (todayIso > liveAccountForWatcher.dateFinAbonnement) return true;
    }
    return false;
  })();

  const abonnementPageMounted = currentPage === 'abonnement' && !isAccountCurrentlyExpired;

  useEffect(() => {
    if (!user?.id || !globalPendingSlickPay?.orderId || abonnementPageMounted) {
      setGlobalPollAttempt(0);
      return;
    }
    return watchSlickPayOrderInBackground({
      orderId: globalPendingSlickPay.orderId,
      directorId: user.id,
      intervalMs: 2500,
      maxAttempts: 36,
      onTick: attempt => setGlobalPollAttempt(attempt),
      onResolved: res => {
        setGlobalPendingSlickPay(null);
        if (res.status === 'paid') {
          if (res.newEndDate) {
            setGlobalConfirmedEndDate(res.newEndDate);
            setTimeout(() => setGlobalConfirmedEndDate(null), 1300);
          }
          playNotificationChime({ urgent: false });
          showToast(
            language === 'ar'
              ? 'تم تأكيد الدفع وتمديد اشتراكك بنجاح!'
              : 'Paiement CIB / Edahabia confirmé — abonnement prolongé !',
            'success'
          );
        }
      },
    });
  }, [user?.id, globalPendingSlickPay?.orderId, abonnementPageMounted, language, showToast]);

  const handleGlobalRecheckNow = async () => {
    if (!globalPendingSlickPay?.orderId || globalRechecking) return;
    setGlobalRechecking(true);
    try {
      const res = await verifySlickPaySubscriptionOrder(globalPendingSlickPay.orderId);
      if (res.status === 'paid') {
        clearPendingSlickPayOrder(globalPendingSlickPay.orderId);
        setGlobalPendingSlickPay(null);
        if (res.newEndDate) {
          setGlobalConfirmedEndDate(res.newEndDate);
          setTimeout(() => setGlobalConfirmedEndDate(null), 1300);
        }
      } else if (res.status === 'failed') {
        clearPendingSlickPayOrder(globalPendingSlickPay.orderId);
        setGlobalPendingSlickPay(null);
      }
    } finally {
      setGlobalRechecking(false);
    }
  };

  const globalSlickPayLockOverlay = !abonnementPageMounted ? (
    <SlickPayFullScreenLock
      open={Boolean(globalPendingSlickPay) || Boolean(globalConfirmedEndDate)}
      phase={globalConfirmedEndDate ? 'confirmed' : 'waiting'}
      isArabic={language === 'ar'}
      amountDzd={globalPendingSlickPay?.amountDzd}
      planMonths={globalPendingSlickPay?.planMonths}
      invoiceId={globalPendingSlickPay?.invoiceId}
      paymentUrl={globalPendingSlickPay?.paymentUrl}
      pollAttempt={globalPollAttempt}
      rechecking={globalRechecking}
      confirmedEndDate={globalConfirmedEndDate || undefined}
      onRecheckNow={handleGlobalRecheckNow}
      onCancelWait={() => {
        if (globalPendingSlickPay) clearPendingSlickPayOrder(globalPendingSlickPay.orderId);
        setGlobalPendingSlickPay(null);
      }}
      onDismissConfirmed={() => setGlobalConfirmedEndDate(null)}
    />
  ) : null;

  // Détection en temps réel des NOUVELLES notifications entrantes -> sonnerie douce + toast
  useEffect(() => {
    if (!isAuthenticated || !user?.id || dbLoading || loadingProfiles || isPendingApproval) {
      seenAlertIdsRef.current = { userId: null, ids: new Set() };
      return;
    }

    const currentIds = new Set<string>();
    let latestToastLabel = '';
    let isUrgent = false;

    if (user.role === 'directeur') {
      for (const notif of notifications) {
        const targeted =
          notif.recipientRole === 'all_directeurs' ||
          notif.recipientRole === user.id ||
          notif.recipientIds?.includes(user.id);
        if (targeted && !(notif.readBy || []).includes(user.id)) {
          const key = `notif:${notif.id}`;
          currentIds.add(key);
          if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
            latestToastLabel =
              language === 'ar'
                ? `إشعار جديد: ${notif.title}`
                : `Nouvelle annonce : ${notif.title}`;
            if (notif.showAsPopup) isUrgent = true;
          }
        }
      }
      if (canAccessPage('admissions')) {
        for (const adm of demandesAdmission) {
          if (adm.crecheId === user.id && adm.statut === 'en_attente') {
            const key = `adm:${adm.id}`;
            currentIds.add(key);
            if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
              latestToastLabel =
                language === 'ar'
                  ? `طلب تسجيل QR جديد: ${adm.prenom} ${adm.nom}`
                  : `Nouvelle pré-inscription QR : ${adm.prenom} ${adm.nom}`;
            }
          }
        }
      }
    } else if (user.role === 'admin') {
      for (const req of demandesDirecteur) {
        if (req.statut === 'en_attente') {
          const key = `dir-req:${req.id}`;
          currentIds.add(key);
          if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
            latestToastLabel =
              language === 'ar'
                ? `طلب مديرة جديد: ${req.nomCreche}`
                : `Nouvelle demande crèche : ${req.nomCreche}`;
          }
        }
      }
      for (const sig of signalements) {
        if ((sig as any).statut === 'nouveau') {
          const key = `sig:${sig.id}`;
          currentIds.add(key);
          if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
            latestToastLabel =
              language === 'ar'
                ? `بلاغ دعم جديد: ${(sig as any).titre || ''}`
                : `Nouveau ticket support : ${(sig as any).titre || ''}`;
          }
        }
      }
    }

    for (const msg of messages as any[]) {
      const forMe =
        user.role === 'admin'
          ? msg.recipientId === 'admin' || msg.recipientId === user.id
          : msg.recipientId === user.id;
      if (forMe && msg.senderId !== user.id && msg.isRead !== true) {
        const key = `msg:${msg.id}`;
        currentIds.add(key);
        if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
          latestToastLabel =
            language === 'ar'
              ? `رسالة جديدة من ${msg.senderName || 'الدعم'}`
              : `Nouveau message de ${msg.senderName || 'Support Rawdha+'}`;
        }
      }
    }

    for (const feat of communityFeatures) {
      if (
        (feat.kind === 'private_message' || feat.kind === 'social_notification') &&
        feat.recipientId === user.id &&
        feat.payload?.read !== true
      ) {
        const key = `social:${feat.id}`;
        currentIds.add(key);
        if (seenAlertIdsRef.current.userId === user.id && !seenAlertIdsRef.current.ids.has(key)) {
          latestToastLabel =
            language === 'ar'
              ? 'إشعار جديد على Rawdha Connect'
              : 'Nouvelle notification Rawdha Connect';
        }
      }
    }

    // Première hydratation pour cet utilisateur : on mémorise sans faire sonner au rechargement
    if (seenAlertIdsRef.current.userId !== user.id) {
      seenAlertIdsRef.current = { userId: user.id, ids: currentIds };
      return;
    }

    let hasNewArrival = false;
    for (const key of currentIds) {
      if (!seenAlertIdsRef.current.ids.has(key)) {
        hasNewArrival = true;
        break;
      }
    }
    seenAlertIdsRef.current = { userId: user.id, ids: currentIds };

    if (hasNewArrival) {
      playNotificationChime({ urgent: isUrgent });
      if (latestToastLabel) {
        showToast(latestToastLabel, 'info', 4500);
      }
    }
  }, [
    isAuthenticated,
    user?.id,
    user?.role,
    dbLoading,
    loadingProfiles,
    isPendingApproval,
    notifications,
    demandesAdmission,
    demandesDirecteur,
    signalements,
    messages,
    communityFeatures,
    canAccessPage,
    language,
    showToast,
  ]);

  // Une alerte reçue lorsque l’application est déjà ouverte est rendue visible dans
  // Rawdha+ au lieu d’être silencieusement ignorée par le système Android.
  useEffect(() => {
    const handleForegroundPush = (event: Event) => {
      const notification = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      if (!notification) return;
      playNotificationChime();
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
    // Ne jamais remplacer une route de gestion par /login pendant que Supabase relit
    // la session persistante de l’appareil. Sans cette garde, un redémarrage pouvait
    // brièvement afficher la connexion alors que le refresh token était encore valide.
    if (authLoading || isAuthenticated || isPublicAdmission || isPublicParentSpace || isPublicPrivacy || isPublicLanding) return;
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
  }, [authLoading, isAuthenticated, isDesktopViewport, isPublicAdmission, isPublicParentSpace, isPublicPrivacy, isPublicLanding]);

  useEffect(() => {
    if (!isAuthenticated || isPublicAdmission || isPublicParentSpace || isPublicPrivacy) return;
    const expectedPath = PAGE_PATHS[currentPage] || PAGE_PATHS.dashboard;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath);
    }
  }, [isAuthenticated, isPublicAdmission, isPublicParentSpace, isPublicPrivacy, currentPage]);

  useEffect(() => {
    if (user?.role === 'admin') {
      if (currentPage !== 'admin' && currentPage !== 'logs' && currentPage !== 'comptes' && currentPage !== 'parametres' && currentPage !== 'notifications' && currentPage !== 'communication' && currentPage !== 'community') {
        navigateToPage('admin', { replace: true });
      }
    } else if (currentPage === 'comptes' || currentPage === 'admin' || currentPage === 'logs') {
      navigateToPage('dashboard', { replace: true });
    } else if (user?.role === 'directeur' && activeProfile && !canAccessPage(currentPage)) {
      const fallbackPage = activeProfile.allowedPages.find(p => PAGE_PATHS[p]) || 'presences';
      if (fallbackPage !== currentPage) {
        navigateToPage(fallbackPage, { replace: true });
      }
    }
  }, [user?.role, currentPage, activeProfile, canAccessPage]);

  // ✅ Favicon + titre d'onglet dynamiques : le logo PNG uploadé dans Paramètres
  // remplace l'icône par défaut de RAWDHA+ dans la barre de tâches / onglet du navigateur.
  useEffect(() => {
    const faviconHref = isPublicLanding ? '/rawdah-logo.png' : (creche?.logoUrl || '/favicon.png');
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconHref;

    if (!isAuthenticated && !isPublicAdmission && !isPublicParentSpace && !isPublicPrivacy) {
      if (isPublicLanding) {
        document.title = language === 'ar' ? 'Rawdha+ — منصة تسيير الحضانات' : 'Rawdha+ — La plateforme des crèches';
        return;
      }
      document.title = isMobileWelcomeScreen
        ? (language === 'ar' ? 'مرحباً — روضة+' : 'Bienvenue — RAWDHA+')
        : isAccessRequest
          ? (language === 'ar' ? 'طلب الوصول — RAWDHA+' : 'Demander un accès — RAWDHA+')
          : (language === 'ar' ? 'تسجيل الدخول — RAWDHA+' : 'Connexion — RAWDHA+');
      return;
    }

    if (isPublicPrivacy) {
      document.title = language === 'ar' ? 'المركز القانوني وحماية البيانات — RAWDHA+' : 'Centre légal & confidentialité — RAWDHA+';
      return;
    }

    const pageTitleKeys: Record<string, string> = {
      dashboard: 'dashboard',
      enfants: 'children',
      classes: 'classes',
      presences: 'attendance',
      paiements: 'invoices',
      achats: 'purchases',
      rapports: 'reports',
      personnel: 'staff',
      activites: 'activities',
      repas: 'meals',
      admin: language === 'ar' ? 'مركز الإدارة' : 'Centre Administrateur',
      logs: language === 'ar' ? 'السجل والأحداث' : 'Historique & logs',
      parametres: 'settings',
      comptes: 'comptes',
    };
    const fallbackPageTitles: Record<string, string> = {
      admissions: language === 'ar' ? 'طلبات التسجيل' : 'Admissions',
      notifications: language === 'ar' ? 'الإشعارات' : 'Notifications',
      communication: language === 'ar' ? 'الرسائل والتقييمات والملاحظات' : 'Messages, Avis & Retours',
      community: 'Rawdha Connect',
      abonnement: language === 'ar' ? 'الاشتراك والدفع' : 'Abonnement & Paiement',
    };
    const pageName = pageTitleKeys[currentPage]
      ? t(pageTitleKeys[currentPage])
      : fallbackPageTitles[currentPage] || 'RAWDHA+';
    document.title = `${pageName} — RAWDHA+`;
  }, [creche?.logoUrl, creche?.nom, currentPage, isAccessRequest, isAuthenticated, isMobileWelcomeScreen, isPublicAdmission, isPublicParentSpace, isPublicLanding, isPublicPrivacy, language, t]);

  if (isPublicPrivacy) {
    return (
      <>
        <PrivacyPolicy />
        <CookieConsentBanner />
      </>
    );
  }

  if (isPublicParentSpace) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <PublicParentPortal />
      </Suspense>
    );
  }

  if (isPublicAdmission) {
    return (
      <>
        <PublicAdmission />
        <CookieConsentBanner />
      </>
    );
  }

  if (!isAuthenticated && isPublicLanding) {
    return (
      <>
        <LandingPage onNavigate={(destination) => navigateToPublicPath(destination === 'request' ? '/signin/' : '/login/')} />
        <CookieConsentBanner />
      </>
    );
  }

  // Une route de gestion doit attendre la lecture du stockage persistant avant de
  // décider qu’un appareil est déconnecté. Ainsi, après fermeture ou redémarrage,
  // l’utilisateur reste dans Rawdha+ tant qu’il n’a pas choisi « Déconnexion ».
  if (!isAuthenticated && authLoading && !isPublicLanding) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <School className="w-12 h-12 text-indigo-600 animate-bounce" />
        <p id="loading-text" className="text-sm font-bold text-slate-600 animate-pulse">
          {language === 'ar' ? 'جاري استعادة جلستك...' : 'Restauration sécurisée de votre session...'}
        </p>
      </div>
    );
  }

  // Les routes publiques restent immédiatement accessibles lorsqu’aucune session
  // persistante n’est disponible sur l’appareil.
  if (!isAuthenticated || isPasswordRecoveryUrl) {
    if (isMobileWelcomeScreen && !isPasswordRecoveryUrl) {
      return <MobileWelcome onContinue={() => navigateToPublicPath('/login/', { replace: true })} />;
    }
    return (
      <>
        <SignIn mode={isAccessRequest && !isPasswordRecoveryUrl ? 'request' : 'signin'} />
        <CookieConsentBanner />
      </>
    );
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
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expiryDateString = liveUser.dateFinAbonnement;
      if (todayStr > liveUser.dateFinAbonnement) {
        isSubscriptionExpired = true;
      }
    }
  }

  // ✅ Codes promo : modifie cette liste pour ajouter/changer tes codes.
  // Format : 'CODE': montant de réduction en DA
  const COUPON_CODES: Record<string, number> = SUBSCRIPTION_PROMO_CODES;
  const BASE_PLAN_PRICE = LEGAL_CONFIG.monthlyPlanPriceDzd;
  const couponDiscount = COUPON_CODES[couponCode.trim().toUpperCase()] || 0;
  const finalPrice = Math.max(0, BASE_PLAN_PRICE - couponDiscount);

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
                    <span className="text-sm text-indigo-200 line-through">{BASE_PLAN_PRICE} DA</span>
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

          {/* CTA principaux : Carte CIB/Edahabia (SlickPay) OU WhatsApp uniquement */}
          {globalSlickPayLockOverlay}
          <div className="px-6 pt-5 pb-2 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowExpiredRenewalModal(true)}
              className="min-h-11! w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 whitespace-nowrap cursor-pointer"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
                <img src="/payment/edahabia.png" alt="Edahabia" className="h-full w-full object-contain" />
              </span>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
                <img src="/payment/cib.png" alt="CIB" className="h-full w-full object-contain" />
              </span>
              <span className="truncate">
                {isAr
                  ? 'الدفع ببطاقة CIB / الذهبية'
                  : 'Payer par CIB / Edahabia'}
              </span>
            </button>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11! w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 whitespace-nowrap cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <span className="truncate">{isAr ? 'تواصل معنا عبر واتساب' : 'Contacter sur WhatsApp'}</span>
            </a>
          </div>
          {liveUser && (
            <SubscriptionRenewalModal
              isOpen={showExpiredRenewalModal}
              onClose={() => setShowExpiredRenewalModal(false)}
              isArabic={isAr}
              director={liveUser}
              initialCoupon={couponCode}
              onSubmitted={() => setExpiredRenewalSent(true)}
            />
          )}

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

  if (user?.role === 'directeur' && !isPendingApproval && onboardingState === 'checking') {
    return <div role="status" className="flex min-h-screen items-center justify-center bg-white text-sm font-semibold text-slate-600">{language === 'ar' ? 'جارٍ إعداد فضائك...' : 'Préparation de votre espace...'}</div>;
  }
  if (user?.role === 'directeur' && !isPendingApproval && onboardingState === 'error') {
    return <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center text-sm text-slate-700"><p>{language === 'ar' ? 'تعذر تحميل خطوات البدء.' : 'Impossible de charger les étapes de démarrage.'}</p><div className="flex flex-wrap justify-center gap-3"><button className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white" onClick={() => setOnboardingReload(value => value + 1)}>{language === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}</button><button className="rounded-xl border border-slate-300 px-4 py-2" onClick={() => setOnboardingState('inactive')}>{language === 'ar' ? 'الدخول إلى فضائي' : 'Accéder à mon espace'}</button><button onClick={logout} className="rounded-xl px-4 py-2">{language === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}</button></div></div>;
  }
  if (onboardingState === 'ready' && onboarding && onboarding.account_id === user?.id && onboarding.step !== 'done' && !onboarding.task_page) {
    return <FirstRunOnboarding firstName={user.prenom || ''} progress={onboarding} language={language === 'ar' ? 'ar' : 'fr'} onChangeLanguage={setLanguage} onSave={saveOnboarding} onOpenTask={openOnboardingTask} onLogout={logout} />;
  }

  if (requiresProfileSelection && !isPendingApproval) {
    return <ProfileSelectorScreen />;
  }

  const requiredCollections: Record<string, string[]> = {
    dashboard: ['enfants', 'paiements', 'presences', 'presence_journees', 'personnel', 'classes', 'activites', 'repas'],
    enfants: ['enfants', 'classes'], admissions: ['enfants', 'inscription_liens', 'demandes_admission'],
    classes: ['classes', 'enfants'], presences: ['enfants', 'classes', 'presences', 'presence_journees'], paiements: ['enfants', 'paiements'],
    achats: ['achats'], personnel: ['personnel'], activites: ['activites', 'classes'], repas: ['repas'],
    community: ['community_posts', 'community_comments', 'community_reactions', 'community_features'],
    communication: ['enfants', 'paiements', 'discussion_messages'], notifications: ['notifications'],
    admin: ['admin_audit_logs', 'admin_followups'], comptes: [], rapports: ['enfants', 'paiements', 'achats', 'presences'],
  };
  const missingData = dataErrors.includes('initial') || dataErrors.some(name => (requiredCollections[currentPage] || []).includes(name));
  const dataGate = dataLoading ? <div className="mx-auto max-w-4xl p-4"><PageSkeleton /></div> : missingData ? <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-900"><p className="text-sm font-bold">{language === 'ar' ? 'تعذر تحميل بيانات هذه الصفحة.' : 'Impossible de charger les données de cette page.'}</p><p className="mt-2 text-xs">{language === 'ar' ? 'تحقق من الاتصال ثم حاول مجدداً.' : 'Vérifiez la connexion puis réessayez.'}</p><button type="button" onClick={() => void refreshAll()} className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white">{language === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}</button></div> : null;

  if (currentPage === 'community') {
    const isAr = language === 'ar';
    return (
      <div className="min-h-screen bg-[#f3fafb]" dir={isAr ? 'rtl' : 'ltr'}>
        {globalSlickPayLockOverlay}
        <a href="#main-content" className="rawdha-skip-link">
          {isAr ? 'الانتقال إلى المحتوى الرئيسي' : 'Aller au contenu principal'}
        </a>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1b7a62] text-white shadow-sm shadow-emerald-700/20">
                <Network className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="max-w-[145px] truncate text-sm font-black tracking-tight text-slate-900 sm:max-w-none sm:text-lg">Rawdha Connect</h1>
                  <span className="hidden rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800 sm:inline-flex">Extension Rawdha+</span>
                  {socialUnreadCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700"><Bell className="h-3 w-3" />{socialUnreadCount > 99 ? '99+' : socialUnreadCount}</span>}
                </div>
                <p className="max-w-[145px] truncate text-[10px] font-semibold text-slate-500 sm:max-w-none sm:text-[11px]">{isAr ? 'المساحة الاجتماعية المهنية لدور الحضانة' : 'L’espace social professionnel des crèches'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 lg:flex">
                <img src="/rawdah-logo.png" alt="Rawdha+" className="h-5 w-5 rounded-md object-contain" />
                <span>{isAr ? 'متصل بمنصة Rawdha+' : 'Connecté à la plateforme Rawdha+'}</span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:gap-1 sm:rounded-xl sm:p-1">
                <button type="button" onClick={() => setLanguage('fr')} aria-pressed={!isAr} className={`rounded-lg px-1.5 py-1 text-[9px] font-black transition sm:px-2 sm:py-1.5 sm:text-[10px] ${!isAr ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>FR</button>
                <button type="button" onClick={() => setLanguage('ar')} aria-pressed={isAr} className={`rounded-lg px-1.5 py-1 text-[9px] font-black transition sm:px-2 sm:py-1.5 sm:text-[10px] ${isAr ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>عربي</button>
              </div>
              <button type="button" onClick={() => navigateToPage('dashboard')} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-2 py-2 text-[11px] font-black sm:gap-2 sm:py-2.5 sm:text-xs text-emerald-800 shadow-sm transition hover:bg-emerald-50 active:scale-[0.98] sm:px-4">
                {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                <span className="hidden sm:inline">{isAr ? 'العودة إلى التسيير' : 'Retour à la gestion'}</span>
                <span className="sm:hidden">{isAr ? 'التسيير' : 'Gestion'}</span>
              </button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-73px)] pb-28 outline-none lg:pb-0 [@media(max-height:430px)]:pb-0">
          <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-slate-400">{isAr ? 'جارٍ تحميل Rawdha Connect...' : 'Chargement de Rawdha Connect...'}</div>}>
            <DataLoadGuard loading={dataLoading} failed={missingData} fallback={dataGate}><Community /></DataLoadGuard>
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
        case 'achats': return <Achats />;
        case 'personnel': return <Personnel />;
        case 'activites': return <Activites />;
        case 'repas': return <Repas />;
        case 'admin': return <AdminCenter onNavigate={navigateToPage} />;
        case 'logs': return user?.role === 'admin' ? <ApplicationLogs /> : null;
        case 'comptes': return <Comptes />;
        case 'notifications': return user?.role === 'directeur' ? <NotificationsDirecteur onNavigateToPaiements={() => navigateToPage('paiements')} /> : <Notifications />;
        case 'communication': return user?.role === 'directeur' ? <Communication /> : <CommunicationAdmin />;
        case 'demarrage': return <Demarrage onDone={() => navigateToPage('dashboard')} />;
        case 'aide': return <Aide onNavigate={navigateToPage} />;
        case 'support': return <Support />;
        case 'rapports': return <Rapports />;
        case 'parametres': return <Parametres onNavigate={navigateToPage} />;
        case 'abonnement': return <AbonnementPaiement onNavigate={navigateToPage} />;
        default: return <Dashboard />;
      }
    })();
    return (
      <Suspense fallback={<PageSkeleton />}>
        {page}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-transparent" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <a href="#main-content" className="rawdha-skip-link">
        {language === 'ar' ? 'الانتقال إلى المحتوى الرئيسي' : 'Aller au contenu principal'}
      </a>
      {isRoutePending && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 animate-pulse" />
      )}
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
      {globalSlickPayLockOverlay}
      <div className={`min-w-0 transition-all duration-200 ${isSidebarCollapsed ? 'lg:ltr:pl-20 lg:rtl:pr-20' : 'lg:ltr:pl-64 lg:rtl:pr-64'}`}>
        {/* Header — Barre supérieure calme et épurée */}
        <header className="sticky top-0 z-30 border-b border-slate-200/75 bg-white/95 lg:bg-[#f8fafc]/92 backdrop-blur-md">
          <div className="min-w-0 px-3 sm:px-6 lg:px-10 py-2 sm:py-3">
            <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
              {/* Left: Menu (landscape only) + Crèche Identity */}
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  id="mobile-sidebar-toggle"
                  type="button"
                  onClick={() => setIsSidebarOpen(value => !value)}
                  className="hidden [@media(max-height:430px)]:flex lg:hidden h-9 w-9 items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl transition cursor-pointer flex-shrink-0"
                  aria-expanded={isSidebarOpen}
                  aria-label={isSidebarOpen
                    ? (language === 'ar' ? 'إغلاق القائمة' : 'Fermer le menu')
                    : (language === 'ar' ? 'فتح القائمة' : 'Ouvrir le menu')}
                >
                  <Menu className="w-4.5 h-4.5" />
                </button>

                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="hidden sm:flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden bg-indigo-600 text-white p-1.5">
                    {creche?.logoUrl ? (
                      <img src={creche.logoUrl} alt={creche?.nom || (language === 'ar' ? 'شعار الروضة' : 'Logo de la crèche')} className="w-full h-full rounded-lg bg-white p-0.5 object-contain" />
                    ) : (
                      <School className="w-4.5 h-4.5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="min-w-0 truncate text-sm sm:text-base md:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                      {creche?.nom}
                    </h1>
                    {creche?.adresse && (
                      <p className="hidden sm:block max-w-[36vw] truncate text-xs text-slate-500 font-medium leading-none mt-0.5">{creche.adresse}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Status (desktop) + Search + Notifications + Help (?) + Lang + Logout */}
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                <div className="hidden xl:block">
                  {isPendingApproval ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                      {language === 'ar' ? 'في انتظار موافقة الإدارة — وضع القراءة فقط' : 'En attente de validation — lecture seule'}
                    </div>
                  ) : user?.role === 'directeur' && (
                    <SubscriptionStatusBadge
                      dateFinAbonnement={liveUser?.dateFinAbonnement}
                      abonnementActif={liveUser?.abonnementActif}
                      onClick={() => navigateToPage('abonnement')}
                    />
                  )}
                </div>

                {!isPendingApproval && (
                  <button
                    type="button"
                    onClick={() => setIsQuickSearchOpen(true)}
                    aria-label={language === 'ar' ? 'بحث سريع' : 'Recherche rapide'}
                    title={language === 'ar' ? 'بحث سريع (Ctrl+K)' : 'Recherche rapide (Ctrl+K)'}
                    className="flex h-9 w-9 md:w-auto md:min-w-[9rem] xl:min-w-[12.5rem] items-center justify-center md:justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 md:px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100/80 hover:text-slate-900 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Search className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="hidden md:inline truncate">{language === 'ar' ? 'بحث سريع…' : 'Rechercher…'}</span>
                    </span>
                    <kbd className="hidden lg:inline-block shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200/90 shadow-2xs">Ctrl+K</kbd>
                  </button>
                )}

                {user?.role === 'directeur' && !isPendingApproval && activeProfile && (
                  <button
                    type="button"
                    onClick={lockProfile}
                    aria-label={language === 'ar' ? 'تبديل الحساب' : 'Changer de profil'}
                    title={language === 'ar' ? `تبديل الحساب (${activeProfile.name})` : `Changer de profil (${activeProfile.name})`}
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100/80 cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline max-w-[7.5rem] truncate">{activeProfile.name}</span>
                  </button>
                )}

                {!isPendingApproval && (user?.role === 'admin' || (user?.role === 'directeur' && canAccessPage('notifications'))) && (
                  <NotificationBell
                    onNavigateToPaiements={() => navigateToPage('paiements')}
                    onNavigate={navigateToPage}
                  />
                )}
                {unreadSocialMessages > 0 && <button type="button" onClick={() => navigateToPage('community')} aria-label={language === 'ar' ? 'رسائل Rawdha Connect الجديدة' : 'Nouveaux messages Rawdha Connect'} title={language === 'ar' ? 'رسائل Rawdha Connect الجديدة' : 'Nouveaux messages Rawdha Connect'} className="hidden sm:flex relative h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100 cursor-pointer"><MessageCircle className="w-4 h-4" /><span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadSocialMessages > 99 ? '99+' : unreadSocialMessages}</span></button>}

                {user?.role === 'directeur' && !isPendingApproval && (
                  <SupportBubble currentPage={currentPage} onNavigate={navigateToPage} />
                )}

                <button
                  type="button"
                  onClick={toggleBrowserFullscreen}
                  aria-label={language === 'ar' ? (isBrowserFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة') : (isBrowserFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
                  title={language === 'ar' ? (isBrowserFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة') : (isBrowserFullscreen ? 'Quitter le plein écran' : 'Plein écran')}
                  className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                >
                  {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Language Selector */}
                <button
                  type="button"
                  onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
                  aria-label={language === 'ar' ? 'التبديل إلى الفرنسية' : 'Passer en arabe'}
                  className="sm:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                >
                  {language === 'fr' ? 'ع' : 'FR'}
                </button>
                <div className="hidden sm:flex shrink-0 gap-0.5 rounded-xl border border-slate-200/70 bg-slate-100/85 p-0.5" aria-label={language === 'ar' ? 'اختيار اللغة' : 'Choisir la langue'}>
                  <button
                    type="button"
                    onClick={() => setLanguage('fr')}
                    aria-pressed={language === 'fr'}
                    className={`min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                      language === 'fr'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    FR
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('ar')}
                    aria-pressed={language === 'ar'}
                    className={`min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                      language === 'ar'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    عربي
                  </button>
                </div>

                {/* Logout Button: hidden on phones when bottom Menu is available */}
                <button
                  type="button"
                  onClick={logout}
                  aria-label={t('nav.logout')}
                  title={t('nav.logout')}
                  className={`${isPendingApproval ? 'flex' : 'hidden sm:flex [@media(max-height:430px)]:flex'} shrink-0 h-9 w-9 sm:w-auto sm:px-3 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition font-semibold text-xs items-center justify-center gap-1.5 cursor-pointer border border-slate-200/80`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav.logout')}</span>
                </button>
              </div>
            </div>

            {/* Compact status strip: on mobile only when pending, on tablet/desktop below xl */}
            {(isPendingApproval || user?.role === 'directeur') && (
              <div className={`${isPendingApproval ? 'flex' : 'hidden sm:flex'} mt-2 items-center justify-between xl:hidden`}>
                {isPendingApproval ? (
                  <div className="min-w-0 max-w-full inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{language === 'ar' ? 'في انتظار موافقة الإدارة — وضع القراءة فقط' : 'En attente de validation — lecture seule'}</span>
                  </div>
                ) : (
                  <div className="min-w-0 max-w-full">
                    <SubscriptionStatusBadge
                      dateFinAbonnement={liveUser?.dateFinAbonnement}
                      abonnementActif={liveUser?.abonnementActif}
                      onClick={() => navigateToPage('abonnement')}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-hidden outline-none p-3 pb-32 sm:p-6 sm:pb-32 lg:p-10 lg:pb-10 max-w-[1600px] mx-auto">
          {onboardingState === 'ready' && onboarding?.task_page && onboarding.account_id === user?.id && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900"><span>{language === 'ar' ? 'يمكنك العودة إلى خطوات البدء عندما تنتهين.' : 'Reprenez les étapes quand vous avez terminé.'}</span><button type="button" onClick={() => void resumeOnboarding()} className="rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white">{language === 'ar' ? 'متابعة البدء' : 'Continuer le démarrage'}</button>{onboardingBannerError && <span role="alert">{language === 'ar' ? 'تعذر الحفظ. حاولي مجدداً.' : 'Enregistrement impossible. Réessayez.'}</span>}</div>}
          {isOffline && (
            <div role="alert" className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-bold text-rose-800 shadow-xs">
              <WifiOff className="h-5 w-5 shrink-0 text-rose-600" />
              <span>
                {language === 'ar'
                  ? 'انقطع الاتصال بالإنترنت — تحققي من الشبكة قبل حفظ أي تعديل.'
                  : 'Connexion Internet coupée — vérifiez votre réseau avant d’enregistrer une modification.'}
              </span>
            </div>
          )}
          {isPendingApproval && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
              <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700"><Lock className="h-5 w-5" /></div>
              <div>
                <h2 className="font-black">{language === 'ar' ? 'حسابك في انتظار موافقة الإدارة' : 'Votre compte est en attente de validation'}</h2>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  {language === 'ar' ? 'بيانات المنصة غير متاحة حتى تؤكد الإدارة حسابك. عدم ظهور ملفات الأطفال والفواتير لا يعني أنها غير موجودة.' : 'Les données de la plateforme ne sont pas affichées avant confirmation. L’absence de dossiers d’enfants ou de factures à l’écran ne signifie pas qu’ils n’existent pas.'}
                </p>
              </div>
            </div>
          )}
          {import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' && (
            <div role="status" className="mb-3.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900">
              <span className="min-w-0 truncate">
                {language === 'ar'
                  ? 'نسخة تجريبية ببيانات وهمية · 60 طفلاً'
                  : 'Aperçu de démonstration · Crèche pilote (60 enfants)'}
              </span>
              {!isPendingApproval && (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('rawdha:demo-simulate-notification'))
                  }
                  className="min-h-7! shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-lg border border-amber-300/90 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-2xs transition hover:bg-amber-100/70 cursor-pointer"
                >
                  <Bell className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>{language === 'ar' ? 'إشعار تجريبي' : 'Tester notif'}</span>
                </button>
              )}
            </div>
          )}
          {!isPendingApproval && <div key={currentPage} className="rawdha-page-enter rawdha-app-motion"><DataLoadGuard loading={dataLoading} failed={missingData} fallback={dataGate}>{renderPage()}</DataLoadGuard></div>}
        </main>
      </div>
      <MobileBottomNav
        currentPage={currentPage}
        onNavigate={(page) => {
          setIsSidebarOpen(false);
          setIsMobileHubOpen(false);
          navigateToPage(page);
        }}
        onOpenMenu={() => setIsMobileHubOpen(value => !value)}
        isMenuOpen={isMobileHubOpen}
      />
      <MobileAppHubSheet
        isOpen={isMobileHubOpen}
        currentPage={currentPage}
        onClose={() => setIsMobileHubOpen(false)}
        onNavigate={(page) => {
          setIsSidebarOpen(false);
          navigateToPage(page);
        }}
        onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
        onLogout={logout}
      />
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onNavigate={navigateToPage}
        onOpenChildDossier={(enfant) => setQuickDossierChild(enfant)}
      />
      {quickDossierChild && (
        <Suspense fallback={null}>
          <EnfantDetails
            enfant={enfants.find(item => item.id === quickDossierChild.id) || quickDossierChild}
            onClose={() => setQuickDossierChild(null)}
          />
        </Suspense>
      )}

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ConfirmProvider>
        <ToastProvider>
        {LazyDemoProviders ? (
          <Suspense fallback={null}>
            <LazyDemoProviders><WorkspaceProfileProvider><Suspense fallback={null}><AppContent /></Suspense></WorkspaceProfileProvider><ToastContainer /></LazyDemoProviders>
          </Suspense>
        ) : (
          <AuthProvider><DbProvider><WorkspaceProfileProvider><Suspense fallback={null}><AppContent /></Suspense></WorkspaceProfileProvider><ToastContainer /></DbProvider></AuthProvider>
        )}
      </ToastProvider>
      </ConfirmProvider>
    </LanguageProvider>
  );
}
