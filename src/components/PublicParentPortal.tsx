import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Home,
  Bell,
  ChevronDown,
  ExternalLink,
  CalendarDays,
  Newspaper,
  Settings2,
  ArrowUpRight,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  buildChildSnapshots,
  detectMobilePlatform,
  getCurrentDeviceParentRequest,
  getOrCreateParentDeviceToken,
  getRememberedParentCreche,
  isRunningStandalonePwa,
  loadParentAnnouncementsForDevice,
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
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/format';
import { parseParentInviteLink } from '../utils/parentInviteLink';
import { encodeParentAccessTransfer, decodeParentAccessTransfer } from '../utils/parentAccessClipboard';
import ParentInviteScanner from './ParentInviteScanner';
import './parentPortal.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ParentInviteEntry({ isAr }: { isAr: boolean }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const navigate = (path: string) => {
    const destination = new URL(path, window.location.origin);
    const sameDocument = destination.pathname === window.location.pathname && destination.search === window.location.search;
    window.location.assign(path);
    // A hash-only navigation does not remount React or load the invitation.
    if (sameDocument) window.location.reload();
  };
  const open = () => {
    const path = parseParentInviteLink(input, window.location.origin);
    if (!path) { setError(isAr ? 'الرابط غير صالح. استعملي الرابط الشخصي من الروضة على نفس الموقع.' : 'Lien invalide. Utilisez le lien personnel de la crèche pour ce même site.'); return; }
    navigate(path);
  };
  return <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-sm font-bold text-slate-900">{isAr ? 'ربط هاتفي بالروضة' : 'Relier mon téléphone à la crèche'}</p><p className="mt-2 text-xs text-slate-600">{isAr ? 'اطلبي من المديرة رمزاً شخصياً جديداً وامسحيه هنا. ستتحقق المديرة من هويتك قبل فتح الملف.' : 'Demandez un nouveau QR personnel à la directrice et scannez-le ici. Elle vérifiera votre identité avant de valider l’accès.'}</p>{!scanning ? <button type="button" onClick={() => setScanning(true)} className="mt-3 w-full rounded-xl bg-indigo-600 p-3 text-sm font-bold text-white">{isAr ? 'مسح رمز الروضة' : 'Scanner le QR de la crèche'}</button> : <ParentInviteScanner isAr={isAr} onClose={() => setScanning(false)} onFound={navigate}/>}<details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-indigo-700">{isAr ? 'لديّ رابط شخصي' : 'J’ai un lien personnel'}</summary><p className="mt-2 text-xs text-slate-600">{isAr ? 'الصقي الرابط الذي أرسلته الروضة. إذا استُخدم الرابط من قبل، اطلبي رابطاً جديداً.' : 'Collez le lien envoyé par la crèche. S’il a déjà été utilisé, demandez un nouveau lien à la directrice.'}</p><div className="mt-3 space-y-3"><label htmlFor="invite-link" className="text-sm font-bold text-slate-700">{isAr ? 'الرابط الشخصي' : 'Lien personnel'}</label><input id="invite-link" type="url" autoComplete="off" value={input} onChange={e => setInput(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"/><button type="button" onClick={open} className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-sm font-bold text-indigo-700">{isAr ? 'فتح الرابط' : 'Ouvrir mon lien'}</button>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}</div></details><p className="mt-3 text-xs text-slate-500">{isAr ? 'لا تشاركي الرمز أو الرابط مع أي شخص آخر.' : 'Ce QR et ce lien sont privés : ne les partagez pas.'}</p></div>;
}

function ParentAccessRecovery({ isAr, deviceToken }: { isAr: boolean; deviceToken: string }) {
  const [code, setCode] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recover = async (value: string) => {
    const token = decodeParentAccessTransfer(value, window.location.origin);
    if (!token) { setManual(true); setError(isAr ? 'تعذر قراءة الوصول المنسوخ. انسخيه مجدداً من حسابك.' : 'Accès copié introuvable ou expiré. Recopiez-le depuis votre espace parent.'); return; }
    try {
      const { data, error: rpcError } = await supabase.rpc('rawdha_redeem_parent_device_transfer', { p_token: token, p_device_token: deviceToken });
      if (rpcError || data?.ok !== true || typeof data.crecheId !== 'string') throw new Error('unconfirmed');
      rememberParentCreche(data.crecheId, data.crecheNom || '');
      window.location.assign('/espace-parent?creche=' + encodeURIComponent(data.crecheId));
    } catch { setError(isAr ? 'تعذر استعادة الوصول. تأكدي من المحاولة من نفس الموقع أو اتصلي بالروضة.' : 'Récupération non confirmée. Vérifiez votre accès avant de réessayer ou contactez la crèche.'); }
  };
  const pasteAndRecover = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!navigator.clipboard?.readText) throw new Error('unavailable');
      const value = await navigator.clipboard.readText();
      await recover(value);
    } catch { setManual(true); setError(isAr ? 'اضغطي مطولاً على الحقل والصقي الوصول المنسوخ.' : 'Appuyez longtemps dans le champ pour coller votre accès.'); }
    finally { setBusy(false); }
  };
  return <details className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-indigo-700">{isAr ? 'لديّ وصول معتمد بالفعل' : 'J’ai déjà un accès accepté'}</summary><p className="mt-3 text-xs text-slate-600">{isAr ? 'من حسابك المفتوح في المتصفح، اختاري «نسخ وصولي» في إعداداتي، ثم عودي إلى هنا.' : 'Dans votre espace parent déjà ouvert dans le navigateur, choisissez « Copier mon accès » dans Mon espace. Revenez ensuite ici.'}</p><button type="button" disabled={busy} onClick={() => void pasteAndRecover()} className="mt-3 w-full rounded-xl bg-indigo-600 p-3 text-sm font-bold text-white disabled:opacity-50">{busy ? (isAr ? 'جاري الفتح…' : 'Ouverture…') : (isAr ? 'فتح وصولي المنسوخ' : 'Ouvrir mon accès copié')}</button><button type="button" onClick={() => setManual(v => !v)} className="mt-2 text-xs font-semibold text-indigo-700">{isAr ? 'اللصق يدوياً' : 'Coller manuellement'}</button>{manual && <div className="mt-3"><label htmlFor="parent-recovery" className="block text-xs font-bold text-slate-700">{isAr ? 'الوصول المنسوخ' : 'Accès copié'}</label><textarea id="parent-recovery" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" rows={2}/><button type="button" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { await recover(code); } finally { setBusy(false); } }} className="mt-2 rounded-xl border px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50">{isAr ? 'فتح الوصول' : 'Ouvrir mon accès'}</button></div>}{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}</details>;
}

export default function PublicParentPortal() {
  const db = useDb();
  const [lang, setLang] = useState<'fr' | 'ar'>(() => {
    if (typeof window === 'undefined') return 'fr';
    try { return localStorage.getItem('rawdha_lang') === 'ar' ? 'ar' : 'fr'; } catch { return 'fr'; }
  });
  const isAr = lang === 'ar';
  const demoParentPreview = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' && (new URLSearchParams(window.location.search).get('demo_parent') === '1' || (import.meta.env.VITE_DEMO_PARENT === 'true' && window.location.pathname === '/')));

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
    return demoParentPreview
      ? { crecheId: 'preview-director', crecheNom: 'Crèche Les Petits Soleils' }
      : { crecheId: '', crecheNom: '' };
  }, [demoParentPreview]);

  const deviceToken = useMemo(() => getOrCreateParentDeviceToken(), []);
  const platform = useMemo(() => detectMobilePlatform(), []);

  const [childInvite, setChildInvite] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.hash.slice(1)).get('enfant') || '');
  const [request, setRequest] = useState<ParentLinkRequest | null>(null);
  const [announcements, setAnnouncements] = useState<ParentAnnouncement[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [parentTab, setParentTab] = useState<'home' | 'suivi' | 'news' | 'settings'>('home');
  const [parentTheme, setParentTheme] = useState<'prune' | 'terracotta' | 'sauge' | 'lavande'>(() => {
    try {
      const saved = localStorage.getItem('rawdha_parent_theme');
      return saved === 'terracotta' || saved === 'sauge' || saved === 'lavande' ? saved : 'prune';
    } catch { return 'prune'; }
  });
  const chooseParentTheme = (theme: 'prune' | 'terracotta' | 'sauge' | 'lavande') => {
    setParentTheme(theme);
    try { localStorage.setItem('rawdha_parent_theme', theme); } catch { /* Session-only choice. */ }
  };
  const [showAddSiblingForm, setShowAddSiblingForm] = useState(false);
  const [siblingHelp, setSiblingHelp] = useState(false);

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
  const [copyMessage, setCopyMessage] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [transferCopied, setTransferCopied] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [siblingSubmittedBanner, setSiblingSubmittedBanner] = useState(false);

  // Installation écran d'accueil + Push Notifications
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => typeof window === 'undefined' ? null : (window as Window & { __rawdhaParentInstallPrompt?: BeforeInstallPromptEvent | null }).__rawdhaParentInstallPrompt || null);
  const [homeInstalled, setHomeInstalled] = useState<boolean>(() => isRunningStandalonePwa());
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');
  const [pushDeviceReady, setPushDeviceReady] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [installStatusMsg, setInstallStatusMsg] = useState('');
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
      (window as Window & { __rawdhaParentInstallPrompt?: BeforeInstallPromptEvent | null }).__rawdhaParentInstallPrompt = null;
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
      if (!crecheContext.crecheId || !deviceToken) return;
      let req: ParentLinkRequest | null;
      let anns: ParentAnnouncement[];
      try {
        [req, anns] = await Promise.all([
          getCurrentDeviceParentRequest(crecheContext.crecheId, deviceToken),
          loadParentAnnouncementsForDevice(crecheContext.crecheId, deviceToken),
        ]);
      } catch {
        return;
      }
      if (!mounted) return;
      if (demoParentPreview && db.enfants?.length) {
        const child = db.enfants[0];
        req = {
          id: 'demo-parent-preview', crecheId: crecheContext.crecheId, crecheNom: crecheContext.crecheNom,
          parentPrenom: 'Nadia', parentNom: 'Exemple', parentTelephone: '0555000000', parentLien: 'Mère',
          requestedChildren: [{ prenom: child.prenom, nom: child.nom, groupeAge: child.groupeAge }],
          linkedEnfantIds: [child.id], status: 'approved', pushEnabled: false, homeScreenInstalled: false,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        anns = [{ id: 'demo-news', crecheId: crecheContext.crecheId, title: 'Atelier créatif cette semaine',
          message: 'Les enfants découvrent la peinture et les couleurs. Pensez à prévoir une tenue confortable.',
          category: 'evenement', targetScope: 'all', senderName: 'La direction', sentPushCount: 0, createdAt: new Date().toISOString() }];
      }
      setRequest(req);
      setAnnouncements(anns);

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
  }, [crecheContext.crecheId, crecheContext.crecheNom, deviceToken, demoParentPreview, db.enfants]);

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
      });
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
      if (childInvite) {
        if (!deviceToken) throw new Error('Accès parent indisponible sur cet appareil. Contactez la crèche.');
        const { data, error } = await supabase.rpc('rawdha_submit_child_parent_invite', {
          p_token: childInvite, p_device_token: deviceToken,
          p_parent_prenom: parentPrenom.trim(), p_parent_nom: parentNom.trim(),
          p_parent_telephone: parentTelephone.trim(), p_parent_lien: parentLien, p_platform_hint: platform,
        });
        if (error || data?.ok !== true) throw new Error(isAr ? 'تعذر إرسال الطلب. تحققي من الحالة أو اطلبي رمزاً جديداً.' : 'Envoi non confirmé. Vérifiez votre demande ou demandez un nouveau QR à la crèche.');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setChildInvite('');
        const saved = await getCurrentDeviceParentRequest(crecheContext.crecheId, deviceToken);
        if (!saved) throw new Error('Demande envoyée, mais statut indisponible. Actualisez la page.');
        setRequest(saved);
        return;
      }
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
    setInstallStatusMsg('');
    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        setInstallStatusMsg(choice.outcome === 'accepted'
          ? (isAr ? 'افتحي التطبيق من الشاشة الرئيسية لإكمال الإعداد.' : 'Si l’installation est terminée, ouvrez l’espace depuis votre écran d’accueil.')
          : (isAr ? 'يمكنك المحاولة لاحقاً.' : 'Vous pourrez réessayer plus tard.'));
      } catch {
        setShowIosGuide(true);
      }
      setDeferredInstallPrompt(null);
      (window as Window & { __rawdhaParentInstallPrompt?: BeforeInstallPromptEvent | null }).__rawdhaParentInstallPrompt = null;
      return;
    }
    setShowIosGuide(previous => !previous);
  };

  useEffect(() => {
    let cancelled = false;
    const checkDevice = async () => {
      const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
      if (!cancelled) setPushPermission(permission);
      let subscription: PushSubscription | null = null;
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration('/');
          subscription = await registration?.pushManager?.getSubscription() || null;
        }
      } catch { /* The status remains unconfirmed. */ }
      if (!cancelled) setPushDeviceReady(Boolean(permission === 'granted' && subscription && request?.pushEnabled));
    };
    void checkDevice();
    window.addEventListener('focus', checkDevice);
    document.addEventListener('visibilitychange', checkDevice);
    return () => { cancelled = true; window.removeEventListener('focus', checkDevice); document.removeEventListener('visibilitychange', checkDevice); };
  }, [request?.pushEnabled]);

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushStatusMsg('');
    if (demoParentPreview) {
      setPushStatusMsg(isAr ? 'عرض فقط: لا يتم تفعيل الإشعارات في النسخة التجريبية.' : 'Aperçu seulement : aucune notification réelle n’est activée ici.');
      setPushBusy(false);
      return;
    }
    if (platform === 'ios' && !isRunningStandalonePwa()) {
      setPushStatusMsg(isAr ? 'افتحي التطبيق من الشاشة الرئيسية أولاً.' : 'Ouvrez d’abord cet espace depuis l’écran d’accueil.');
      setShowIosGuide(true);
      setPushBusy(false);
      return;
    }
    try {
      const res = await subscribeParentWebPush({
        crecheId: crecheContext.crecheId,
        crecheNom: crecheContext.crecheNom,
        deviceToken,
      });
      if (res.ok) {
        const refreshed = await getCurrentDeviceParentRequest(crecheContext.crecheId, deviceToken);
        setRequest(refreshed);
        setPushPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
        setPushDeviceReady(res.reason !== 'demo');
        setPushStatusMsg(res.reason === 'demo'
          ? (isAr ? 'إشعار تجريبي محلي فقط.' : 'Notification locale de démonstration uniquement.')
          : (isAr ? 'تم تسجيل الإشعارات على هذا الجهاز. يلزم اختبار الاستلام.' : 'Notifications enregistrées sur cet appareil. Un test de réception reste nécessaire.'));
      } else if (res.reason === 'denied') {
        setPushPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
        setPushStatusMsg(
          isAr
            ? 'الإشعارات محظورة في إعدادات المتصفح. يرجى السماح بها من إعدادات الهاتف.'
            : 'Notifications refusées dans le navigateur. Autorisez-les dans les réglages du site.',
        );
      } else if (res.reason === 'registration_failed') {
        setPushStatusMsg(isAr
          ? 'تعذر تسجيل الإشعارات. تحققي من إعدادات الجهاز والاتصال ثم حاولي مجدداً.'
          : 'Impossible d’enregistrer les notifications. Vérifiez les réglages et la connexion, puis réessayez.');
      } else {
        setPushStatusMsg(
          isAr
            ? 'أضف الصفحة للشاشة الرئيسية أولاً لتفعيل إشعارات الهاتف.'
            : 'Ajoutez d’abord l’application sur l’écran d’accueil pour activer les notifications sur cet appareil.',
        );
      }
    } catch {
      setPushStatusMsg(isAr ? 'تعذر تسجيل الإشعارات. حاولي مجدداً.' : 'Impossible d’enregistrer les notifications. Réessayez.');
    } finally {
      setPushBusy(false);
    }
  };

  const isApprovedWithChildren = request?.status === 'approved' && linkedChildren.length > 0;
  const isPendingApproval = request?.status === 'pending';
  const isRejected = request?.status === 'rejected';
  const pushAlreadyActive = pushDeviceReady;
  const insideFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

  if (!deviceToken) {
    return <div role="alert" dir={isAr ? 'rtl' : 'ltr'} className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center"><div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-sm text-slate-800"><p className="font-bold">{isAr ? 'تعذر فتح فضاء الأولياء بأمان.' : 'Impossible d’ouvrir l’espace parent en sécurité.'}</p><p className="mt-2">{isAr ? 'تحققي من إعدادات التخزين في المتصفح أو تواصلي مع الروضة لاستعادة الوصول.' : 'Vérifiez les réglages de stockage du navigateur ou contactez la crèche pour rétablir votre accès.'}</p></div></div>;
  }


  if (!crecheContext.crecheId) {
    return <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#fffaf8] p-5"><div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm border border-orange-100"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-14 w-14 rounded-xl"/><div className="my-4 flex items-center justify-between"><h1 className="text-xl font-black text-slate-900">{isAr ? 'فضاء الأولياء' : 'Espace Parent'}</h1><button type="button" onClick={() => setLang(isAr ? 'fr' : 'ar')} className="rounded-lg border px-3 py-2 text-sm font-bold">{isAr ? 'FR' : 'ع'}</button></div><ParentAccessRecovery isAr={isAr} deviceToken={deviceToken}/><div className="mt-4"><ParentInviteEntry isAr={isAr}/></div></div></div>;
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      data-parent-theme={parentTheme}
      className="parent-app min-h-screen pb-12"
    >
      <header className="parent-app-header">
        <div className="parent-header-inner">
          <div className="parent-brand"><img src="/rawdah-logo.png" alt="Rawdha+"/><div><strong>Rawdha<span>+</span></strong><small>{isAr ? 'فضاء الأولياء' : 'Espace parents'}</small></div></div>
          <div className="parent-header-actions"><button type="button" className="parent-language" onClick={() => setLang((prev) => (prev === 'fr' ? 'ar' : 'fr'))}>{isAr ? 'FR' : 'ع'}</button>{request?.status === 'approved' && <span className="parent-account" aria-label={isAr ? 'حساب الولي' : 'Compte parent'}>{request.parentPrenom.charAt(0).toUpperCase()}</span>}</div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4 space-y-4">
        {demoParentPreview && <div role="status" className="rounded-xl bg-[#fff5db] px-3 py-2 text-[11px] font-semibold text-[#806329]">{isAr ? 'عرض تجريبي ببيانات وهمية — لا توجد إشعارات فعلية.' : 'Aperçu parent · Données fictives, aucune notification réelle.'}</div>}
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
          <div className="parent-home">
            {childInvite && <p role="status" className="parent-note">{isAr ? 'هذا الهاتف مرتبط بالفعل. لإضافة طفل آخر، تواصلي مع المديرة.' : 'Ce téléphone est déjà lié. Pour ajouter un autre enfant, contactez la directrice.'}</p>}
            <section className="parent-settings" hidden={parentTab !== 'settings' && (parentTab !== 'home' || (homeInstalled && pushAlreadyActive))} aria-labelledby="parent-settings-title">
              <div className="parent-settings-heading"><div><p className="parent-eyebrow">{isAr ? 'الإعدادات' : 'VOTRE ESPACE'}</p><h2 id="parent-settings-title">{isAr ? 'ابقوا على اطلاع' : 'Toujours à vos côtés'}</h2><p>{isAr ? 'خطوتان بسيطتان لمتابعة أخبار طفلكم.' : 'Deux petits gestes pour ne rien manquer de sa journée.'}</p></div><span className="parent-settings-heart" aria-hidden="true">♥</span></div>
              <div className="parent-setting-row">
                <span className="parent-setting-icon parent-setting-icon-home"><Home size={20} strokeWidth={1.8}/></span>
                <div className="parent-setting-copy"><h3>{isAr ? 'على الشاشة الرئيسية' : 'Sur l’écran d’accueil'}</h3><p>{homeInstalled ? (isAr ? 'مفتوح من الشاشة الرئيسية' : 'Ouvert depuis l’écran d’accueil') : (isAr ? 'افتحي فضاء الأولياء بسهولة' : 'Votre espace à portée de main')}</p></div>
                <button type="button" className="parent-setting-button" aria-expanded={showIosGuide} onClick={() => void handleInstallHomeScreen()}>{homeInstalled ? (isAr ? 'التعليمات' : 'Aide') : (isAr ? 'إضافة' : 'Ajouter')} <ChevronDown size={13}/></button>
              </div>
              {installStatusMsg && <p className="parent-setting-message" role="status">{installStatusMsg}</p>}
              {showIosGuide && <div className="parent-install-guide">
                <strong>{platform === 'ios' ? (isAr ? 'على iPhone أو iPad' : 'Sur iPhone ou iPad') : platform === 'android' ? (isAr ? 'على Android' : 'Sur Android') : (isAr ? 'على هاتفك' : 'Sur votre téléphone')}</strong>
                <ol>{platform === 'ios' ? <><li>{isAr ? 'افتحي الصفحة في Safari واضغطي على زر المشاركة.' : 'Ouvrez cette page dans Safari, puis touchez le bouton Partager.'}</li><li>{isAr ? 'اختاري «إضافة إلى الشاشة الرئيسية» ثم «إضافة».' : 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».'}</li></> : <><li>{isAr ? 'افتحي قائمة المتصفح ⋮.' : 'Ouvrez le menu du navigateur ⋮.'}</li><li>{isAr ? 'اختاري «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».' : 'Choisissez « Ajouter à l’écran d’accueil » ou « Installer l’application ».'}</li></>}</ol>
                <p>{isAr ? 'ثم افتحي الأيقونة من الشاشة الرئيسية. قد تحتاجين إلى طلب الربط مجدداً إذا لم تظهر بياناتك.' : 'Ouvrez ensuite l’icône depuis l’écran d’accueil. Si votre accès n’apparaît pas, demandez une nouvelle liaison à la crèche.'}</p>
              </div>}
              <div className="parent-setting-row">
                <span className="parent-setting-icon parent-setting-icon-bell"><Bell size={20} strokeWidth={1.8}/></span>
                <div className="parent-setting-copy"><h3>{isAr ? 'الإشعارات' : 'Notifications'}</h3><p>{pushAlreadyActive ? (isAr ? 'مسجلة على هذا الجهاز' : 'Enregistrées sur cet appareil') : pushPermission === 'denied' ? (isAr ? 'محظورة في المتصفح' : 'Bloquées par le navigateur') : (isAr ? 'أخبار الروضة على هاتفك' : 'Les nouvelles de la crèche sur votre téléphone')}</p></div>
                <button type="button" className="parent-setting-button parent-setting-button-accent" disabled={pushBusy || pushAlreadyActive} onClick={() => void handleEnablePush()}>{pushAlreadyActive ? (isAr ? 'مفعّلة' : 'Activées') : pushBusy ? (isAr ? 'جارٍ التفعيل' : 'Activation…') : (isAr ? 'تفعيل' : 'Activer')}</button>
              </div>
              {pushPermission === 'denied' && <p className="parent-setting-message">{isAr ? 'اسمحي بالإشعارات من إعدادات الموقع في المتصفح، ثم عودي إلى هنا.' : 'Autorisez les notifications dans les réglages de ce site, puis revenez ici.'}</p>}
              {platform === 'ios' && !isRunningStandalonePwa() && <p className="parent-setting-message">{isAr ? 'على iPhone، أضيفي التطبيق للشاشة الرئيسية وافتحيه منها قبل تفعيل الإشعارات.' : 'Sur iPhone, ajoutez d’abord cet espace à l’écran d’accueil et ouvrez-le depuis son icône pour activer les notifications.'}</p>}
              {insideFrame && !demoParentPreview && <a className="parent-open-browser" href={window.location.href} target="_blank" rel="noreferrer">{isAr ? 'فتح في المتصفح' : 'Ouvrir dans le navigateur'} <ExternalLink size={13}/></a>}
              {pushStatusMsg && <p role="status" className="parent-setting-message">{pushStatusMsg}</p>}
              {pushAlreadyActive && <p className="parent-setting-footnote">{isAr ? 'يعتمد الاستلام على إعدادات هاتفك والاتصال.' : 'La réception dépend des réglages de votre téléphone et de la connexion.'}</p>}
            </section>
            {parentTab === 'settings' && <section className="parent-theme-card"><h2 className="font-bold">{isAr ? 'فتح حسابي على الشاشة الرئيسية' : 'Retrouver mon accès sur mon écran d’accueil'}</h2><p className="mt-2 text-xs">{isAr ? 'انسخي وصولك ثم افتحي تطبيقك على الشاشة الرئيسية. الوصول سري وصالح 10 دقائق ولمرة واحدة.' : 'Copiez votre accès, puis ouvrez votre application sur l’écran d’accueil. Cet accès est privé, valable 10 minutes et une seule fois.'}</p><button type="button" disabled={transferBusy} onClick={() => {
              if (transferBusy) return;
              setTransferBusy(true); setTransferCode(''); setTransferError(''); setTransferCopied(false);
              // Safari needs clipboard.write called directly in the tap handler, before awaiting the RPC.
              const transfer = Promise.resolve(supabase.rpc('rawdha_create_parent_device_transfer', {p_creche_id:crecheContext.crecheId,p_device_token:deviceToken})).then(({data,error}) => {
                if (error || !/^[0-9a-f]{64}$/.test(data?.token || '')) throw new Error('unavailable');
                return encodeParentAccessTransfer(data.token, window.location.origin);
              });
              const write = (() => { try {
                if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return null;
                return navigator.clipboard.write([new ClipboardItem({'text/plain': transfer.then(value => new Blob([value], {type:'text/plain'}))})]).then(() => true, () => false);
              } catch { return null; } })();
              void (async () => { try {
                const value = await transfer;
                if (write && await write) { setTransferCopied(true); return; }
                setTransferCode(value);
                setTransferError(isAr ? 'اضغطي مطولاً لنسخ الوصول من الحقل.' : 'La copie automatique est indisponible. Copiez votre accès dans le champ ci-dessous.');
              } catch { if (write) await write; setTransferError(isAr ? 'تعذر تجهيز الوصول. اتصلي بالروضة.' : 'Impossible de préparer l’accès. Contactez la crèche.'); }
              finally { setTransferBusy(false); } })();
            }} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{transferBusy ? (isAr ? 'جاري النسخ…' : 'Préparation…') : (isAr ? 'نسخ وصولي' : 'Copier mon accès')}</button>{transferCopied && <p role="status" className="mt-3 text-xs font-bold text-emerald-700">{isAr ? 'تم النسخ. افتحي تطبيق الشاشة الرئيسية ثم اختاري فتح وصولي المنسوخ.' : 'Accès copié. Ouvrez l’application de l’écran d’accueil, puis choisissez « Ouvrir mon accès copié ».'}</p>}{transferCode && <div className="mt-3"><label htmlFor="transfer-code" className="text-xs font-bold">{isAr ? 'الوصول الخاص' : 'Votre accès privé'}</label><textarea id="transfer-code" readOnly value={transferCode} onFocus={e => e.currentTarget.select()} className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs" rows={3}/></div>}{transferError && <p role="status" className="mt-2 text-xs">{transferError}</p>}</section>}
            {parentTab === 'settings' && <section className="parent-theme-card" aria-labelledby="parent-theme-heading">
              <div className="parent-theme-head"><div><p className="parent-eyebrow">{isAr ? 'على ذوقك' : 'À VOTRE IMAGE'}</p><h2 id="parent-theme-heading">{isAr ? 'ألواني' : 'Mes couleurs'}</h2><p>{isAr ? 'اختاري الألوان التي تحبينها لهذا الجهاز.' : 'Choisissez les couleurs qui vous ressemblent.'}</p></div><span aria-hidden="true">✳</span></div>
              <div className="parent-theme-options" role="group" aria-label={isAr ? 'اختيار الألوان' : 'Choisir les couleurs'}>
                {([
                  ['prune', isAr ? 'برقوقي' : 'Prune'], ['terracotta', isAr ? 'مرجاني' : 'Corail'],
                  ['sauge', isAr ? 'أخضر' : 'Sauge'], ['lavande', isAr ? 'لافندر' : 'Lavande'],
                ] as const).map(([key, label]) => <button type="button" key={key} className="parent-theme-option" data-swatch={key} aria-pressed={parentTheme === key} onClick={() => chooseParentTheme(key)}><span className="parent-theme-swatch">{parentTheme === key && <CheckCircle2 size={18}/>}</span><small>{label}</small></button>)}
              </div>
              <p className="parent-theme-hint">{isAr ? 'يُحفظ الاختيار على هذا الجهاز فقط.' : 'Votre choix est enregistré sur cet appareil.'}</p>
            </section>}
            {parentTab === 'home' && <div className="parent-welcome">
              <p className="parent-kicker">{isAr ? 'معكم كل يوم' : 'À VOS CÔTÉS, CHAQUE JOUR'}</p>
              <h1>{isAr ? `مرحباً ${request?.parentPrenom}` : `Bonjour ${request?.parentPrenom},`}</h1>
              <p>{isAr ? 'لحظات صغيرة، أخبار كبيرة.' : 'Les petites nouvelles qui comptent.'}</p>
            </div>}
            {parentTab !== 'home' && <div className="parent-page-heading"><p>{isAr ? 'فضاء الأولياء' : 'ESPACE PARENTS'}</p><h1>{parentTab === 'suivi' ? (isAr ? 'متابعة طفلي' : 'Le suivi de mon enfant') : parentTab === 'news' ? (isAr ? 'أخبار الروضة' : 'Les nouvelles') : (isAr ? 'إعداداتي' : 'Mon espace')}</h1><span>{parentTab === 'suivi' ? (isAr ? 'كل المعلومات المهمة عن يوم طفلكم.' : 'Les informations partagées par la crèche.') : parentTab === 'news' ? (isAr ? 'كل أخبار الروضة في مكان واحد.' : 'Toute l’actualité de votre crèche au même endroit.') : (isAr ? 'ضبط الوصول والإشعارات.' : 'Gérez votre accès et vos notifications.')}</span></div>}

            {siblingSubmittedBanner && <p className="parent-note" role="status">{isAr ? 'تم إرسال طلب إضافة الطفل للمديرة.' : 'Votre demande d’ajout a été envoyée à la directrice.'}</p>}

            <section className="parent-child-section" hidden={parentTab !== 'home' && parentTab !== 'suivi'}>
              <div className="parent-section-top">
                <div><p className="parent-eyebrow">{isAr ? 'متابعة اليوم' : 'SON PETIT QUOTIDIEN'}</p><h2>{isAr ? 'طفلي' : 'Mon enfant'}</h2></div>
                <button type="button" className="parent-text-action" aria-expanded={siblingHelp} onClick={() => setSiblingHelp(value => !value)}>{isAr ? '+ إضافة طفل' : '+ Ajouter un enfant'}</button>
              </div>
              {siblingHelp && <p role="status" className="parent-note">{isAr ? 'لإضافة طفل آخر، تواصلي مع المديرة. لا يتم منح الوصول دون موافقتها.' : 'Pour ajouter un autre enfant, contactez la directrice. Aucun accès ne sera ajouté sans sa validation.'}</p>}
              {linkedChildren.length > 1 && <div className="parent-child-picker" aria-label={isAr ? 'اختيار الطفل' : 'Choisir un enfant'}>
                {linkedChildren.map(child => <button key={child.id} type="button" aria-pressed={child.id === activeChild?.id} onClick={() => setSelectedChildId(child.id)}>{child.prenom}</button>)}
              </div>}
              {activeChild && <div className="parent-child-line">
                <div className="parent-avatar" aria-hidden="true">{activeChild.prenom.charAt(0)}</div>
                <div className="parent-child-name"><strong>{activeChild.prenom} {activeChild.nom}</strong><span>{isAr ? 'القسم' : 'Section'} {activeChild.groupeAge}</span></div>
                <div className="parent-presence"><span>{isAr ? 'اليوم' : 'Aujourd’hui'}</span><strong>{activeChild.presenceToday?.statut || (isAr ? 'لم يسجل بعد' : 'Non renseigné')}</strong>{activeChild.presenceToday?.heureArrivee && <small>{isAr ? 'الوصول' : 'Arrivée'} {activeChild.presenceToday.heureArrivee}</small>}</div>
              </div>}
            </section>

            <div className="parent-creche-label" hidden={parentTab !== 'home'}>{isAr ? 'روضة' : 'Votre crèche'} <strong>{crecheContext.crecheNom}</strong></div>

            <section className="parent-news" hidden={parentTab !== 'home' && parentTab !== 'news'}>
              <div className="parent-section-top"><div><p className="parent-eyebrow">{isAr ? 'من الروضة' : 'LE FIL DE LA CRÈCHE'}</p><h2>{isAr ? 'أخبار الروضة' : 'Les nouvelles'}</h2></div><span className="parent-section-symbol" aria-hidden="true">✳</span></div>
              {visibleAnnouncements.length ? <div className="parent-news-list">{(parentTab === 'home' ? visibleAnnouncements.slice(0, 2) : visibleAnnouncements).map(ann => <article key={ann.id} className="parent-news-item">
                <div className="parent-news-date">{new Date(ann.createdAt).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-FR', {day:'numeric', month:'short'})}</div>
                <div><h3>{ann.title}</h3><p>{ann.message}</p><small>{ann.senderName || (isAr ? 'الإدارة' : 'La direction')}</small></div>
              </article>)}</div> : <p className="parent-empty">{isAr ? 'لا توجد أخبار جديدة حالياً.' : 'Pas de nouvelles pour le moment.'}</p>}
              {parentTab === 'home' && visibleAnnouncements.length > 2 && <button className="parent-see-all" type="button" onClick={() => { setParentTab('news'); window.scrollTo(0, 0); }}>{isAr ? 'كل الأخبار' : 'Voir toutes les nouvelles'} <ArrowUpRight size={15}/></button>}
            </section>

            {activeChild && <section className="parent-day" hidden={parentTab !== 'home' && parentTab !== 'suivi'}>
              <div className="parent-section-top"><div><p className="parent-eyebrow">{isAr ? 'يوم جميل' : 'UNE BELLE JOURNÉE'}</p><h2>{isAr ? 'برنامج اليوم' : 'Au programme aujourd’hui'}</h2></div></div>
              <div className="parent-day-grid">
                <div><p className="parent-day-label">{isAr ? 'الوجبات' : 'REPAS'}</p>{activeChild.todayMeals.length ? activeChild.todayMeals.map(meal => <p key={meal.id} className="parent-day-entry"><strong>{meal.type}</strong><span>{meal.menu}</span></p>) : <p className="parent-empty">{isAr ? 'لم تُنشر وجبات اليوم بعد.' : 'Le menu n’a pas encore été publié.'}</p>}</div>
                <div><p className="parent-day-label">{isAr ? 'الأنشطة' : 'ACTIVITÉS'}</p>{activeChild.todayActivities.length ? activeChild.todayActivities.map(activity => <p key={activity.id} className="parent-day-entry"><strong>{activity.titre}</strong>{activity.heureDebut && <span>{activity.heureDebut}{activity.heureFin ? ` – ${activity.heureFin}` : ''}</span>}</p>) : <p className="parent-empty">{isAr ? 'لا توجد أنشطة مسجلة اليوم.' : 'Aucune activité renseignée aujourd’hui.'}</p>}</div>
              </div>
            </section>}

            {activeChild && activeChild.invoices.length > 0 && <section className="parent-invoices" hidden={parentTab !== 'suivi'}>
              <div className="parent-section-top"><h2>{isAr ? 'الفواتير' : 'Factures'}</h2></div>
              {activeChild.invoices.map(inv => <div key={inv.id} className="parent-invoice-row"><span>{inv.moisConcerne}</span><strong>{formatCurrency(inv.montant)}</strong><span>{inv.statut}</span></div>)}
            </section>}


            <nav className="parent-app-nav" aria-label={isAr ? 'تنقل فضاء الأولياء' : 'Navigation espace parents'}>
              {([
                ['home', Home, isAr ? 'الرئيسية' : 'Accueil'],
                ['suivi', CalendarDays, isAr ? 'المتابعة' : 'Suivi'],
                ['news', Newspaper, isAr ? 'الأخبار' : 'Actualités'],
                ['settings', Settings2, isAr ? 'حسابي' : 'Mon espace'],
              ] as const).map(([tab, Icon, label]) => <button key={tab} type="button" aria-current={parentTab === tab ? 'page' : undefined} onClick={() => { setParentTab(tab); window.scrollTo({ top: 0, behavior: 'auto' }); }}><span><Icon size={19} strokeWidth={parentTab === tab ? 2.4 : 1.8}/></span><small>{label}</small></button>)}
            </nav>
          </div>
        ) : isPendingApproval && !showAddSiblingForm ? (
          /* ================================================================
             ÉTAT 2 : DEMANDE ENVOYÉE — ATTENTE AUTOMATIQUE DE VALIDATION
             ================================================================ */
          <section
            id="parent-waiting-approval"
            className="rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-sm space-y-4"
          >
            {childInvite && <p role="status" className="text-xs text-amber-800">{isAr ? 'يوجد طلب سابق لهذا الهاتف. تواصلي مع المديرة قبل إرسال طلب آخر.' : 'Une demande existe déjà sur ce téléphone. Contactez la directrice avant d’en envoyer une autre.'}</p>}
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
                    ? (childInvite ? 'أكملي بياناتك ثم انتظري مصادقة المديرة.' : 'سجّلوا اسم طفلكم (أو إخوته). بعد مصادقة المديرة، يمكن تفعيل الإشعارات.')
                    : (childInvite ? 'Renseignez vos coordonnées puis attendez la validation de la directrice.' : 'Indiquez votre enfant (ou plusieurs frères/sœurs). Après validation, vous pourrez activer les notifications.')}
                </p>
              </div>
            </div>

            {!childInvite && !request && <><ParentAccessRecovery isAr={isAr} deviceToken={deviceToken}/><ParentInviteEntry isAr={isAr}/></>}
            {isRejected && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {isAr
                  ? `لم تتم المصادقة على الطلب السابق${request?.rejectionReason ? `: ${request.rejectionReason}` : ''}. يرجى التحقق من البيانات وإعادة الإرسال.`
                  : `La demande précédente n’a pas pu être validée${request?.rejectionReason ? ` (${request.rejectionReason})` : ''}. Vérifiez les informations ci-dessous.`}
              </div>
            )}

            {platform === 'ios' && !homeInstalled && childInvite && !request && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-800 space-y-2"><p className="font-bold">{isAr ? 'على iPhone، ثبّتي فضاء الأولياء أولاً' : 'Sur iPhone, installez d’abord l’Espace Parent'}</p><p>{isAr ? 'انسخي رابط الدعوة، ثم في Safari اضغطي مشاركة ← على الشاشة الرئيسية. افتحي الأيقونة والصقي الرابط قبل إرسال الطلب.' : 'Copiez votre lien personnel. Dans Safari, touchez Partager puis « Sur l’écran d’accueil ». Ouvrez l’icône et collez le lien avant d’envoyer la demande.'}</p><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyMessage(isAr ? 'تم نسخ الرابط.' : 'Lien copié.'); } catch { setCopyMessage(isAr ? 'انسخي الرابط من شريط العنوان.' : 'Copiez le lien dans la barre d’adresse de Safari.'); } }} className="rounded-lg bg-white border border-orange-200 px-3 py-2 font-bold text-orange-800">{isAr ? 'نسخ الرابط' : 'Copier mon lien'}</button>{copyMessage && <p role="status">{copyMessage}</p>}<p className="text-xs">{isAr ? 'الرابط سري ويستخدم مرة واحدة.' : 'Ce lien est privé et utilisable une seule fois.'}</p></div>}
            {childInvite && <div className="rounded-2xl bg-[#fff5eb] p-4 text-sm text-slate-700"><p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">{isAr ? 'دعوة شخصية من' : 'Invitation personnelle de'}</p><p className="mt-1 font-bold">{crecheContext.crecheNom}</p><p className="mt-1 text-xs leading-relaxed">{isAr ? 'بعد مصادقة المديرة، ستظهر معلومات طفلك هنا.' : 'Après validation par la directrice, le nom et les informations de votre enfant apparaîtront ici.'}</p></div>}
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

              {!childInvite && <div className="space-y-2.5 pt-1">
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
              </div>}

              {childInvite && <p className="rounded-xl bg-indigo-50 p-3 text-xs font-semibold text-indigo-800">{isAr ? 'تم تحديد الطفل بواسطة الرمز. ستتحقق المديرة من هويتكم قبل الموافقة.' : 'Ce QR désigne un enfant. La directrice vérifiera votre identité avant de valider l’accès.'}</p>}

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
