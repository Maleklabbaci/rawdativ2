import {
  formatInvoiceStatusLabel,
  invoicePeriod,
  localizeInvoicePeriodText,
  reminderBlockReason,
  reminderContext,
} from '../utils/financePeriod';
import { formatCurrency } from '../utils/format';
import {
  isNotificationSoundEnabled,
  playNotificationChime,
  setNotificationSoundEnabled,
} from '../utils/notificationSound';
import FinanceUnavailable from './FinanceUnavailable';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import {
  Bell,
  Megaphone,
  CreditCard,
  X,
  CheckCheck,
  Volume2,
  VolumeX,
  UserPlus,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationBellProps {
  onNavigateToPaiements: () => void;
  onNavigate?: (page: string) => void;
}

type BellFilter = 'all' | 'admissions' | 'annonces' | 'factures';

export default function NotificationBell({
  onNavigateToPaiements,
  onNavigate,
}: NotificationBellProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { canAccessPage } = useWorkspaceProfile();
  const {
    notifications = [],
    paiements: allPaiements = [],
    enfants: allEnfants = [],
    demandesAdmission = [],
    demandesDirecteur = [],
    comptes = [],
    messages = [],
    signalements = [],
    markNotificationRead,
    financialDataReady,
  } = useDb();

  const isFrench = language === 'fr';
  const isArabic = !isFrench;
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<BellFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());
  const [ringing, setRinging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';
  const isDirecteur = user?.role === 'directeur';

  const canSeeAdmissions = isDirecteur && canAccessPage('admissions');
  const canSeePaiements = !isAdmin && (!isDirecteur || canAccessPage('paiements'));
  const canSeeSupport = isAdmin || canAccessPage('support') || canAccessPage('communication');

  const enfants = isDirecteur ? allEnfants.filter(e => e.crecheId === user!.id) : allEnfants;
  const enfantIdsVisibles = new Set(enfants.map(e => e.id));
  const paiements = isDirecteur
    ? allPaiements.filter(p => enfantIdsVisibles.has(p.enfantId))
    : allPaiements;

  const mesAnnonces = isAdmin
    ? []
    : notifications
        .filter(
          n =>
            n.recipientRole === 'all_directeurs' ||
            n.recipientRole === user?.id ||
            n.recipientIds?.includes(user?.id || ''),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const annoncesNonLues = mesAnnonces.filter(n => !n.readBy?.includes(user?.id || ''));

  const displayAnnonce = (notification: (typeof mesAnnonces)[number]) => {
    const legacyText = `${notification.title} ${notification.message}`.toLowerCase();
    if (legacyText.includes('siteweb') || legacyText.includes('si ta pas')) {
      return {
        title: isFrench ? 'Information de la plateforme' : 'معلومة من المنصة',
        message: isFrench
          ? 'La plateforme Rawdha+ est disponible pour vous accompagner dans la gestion de votre crèche.'
          : 'منصة Rawdha+ متاحة لمساعدتكم في تسيير الحضانة.',
      };
    }
    return { title: notification.title, message: notification.message };
  };

  const pendingAdmissions = canSeeAdmissions
    ? demandesAdmission.filter(d => d.crecheId === user?.id && d.statut === 'en_attente')
    : [];

  const unreadMessages =
    canSeeSupport && user?.id
      ? messages.filter(
          (m: any) =>
            (isAdmin ? m.recipientId === 'admin' || m.recipientId === user.id : m.recipientId === user.id) &&
            m.senderId !== user.id &&
            m.isRead !== true,
        )
      : [];

  const pendingDirectorRequests = isAdmin
    ? demandesDirecteur.filter(d => d.statut === 'en_attente')
    : [];
  const pendingDirectorAccounts = isAdmin
    ? comptes.filter(c => c.role === 'directeur' && c.approvalStatus === 'pending')
    : [];
  const newSignalements = isAdmin
    ? signalements.filter((s: any) => s.statut === 'nouveau')
    : [];

  const reminderState = reminderContext(paiements);
  const suspected = canSeePaiements ? reminderState.suspectedIds : new Set<string>();
  const paiementsEnAttente =
    canSeePaiements && financialDataReady
      ? paiements
          .filter(p => reminderBlockReason(p, reminderState) === null)
          .map(p => ({ paiement: p, enfant: enfants.find(e => e.id === p.enfantId) }))
          .filter(x => x.enfant)
      : [];

  const needsReview = canSeePaiements
    ? paiements.filter(p => {
        const reason = reminderBlockReason(p, reminderState);
        return reason === 'period' || reason === 'sibling-period' || reason === 'details';
      }).length
    : 0;

  const totalBadge = isAdmin
    ? pendingDirectorRequests.length +
      pendingDirectorAccounts.length +
      unreadMessages.length +
      newSignalements.length
    : annoncesNonLues.length +
      pendingAdmissions.length +
      unreadMessages.length +
      paiementsEnAttente.length;

  useEffect(() => {
    const syncPref = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setSoundEnabled(typeof enabled === 'boolean' ? enabled : isNotificationSoundEnabled());
    };
    const handleChime = () => {
      setRinging(true);
      const timer = window.setTimeout(() => setRinging(false), 1100);
      return () => window.clearTimeout(timer);
    };
    window.addEventListener('rawdha:notification-sound-pref', syncPref);
    window.addEventListener('rawdha:notification-chime', handleChime);
    return () => {
      window.removeEventListener('rawdha:notification-sound-pref', syncPref);
      window.removeEventListener('rawdha:notification-chime', handleChime);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        (!drawerRef.current || !drawerRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenAnnonce = (id: string) => {
    if (user?.id && typeof markNotificationRead === 'function') {
      void Promise.resolve(markNotificationRead(id, user.id)).catch(() => {});
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationChime({ force: true });
    }
  };

  const shortTime = (dateStr: string) => {
    const ts = new Date(dateStr).getTime();
    if (Number.isNaN(ts)) return isFrench ? 'Récent' : 'الآن';
    const diffMs = Date.now() - ts;
    if (diffMs < 0) return isFrench ? 'Bientôt' : 'قريباً';
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 2) return isFrench ? 'À l’instant' : 'الآن';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return `${Math.floor(diffH / 24)}j`;
  };

  const badgeText = totalBadge > 99 ? '99+' : String(totalBadge);
  const showAdmissions = activeFilter === 'all' || activeFilter === 'admissions';
  const showAnnonces = activeFilter === 'all' || activeFilter === 'annonces';
  const showFactures = activeFilter === 'all' || activeFilter === 'factures';
  const shouldPortal = typeof document !== 'undefined' && Boolean(panelRef.current?.closest('header'));

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fond assombri sur téléphone (Bottom Sheet native hors du header flouté) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[9985] bg-slate-950/40 backdrop-blur-[1px] sm:hidden"
          />

          <motion.div
            ref={drawerRef}
            dir={isArabic ? 'rtl' : 'ltr'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 bottom-0 z-[9990] max-h-[80dvh] rounded-t-3xl bg-white shadow-2xl border-t border-slate-200/90 flex flex-col overflow-hidden sm:inset-auto sm:top-16 sm:end-6 sm:w-96 sm:max-h-[min(32rem,calc(100dvh-5rem))] sm:rounded-2xl sm:border"
          >
              {/* Poignée mobile type iOS */}
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <span className="h-1 w-9 rounded-full bg-slate-200" />
              </div>

              {/* Barre d'en-tête 1 seule ligne, zéro troncature */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 whitespace-nowrap">
                    {isFrench ? 'Notifications' : 'الإشعارات'}
                  </h3>
                  {totalBadge > 0 && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-600 tabular-nums">
                      {totalBadge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={soundEnabled}
                    className={`min-h-7! inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                      soundEnabled
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{soundEnabled ? (isFrench ? 'Son' : 'صوت') : (isFrench ? 'Muet' : 'صامت')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playNotificationChime({ force: true })}
                    aria-label={isFrench ? 'Tester la sonnerie' : 'تجربة الرنين'}
                    title={isFrench ? 'Tester la sonnerie' : 'تجربة الرنين'}
                    className="min-h-7! inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>{isFrench ? 'Tester' : 'تجربة'}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={isFrench ? 'Fermer' : 'إغلاق'}
                    onClick={() => setIsOpen(false)}
                    className="min-h-7! min-w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barre segmentée compacte de filtrage (Directrice) */}
              {!isAdmin && totalBadge > 0 && (
                <div className="grid grid-cols-4 gap-1 bg-slate-50/90 px-3 py-1.5 border-b border-slate-100">
                  {[
                    { id: 'all' as const, label: isFrench ? 'Tout' : 'الكل' },
                    { id: 'admissions' as const, label: isFrench ? 'Admissions' : 'التسجيل' },
                    { id: 'annonces' as const, label: isFrench ? 'Infos' : 'إعلانات' },
                    { id: 'factures' as const, label: isFrench ? 'Factures' : 'فواتير' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`min-h-7! rounded-lg px-1.5 py-1 text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                        activeFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Liste épurée : chaque ligne tient sur 2 lignes max avec icône structurée */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {!isAdmin && canSeePaiements && !financialDataReady && <FinanceUnavailable />}
                {!isAdmin && canSeePaiements && financialDataReady && suspected.size > 0 && (
                  <p className="bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
                    {isFrench
                      ? 'Des factures liées à un soupçon sont masquées des rappels ; consultez leur suivi.'
                      : 'الفواتير المرتبطة باشتباه مخفية من التذكيرات؛ راجع متابعتها.'}
                  </p>
                )}
                {!isAdmin && canSeePaiements && financialDataReady && needsReview > 0 && (
                  <p className="bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
                    {isFrench
                      ? `${needsReview} facture(s) exclues des rappels : période à vérifier sur leur dossier, ou montant/statut à vérifier. Consultez la facturation.`
                      : `${needsReview} فاتورة مستثناة من التذكيرات بسبب فترة تحتاج للمراجعة في ملف الطفل أو مبلغ أو حالة تحتاج للتحقق. راجع الفواتير.`}
                  </p>
                )}

                {/* Admin : Demandes Directeurs */}
                {isAdmin && (pendingDirectorRequests.length > 0 || pendingDirectorAccounts.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate?.('comptes');
                    }}
                    className="w-full text-start px-4 py-3 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isFrench ? 'Demandes Directeurs' : 'طلبات المديرات'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isFrench
                          ? `${pendingDirectorRequests.length + pendingDirectorAccounts.length} compte(s) à valider`
                          : `${pendingDirectorRequests.length + pendingDirectorAccounts.length} حساب بانتظار التفعيل`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 rtl:rotate-180" />
                  </button>
                )}

                {isAdmin && newSignalements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate?.('communication');
                    }}
                    className="w-full text-start px-4 py-3 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isFrench ? 'Tickets support' : 'بلاغات جديدة'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isFrench
                          ? `${newSignalements.length} nouveau(x) signalement(s)`
                          : `${newSignalements.length} طلب دعم جديد`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 rtl:rotate-180" />
                  </button>
                )}

                {/* Pré-inscriptions QR parents */}
                {showAdmissions &&
                  pendingAdmissions.slice(0, 6).map(req => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigate?.('admissions');
                      }}
                      className="w-full text-start px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <UserPlus className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {req.prenom} {req.nom}
                          </p>
                          <span className="shrink-0 text-[10px] font-medium text-slate-400 tabular-nums">
                            {shortTime(req.dateDemande)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {isFrench ? 'Pré-inscription QR' : 'طلب QR'} · {req.groupeAge} · {req.parentPrenom}
                        </p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    </button>
                  ))}

                {/* Messages Support non lus */}
                {showAnnonces &&
                  unreadMessages.slice(0, 4).map((msg: any) => (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigate?.(isAdmin ? 'communication' : 'support');
                      }}
                      className="w-full text-start px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <MessageSquare className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {msg.senderName || (isFrench ? 'Support Rawdha+' : 'دعم Rawdha+')}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{msg.text}</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                    </button>
                  ))}

                {/* Annonces plateforme */}
                {showAnnonces &&
                  mesAnnonces.map(n => {
                    const isRead = n.readBy?.includes(user?.id || '');
                    const copy = displayAnnonce(n);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleOpenAnnonce(n.id)}
                        className={`w-full text-start px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3 ${
                          !isRead ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <Megaphone className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{copy.title}</p>
                            <span className="shrink-0 text-[10px] font-medium text-slate-400 tabular-nums">
                              {shortTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{copy.message}</p>
                        </div>
                        {!isRead && <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}

                {/* Factures en attente / en retard */}
                {showFactures &&
                  paiementsEnAttente.slice(0, 12).map(({ paiement, enfant }) => (
                    <button
                      key={paiement.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateToPaiements();
                      }}
                      className="w-full text-start px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          paiement.statut === 'Retard'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {enfant?.prenom} {enfant?.nom}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate tabular-nums">
                          {localizeInvoicePeriodText(invoicePeriod(paiement), isArabic)} ·{' '}
                          {typeof paiement.montant === 'number' && Number.isFinite(paiement.montant)
                            ? formatCurrency(paiement.montant)
                            : '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 whitespace-nowrap text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                          paiement.statut === 'Retard'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {formatInvoiceStatusLabel(paiement.statut, isArabic)}
                      </span>
                    </button>
                  ))}

                {((isAdmin && totalBadge === 0) ||
                  (!isAdmin &&
                    financialDataReady &&
                    suspected.size === 0 &&
                    needsReview === 0 &&
                    pendingAdmissions.length === 0 &&
                    unreadMessages.length === 0 &&
                    mesAnnonces.length === 0 &&
                    paiementsEnAttente.length === 0)) && (
                  <div className="flex flex-col items-center justify-center py-9 px-4 text-center">
                    <CheckCheck className="w-7 h-7 text-emerald-500 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-500">
                      {isFrench ? 'Aucune notification visible.' : 'لا توجد إشعارات ظاهرة.'}
                    </p>
                  </div>
                )}
              </div>

              {onNavigate && (isAdmin || canAccessPage('notifications')) && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate('notifications');
                    }}
                    className="min-h-8! w-full inline-flex items-center justify-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800 whitespace-nowrap cursor-pointer"
                  >
                    <span>{isFrench ? 'Tout voir' : 'عرض الكل'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer flex-shrink-0 ${
          isOpen
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
            : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
        }`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className={`w-4 h-4 transition-transform ${ringing ? 'animate-bounce text-indigo-600' : ''}`} />
        {totalBadge > 0 && (
          <span
            data-notification-badge={totalBadge}
            className="absolute -top-1 -end-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[9.5px] font-bold leading-4 rounded-full flex items-center justify-center ring-2 ring-white tabular-nums"
          >
            {badgeText}
          </span>
        )}
      </button>

      {shouldPortal ? createPortal(drawerContent, document.body) : drawerContent}
    </div>
  );
}
