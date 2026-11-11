import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Baby,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  Home,
  Palette,
  Plus,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import {
  buildChildSnapshots,
  detectMobilePlatform,
  getCurrentDeviceParentRequest,
  getOrCreateParentDeviceToken,
  getRememberedParentCreche,
  isRunningStandalonePwa,
  loadParentAnnouncements,
  markParentHomeScreenInstalled,
  rememberParentCreche,
  subscribeParentWebPush,
  subscribeToParentPortalChanges,
  submitParentLinkRequest,
  triggerLocalServiceWorkerNotification,
  type ParentAnnouncement,
  type ParentChildSnapshot,
  type ParentLinkRequest,
  type ParentRequestedChild,
} from '../utils/parentPortal';
import { playNotificationChime } from '../utils/notificationSound';
import { useDb } from '../contexts/DbContext';
import { formatCurrency } from '../utils/format';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PublicParentPortal() {
  const db = useDb();
  const [lang, setLang] = useState<'fr' | 'ar'>(() => {
    if (typeof window === 'undefined') return 'fr';
    return localStorage.getItem('rawdha_lang') === 'ar' ? 'ar' : 'fr';
  });
  const isAr = lang === 'ar';

  // Résolution automatique de la crèche depuis l’URL QR ou depuis la mémoire de l’écran d’accueil
  const crecheContext = useMemo(() => {
    if (typeof window === 'undefined') return { crecheId: 'preview-director', crecheNom: 'Crèche Rawdha+' };
    const params = new URLSearchParams(window.location.search);
    const fromUrlId = (params.get('creche') || '').trim();
    const fromUrlNom = (params.get('nom') || '').trim();
    if (fromUrlId) {
      rememberParentCreche(fromUrlId, fromUrlNom);
      return { crecheId: fromUrlId, crecheNom: fromUrlNom || 'Crèche Rawdha+' };
    }
    const remembered = getRememberedParentCreche();
    if (remembered?.crecheId) {
      return {
        crecheId: remembered.crecheId,
        crecheNom: remembered.crecheNom || 'Crèche Rawdha+',
      };
    }
    const fallbackAccount = db.comptes?.find((c) => c.role === 'directeur');
    return {
      crecheId: fallbackAccount?.id || 'preview-director',
      crecheNom: fallbackAccount?.nomCreche || 'Crèche Les Petits Soleils',
    };
  }, [db.comptes]);

  const deviceToken = useMemo(() => getOrCreateParentDeviceToken(), []);
  const platform = useMemo(() => detectMobilePlatform(), []);

  const [request, setRequest] = useState<ParentLinkRequest | null>(null);
  const [announcements, setAnnouncements] = useState<ParentAnnouncement[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [showAddSiblingForm, setShowAddSiblingForm] = useState(false);

  // Formulaire de liaison (1 ou plusieurs enfants)
  const [parentPrenom, setParentPrenom] = useState('');
  const [parentNom, setParentNom] = useState('');
  const [parentTelephone, setParentTelephone] = useState('');
  const [parentLien, setParentLien] = useState<'Mère' | 'Père' | 'Tuteur'>('Mère');
  const [childrenInputs, setChildrenInputs] = useState<ParentRequestedChild[]>([
    { prenom: '', nom: '', groupeAge: 'Bébés' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [siblingSubmittedBanner, setSiblingSubmittedBanner] = useState(false);

  // Installation écran d'accueil + Push Notifications
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [homeInstalled, setHomeInstalled] = useState<boolean>(() => isRunningStandalonePwa());
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');
  const [livePushBanner, setLivePushBanner] = useState<{ title: string; body: string } | null>(null);

  // Basculer dynamiquement le manifeste PWA vers /manifest-parent.webmanifest
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = isAr ? `${crecheContext.crecheNom} — فضاء الأولياء` : `${crecheContext.crecheNom} — Espace Parent`;
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = manifestLink?.getAttribute('href') || '/manifest.webmanifest';
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = '/manifest-parent.webmanifest';
    return () => {
      if (manifestLink) manifestLink.href = previousHref;
    };
  }, [crecheContext.crecheNom, isAr]);

  // Capture de l’invite native Android "Ajouter à l'écran d'accueil"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setHomeInstalled(true);
      setDeferredInstallPrompt(null);
      void markParentHomeScreenInstalled(crecheContext.crecheId, deviceToken);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [crecheContext.crecheId, deviceToken]);

  // Chargement & synchronisation automatique temps réel (approbation directrice + annonces push)
  useEffect(() => {
    let mounted = true;

    const refresh = async (detail?: Record<string, unknown>) => {
      const [req, anns] = await Promise.all([
        getCurrentDeviceParentRequest(crecheContext.crecheId, deviceToken),
        loadParentAnnouncements(crecheContext.crecheId),
      ]);
      if (!mounted) return;
      setRequest(req);
      setAnnouncements(anns);
      if (req?.homeScreenInstalled) setHomeInstalled(true);

      if (detail?.action === 'announcement_published' && req?.status === 'approved') {
        const ann = detail.announcement as ParentAnnouncement | undefined;
        if (ann && ann.crecheId === crecheContext.crecheId) {
          playNotificationChime();
          setLivePushBanner({
            title: `${crecheContext.crecheNom} — ${ann.title}`,
            body: ann.message,
          });
          const tId = window.setTimeout(() => setLivePushBanner(null), 7000);
          (tId as unknown as { unref?: () => void })?.unref?.();
          if (req.pushEnabled) {
            void triggerLocalServiceWorkerNotification(
              `${crecheContext.crecheNom} — ${ann.title}`,
              ann.message,
              `/espace-parent?creche=${encodeURIComponent(crecheContext.crecheId)}`,
            );
          }
        }
      }
      if (detail?.action === 'request_approved' && req?.status === 'approved') {
        playNotificationChime();
      }
    };

    void refresh();
    const unsub = subscribeToParentPortalChanges((detail) => {
      void refresh(detail);
    });
    const pollId = window.setInterval(() => {
      void refresh();
    }, 6000);
    (pollId as unknown as { unref?: () => void })?.unref?.();

    return () => {
      mounted = false;
      unsub();
      window.clearInterval(pollId);
    };
  }, [crecheContext.crecheId, crecheContext.crecheNom, deviceToken]);

  // Snapshots enfants en temps réel (combine les données live du contexte ou le snapshot validé)
  const linkedChildren: ParentChildSnapshot[] = useMemo(() => {
    if (!request || request.status !== 'approved' || request.linkedEnfantIds.length === 0) {
      return [];
    }
    if (db.enfants && db.enfants.length > 0) {
      const liveBuilt = buildChildSnapshots({
        enfantIds: request.linkedEnfantIds,
        enfants: db.enfants,
        presences: db.presences || [],
        repas: db.repas || [],
        activites: db.activites || [],
        paiements: db.paiements || [],
      });
      if (liveBuilt.length > 0) return liveBuilt;
    }
    return request.linkedSnapshots || [];
  }, [request, db.enfants, db.presences, db.repas, db.activites, db.paiements]);

  useEffect(() => {
    if (linkedChildren.length > 0 && !linkedChildren.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(linkedChildren[0].id);
    }
  }, [linkedChildren, selectedChildId]);

  const activeChild = linkedChildren.find((c) => c.id === selectedChildId) || linkedChildren[0] || null;

  const visibleAnnouncements = useMemo(() => {
    if (!activeChild) return announcements.slice(0, 6);
    return announcements
      .filter((a) => {
        if (a.targetScope === 'all') return true;
        if (a.targetScope === 'group') return a.targetGroup === activeChild.groupeAge;
        if (a.targetScope === 'child') return a.targetEnfantId === activeChild.id;
        return true;
      })
      .slice(0, 8);
  }, [announcements, activeChild]);

  const handleAddChildRow = () => {
    setChildrenInputs((prev) => [...prev, { prenom: '', nom: parentNom, groupeAge: 'Bébés' }]);
  };

  const handleRemoveChildRow = (idx: number) => {
    setChildrenInputs((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const handleSubmitLinkRequest = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const saved = await submitParentLinkRequest({
        crecheId: crecheContext.crecheId,
        crecheNom: crecheContext.crecheNom,
        parentPrenom: parentPrenom || request?.parentPrenom || '',
        parentNom: parentNom || request?.parentNom || '',
        parentTelephone: parentTelephone || request?.parentTelephone || '',
        parentLien,
        requestedChildren: childrenInputs,
        deviceToken,
      });
      setRequest(saved);
      if (showAddSiblingForm) {
        setShowAddSiblingForm(false);
        setSiblingSubmittedBanner(true);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Impossible d’envoyer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstallHomeScreen = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setHomeInstalled(true);
        await markParentHomeScreenInstalled(crecheContext.crecheId, deviceToken);
      }
      setDeferredInstallPrompt(null);
      return;
    }
    setShowIosGuide(true);
  };

  const handleConfirmManualInstall = async () => {
    setHomeInstalled(true);
    setShowIosGuide(false);
    await markParentHomeScreenInstalled(crecheContext.crecheId, deviceToken);
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushStatusMsg('');
    try {
      const res = await subscribeParentWebPush({
        crecheId: crecheContext.crecheId,
        crecheNom: crecheContext.crecheNom,
        deviceToken,
      });
      if (res.ok) {
        const refreshed = await getCurrentDeviceParentRequest(crecheContext.crecheId, deviceToken);
        setRequest(refreshed);
        setPushStatusMsg(
          isAr
            ? 'تم تفعيل الإشعارات الفورية على هاتفكم بنجاح!'
            : 'Notifications Push activées avec succès sur votre téléphone !',
        );
      } else if (res.reason === 'denied') {
        setPushStatusMsg(
          isAr
            ? 'الإشعارات محظورة في إعدادات المتصفح. يرجى السماح بها من إعدادات الهاتف.'
            : 'Notifications refusées dans le navigateur. Autorisez-les dans les réglages du site.',
        );
      } else {
        setPushStatusMsg(
          isAr
            ? 'أضف الصفحة للشاشة الرئيسية أولاً لتفعيل إشعارات الهاتف.'
            : 'Ajoutez d’abord l’application sur l’écran d’accueil pour activer les notifications sur cet appareil.',
        );
      }
    } finally {
      setPushBusy(false);
    }
  };

  const isApprovedWithChildren = request?.status === 'approved' && linkedChildren.length > 0;
  const isPendingApproval = request?.status === 'pending';
  const isRejected = request?.status === 'rejected';
  const pushAlreadyActive = Boolean(request?.pushEnabled);
  const needsOnboarding = isApprovedWithChildren && (!homeInstalled || !pushAlreadyActive);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 text-slate-900 pb-12"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white font-black text-sm shadow-2xs">
              R+
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">
                {crecheContext.crecheNom}
              </p>
              <p className="truncate text-[11px] font-semibold text-indigo-600">
                {isAr ? 'فضاء الأولياء والبطاقة الذكية' : 'Pass Parent & Notifications'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'fr' ? 'ar' : 'fr'))}
            className="min-h-8! shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {isAr ? 'Français' : 'العربية'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4 space-y-4">
        {/* Notification Push reçue en direct (style bannière mobile haut d'écran) */}
        {livePushBanner && (
          <div
            role="status"
            onClick={() => setLivePushBanner(null)}
            className="rounded-2xl bg-slate-950 text-white p-3.5 shadow-xl border border-indigo-500/40 flex items-start gap-3 cursor-pointer animate-bounce"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white">
              <BellRing className="h-4 w-4 shrink-0" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                {isAr ? 'إشعار فوري الآن' : 'Notification Push · Maintenant'}
              </p>
              <p className="text-xs font-black truncate">{livePushBanner.title}</p>
              <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{livePushBanner.body}</p>
            </div>
          </div>
        )}
        {/* ================================================================
            ÉTAT 3 : PARENT VALIDÉ AVEC 1 OU PLUSIEURS ENFANTS
           ================================================================ */}
        {isApprovedWithChildren && !showAddSiblingForm ? (
          <>
            {/* ONBOARDING AUTOMATIQUE : ÉCRAN D'ACCUEIL + NOTIFICATIONS PUSH */}
            {needsOnboarding && (
              <section
                id="parent-onboarding-card"
                className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-4 text-white shadow-md space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
                    <Sparkles className="h-4 w-4 shrink-0" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black truncate">
                      {isAr ? 'فعّلوا تطبيق الأولياء في خطوتين' : 'Finalisez votre Pass Parent en 2 gestes'}
                    </h2>
                    <p className="text-[11px] text-indigo-100 truncate">
                      {isAr
                        ? 'للوصول السريع وتلقي إشعارات الروضة مباشرة على هاتفكم'
                        : 'Accès direct sur votre téléphone et alertes en temps réel'}
                    </p>
                  </div>
                </div>

                {/* Étape 1 : Écran d'accueil */}
                <div className="rounded-xl bg-white/12 border border-white/15 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Home className="h-4 w-4 shrink-0 text-amber-300" />
                      <span className="text-xs font-bold truncate">
                        {isAr ? '1. التثبيت على الشاشة الرئيسية' : '1. Mettre sur l’écran d’accueil'}
                      </span>
                    </div>
                    {homeInstalled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {isAr ? 'مُثبّت' : 'Installé'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleInstallHomeScreen()}
                        className="min-h-8! shrink-0 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                      >
                        {isAr ? 'تثبيت الآن' : 'Ajouter à l’écran'}
                      </button>
                    )}
                  </div>

                  {!homeInstalled && (showIosGuide || platform === 'ios') && (
                    <div className="rounded-lg bg-slate-950/35 p-2.5 text-[11px] text-indigo-50 space-y-2">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Share className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <span>
                          {platform === 'ios'
                            ? isAr
                              ? 'على iPhone: اضغط على زر المشاركة (↑) أسفل الشاشة ثم «إضافة إلى الشاشة الرئيسية».'
                              : 'Sur iPhone : appuyez sur Partager (↑) en bas puis « Sur l’écran d’accueil ».'
                            : isAr
                            ? 'افتح قائمة المتصفح (⋮) في الأعلى واختر «الإضافة إلى الشاشة الرئيسية».'
                            : 'Ouvrez le menu du navigateur (⋮) puis choisissez « Ajouter à l’écran d’accueil ».'}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleConfirmManualInstall()}
                        className="min-h-8! w-full rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                      >
                        {isAr ? 'تمت الإضافة للشاشة الرئيسية' : 'C’est fait, je l’ai ajouté'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Étape 2 : Autoriser les notifications Push */}
                <div className="rounded-xl bg-white/12 border border-white/15 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BellRing className="h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="text-xs font-bold truncate">
                        {isAr ? '2. السماح بالإشعارات الفورية' : '2. Autoriser les notifications Push'}
                      </span>
                    </div>
                    {pushAlreadyActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {isAr ? 'مفعّلة' : 'Activées'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pushBusy}
                        onClick={() => void handleEnablePush()}
                        className="min-h-8! shrink-0 whitespace-nowrap rounded-xl bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 text-xs font-black text-slate-950 transition cursor-pointer disabled:opacity-60"
                      >
                        {pushBusy
                          ? isAr
                            ? 'جارٍ التفعيل...'
                            : 'Activation...'
                          : isAr
                          ? 'تفعيل الإشعارات'
                          : 'Autoriser'}
                      </button>
                    )}
                  </div>
                  {pushStatusMsg && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-200">{pushStatusMsg}</p>
                  )}
                </div>
              </section>
            )}

            {siblingSubmittedBanner && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
                {isAr
                  ? 'تم إرسال طلب إضافة الطفل للإدارة. سيظهر تلقائياً فور المصادقة عليه.'
                  : 'Demande d’ajout envoyée à la directrice : le nouvel enfant s’affichera automatiquement dès validation.'}
              </div>
            )}

            {/* SÉLECTEUR MULTI-ENFANTS (1 OU PLUSIEURS ENFANTS + AJOUT FRATRIE) */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isAr
                    ? `أطفالي المسجلون (${linkedChildren.length})`
                    : `Mes enfants rattachés (${linkedChildren.length})`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setParentPrenom(request?.parentPrenom || '');
                    setParentNom(request?.parentNom || '');
                    setParentTelephone(request?.parentTelephone || '');
                    setChildrenInputs([{ prenom: '', nom: request?.parentNom || '', groupeAge: 'Bébés' }]);
                    setShowAddSiblingForm(true);
                  }}
                  className="min-h-8! inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? 'إضافة أخ/أخت' : '+ Ajouter un enfant'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {linkedChildren.map((child) => {
                  const selected = child.id === activeChild?.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      className={`min-h-10! flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition cursor-pointer ${
                        selected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate text-xs font-black">
                        {child.prenom} {child.nom}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          selected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        {child.groupeAge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* CARTE WALLET PASS DE L'ENFANT SÉLECTIONNÉ */}
            {activeChild && (
              <>
                <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          {isAr ? 'بطاقة ولي أمر مصادق عليها' : 'Pass Parent Vérifié'}
                        </span>
                        <h1 className="mt-2 text-xl font-black tracking-tight truncate">
                          {activeChild.prenom} {activeChild.nom}
                        </h1>
                        <p className="text-xs text-slate-300 font-semibold">
                          {isAr ? `القسم: ${activeChild.groupeAge}` : `Section ${activeChild.groupeAge}`} · {crecheContext.crecheNom}
                        </p>
                      </div>
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 border border-white/15">
                        <Baby className="h-5 w-5 shrink-0 text-indigo-200" />
                      </div>
                    </div>

                    {/* Pointage du jour */}
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                          {isAr ? 'حضور اليوم' : 'Pointage aujourd’hui'}
                        </p>
                        {activeChild.presenceToday ? (
                          <p className="mt-0.5 text-xs font-bold text-white truncate">
                            {activeChild.presenceToday.statut}
                            {activeChild.presenceToday.heureArrivee
                              ? ` · ${isAr ? 'الوصول' : 'Arrivée'} ${activeChild.presenceToday.heureArrivee}`
                              : ''}
                            {activeChild.presenceToday.humeur ? ` · ${activeChild.presenceToday.humeur}` : ''}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs font-semibold text-slate-300 truncate">
                            {isAr ? 'لم يتم تسجيل الوصول بعد هذا الصباح' : 'Pointage du matin non encore saisi'}
                          </p>
                        )}
                      </div>
                      {pushAlreadyActive && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/20 px-2 py-1 text-[10px] font-bold text-emerald-200 shrink-0">
                          <Bell className="h-3 w-3 shrink-0" />
                          Push ON
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                {/* ANNONCES PUSH DE LA CRÈCHE */}
                <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <BellRing className="h-4 w-4 shrink-0" />
                      </span>
                      <h2 className="text-sm font-black text-slate-900">
                        {isAr ? 'إعلانات وإشعارات الروضة' : 'Annonces de la crèche'}
                      </h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                      {visibleAnnouncements.length}
                    </span>
                  </div>

                  {visibleAnnouncements.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      {isAr ? 'لا توجد إعلانات جديدة حالياً.' : 'Aucune annonce publiée pour le moment.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {visibleAnnouncements.map((ann) => (
                        <div
                          key={ann.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-slate-900 truncate">{ann.title}</p>
                            <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                              {new Date(ann.createdAt).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-FR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{ann.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* REPAS & ACTIVITÉS DU JOUR */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <section className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
                        <Utensils className="h-4 w-4 shrink-0" />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">
                        {isAr ? 'وجبات اليوم' : 'Repas du jour'}
                      </h3>
                    </div>
                    {activeChild.todayMeals.length > 0 ? (
                      <div className="space-y-1.5">
                        {activeChild.todayMeals.map((m) => (
                          <div key={m.id} className="rounded-xl bg-amber-50/60 border border-amber-100 p-2.5">
                            <span className="text-[10px] font-black text-amber-800 uppercase">{m.type}</span>
                            <p className="text-xs font-semibold text-slate-800 mt-0.5">{m.menu}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {isAr ? 'لم يُنشر برنامج وجبات اليوم بعد.' : 'Menu du jour non encore publié.'}
                      </p>
                    )}
                  </section>

                  <section className="rounded-2xl border border-teal-200/70 bg-white p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                        <Palette className="h-4 w-4 shrink-0" />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">
                        {isAr ? 'أنشطة اليوم' : 'Activités du jour'}
                      </h3>
                    </div>
                    {activeChild.todayActivities.length > 0 ? (
                      <div className="space-y-1.5">
                        {activeChild.todayActivities.map((act) => (
                          <div key={act.id} className="rounded-xl bg-teal-50/60 border border-teal-100 p-2.5">
                            <span className="text-[10px] font-bold text-teal-800 tabular-nums">
                              {act.heureDebut || '—'}{act.heureFin ? ` - ${act.heureFin}` : ''}
                            </span>
                            <p className="text-xs font-semibold text-slate-800 mt-0.5">{act.titre}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {isAr ? 'لا توجد ورشة مسجلة اليوم لهذا القسم.' : 'Aucun atelier programmé aujourd’hui.'}
                      </p>
                    )}
                  </section>
                </div>

                {/* SITUATION DES FACTURES */}
                {activeChild.invoices.length > 0 && (
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                        <CreditCard className="h-4 w-4 shrink-0" />
                      </span>
                      <h3 className="text-xs font-black text-slate-900">
                        {isAr ? 'متابعة الفواتير' : 'Suivi des factures'}
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {activeChild.invoices.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between py-2 text-xs">
                          <span className="font-semibold text-slate-700">{inv.moisConcerne}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 tabular-nums">
                              {formatCurrency(inv.montant)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                inv.statut === 'Payé'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {inv.statut}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        ) : isPendingApproval && !showAddSiblingForm ? (
          /* ================================================================
             ÉTAT 2 : DEMANDE ENVOYÉE — ATTENTE AUTOMATIQUE DE VALIDATION
             ================================================================ */
          <section
            id="parent-waiting-approval"
            className="rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-sm space-y-4"
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Clock className="h-7 w-7 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-800">
                {isAr ? 'في انتظار مصادقة المديرة' : 'En attente de validation par la directrice'}
              </span>
              <h1 className="text-lg font-black text-slate-900">
                {isAr ? 'تم إرسال طلب الربط بنجاح!' : 'Demande transmise à la crèche !'}
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                {isAr
                  ? 'تتحقق إدارة الروضة من هويتكم لحماية بيانات الأطفال. بمجرد قبول الطلب، ستفتح بطاقة أطفالكم وإعداد الإشعارات تلقائياً على هذه الشاشة.'
                  : 'La direction vérifie votre dossier (sécurité des enfants). Dès que la directrice accepte, vos enfants, l’ajout à l’écran d’accueil et l’activation des notifications s’afficheront automatiquement ici.'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-start space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase">
                {isAr ? 'الأطفال المطلوب ربطهم' : 'Enfant(s) demandé(s)'}
              </p>
              {request.requestedChildren.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{c.prenom} {c.nom}</span>
                  {c.groupeAge && (
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                      {c.groupeAge}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setParentPrenom(request.parentPrenom);
                setParentNom(request.parentNom);
                setParentTelephone(request.parentTelephone);
                setChildrenInputs(request.requestedChildren);
                setShowAddSiblingForm(true);
              }}
              className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'تعديل الطلب أو إضافة أخ/أخت' : 'Modifier ma demande / Ajouter un enfant'}
            </button>
          </section>
        ) : (
          /* ================================================================
             ÉTAT 1 : OUVERTURE DU QR CODE — DEMANDE DE LIAISON (1 OU N ENFANTS)
             ================================================================ */
          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Smartphone className="h-5 w-5 shrink-0" />
              </span>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-slate-900">
                  {showAddSiblingForm && isApprovedWithChildren
                    ? isAr
                      ? 'إضافة طفل آخر لحسابكم'
                      : 'Rattacher un autre enfant'
                    : isAr
                    ? 'ربط هاتفكم بملف طفلكم في الروضة'
                    : 'Relier votre téléphone à votre enfant'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'سجّلوا اسم طفلكم (أو إخوته). بعد مصادقة المديرة، ستصلكم إشعارات الروضة مباشرة على هاتفكم.'
                    : 'Indiquez votre enfant (ou plusieurs frères/sœurs). Dès validation par la directrice, vous recevrez les notifications Push de la crèche.'}
                </p>
              </div>
            </div>

            {isRejected && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {isAr
                  ? `لم تتم المصادقة على الطلب السابق${request?.rejectionReason ? `: ${request.rejectionReason}` : ''}. يرجى التحقق من البيانات وإعادة الإرسال.`
                  : `La demande précédente n’a pas pu être validée${request?.rejectionReason ? ` (${request.rejectionReason})` : ''}. Vérifiez les informations ci-dessous.`}
              </div>
            )}

            <form onSubmit={handleSubmitLinkRequest} className="space-y-4">
              {/* Parent Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isAr ? 'اسم الولي *' : 'Votre prénom *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'مثال: نادية' : 'Ex: Nadia'}
                    value={parentPrenom}
                    onChange={(e) => setParentPrenom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isAr ? 'اللقب العائلي *' : 'Votre nom *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'مثال: عمراني' : 'Ex: Amrani'}
                    value={parentNom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParentNom(val);
                      setChildrenInputs((prev) =>
                        prev.map((c, idx) => (idx === 0 && !c.nom ? { ...c, nom: val } : c)),
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isAr ? 'رقم الهاتف *' : 'Téléphone mobile *'}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0555 12 34 56"
                    value={parentTelephone}
                    onChange={(e) => setParentTelephone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isAr ? 'صلة القرابة' : 'Lien de parenté'}
                  </label>
                  <select
                    value={parentLien}
                    onChange={(e) => setParentLien(e.target.value as 'Mère' | 'Père' | 'Tuteur')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                  >
                    <option value="Mère">{isAr ? 'الأم' : 'Mère'}</option>
                    <option value="Père">{isAr ? 'الأب' : 'Père'}</option>
                    <option value="Tuteur">{isAr ? 'ولي شرعي' : 'Tuteur légal'}</option>
                  </select>
                </div>
              </div>

              {/* Liste dynamique d'enfants à rattacher */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
                    {isAr ? 'الطفل (أو الإخوة) في الروضة *' : 'Enfant(s) inscrit(s) à la crèche *'}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddChildRow}
                    className="min-h-8! inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>{isAr ? 'إضافة أخ/أخت' : '+ Ajouter un enfant'}</span>
                  </button>
                </div>

                {childrenInputs.map((child, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500">
                        {isAr ? `الطفل ${idx + 1}` : `Enfant ${idx + 1}`}
                      </span>
                      {childrenInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChildRow(idx)}
                          className="min-h-7! h-7 w-7 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          aria-label={isAr ? 'حذف السطر' : 'Retirer cet enfant'}
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'اسم الطفل *' : 'Prénom de l’enfant *'}
                        value={child.prenom}
                        onChange={(e) =>
                          setChildrenInputs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, prenom: e.target.value } : item)),
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder={isAr ? 'لقب الطفل' : 'Nom de famille'}
                        value={child.nom}
                        onChange={(e) =>
                          setChildrenInputs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, nom: e.target.value } : item)),
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                      />
                      <select
                        value={child.groupeAge || 'Bébés'}
                        onChange={(e) =>
                          setChildrenInputs((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, groupeAge: e.target.value as any } : item,
                            ),
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
                      >
                        <option value="Bébés">{isAr ? 'الرضع (0-2)' : 'Bébés (0–2 ans)'}</option>
                        <option value="Moyens">{isAr ? 'المتوسطون (2-4)' : 'Moyens (2–4 ans)'}</option>
                        <option value="Grands">{isAr ? 'الكبار (4-6)' : 'Grands (4–6 ans)'}</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {formError && (
                <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {showAddSiblingForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddSiblingForm(false)}
                    className="min-h-10! sm:flex-1 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    {isAr ? 'رجوع' : 'Retour à mon Pass'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-10! sm:flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-black text-white shadow-sm transition cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? isAr
                      ? 'جارٍ الإرسال...'
                      : 'Envoi en cours...'
                    : isAr
                    ? 'إرسال طلب الربط للإدارة'
                    : 'Envoyer la demande à la directrice'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
