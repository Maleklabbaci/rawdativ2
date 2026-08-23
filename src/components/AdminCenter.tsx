/** Style Rawdha+ Admin Center: surfaces blanches denses, accents indigo/ambre, priorités lisibles et actions sensibles confirmées. */
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  ClipboardCheck,
  Clock3,
  Headset,
  History,
  MessageSquareText,
  Network,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRoundPlus,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useToast } from '../contexts/ToastContext';
import type { DemandeDirecteur, UserAccount } from '../types';

type AdminView = 'pilotage' | 'creches' | 'validations' | 'qualite' | 'historique';

type AdminCenterProps = {
  onNavigate: (page: string) => void;
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const daysUntil = (value?: string) => {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const isStale = (value?: string) => {
  if (!value) return true;
  const lastActivity = new Date(value).getTime();
  return Number.isNaN(lastActivity) || Date.now() - lastActivity > 14 * 86_400_000;
};

export default function AdminCenter({ onNavigate }: AdminCenterProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const {
    comptes,
    demandesDirecteur,
    messages,
    signalements,
    communityPosts,
    communityFeatures,
    notifications,
    adminAuditLogs,
    approveDemandeDirecteur,
    deleteDemandeDirecteur,
    updateDirectorSubscription,
    logAdminAction,
    refreshAll,
  } = useDb();
  const isArabic = language === 'ar';
  const [view, setView] = useState<AdminView>('pilotage');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const directors = useMemo(
    () => comptes.filter(account => account.role === 'directeur').sort((a, b) => `${a.nomCreche || ''}${a.nom}`.localeCompare(`${b.nomCreche || ''}${b.nom}`)),
    [comptes],
  );
  const pendingRequests = useMemo(
    () => demandesDirecteur.filter(request => request.statut === 'en_attente').sort((a, b) => b.dateDemande.localeCompare(a.dateDemande)),
    [demandesDirecteur],
  );
  const expiringDirectors = useMemo(
    () => directors.filter(account => account.abonnementActif && (daysUntil(account.dateFinAbonnement) ?? 999) <= 7).sort((a, b) => (daysUntil(a.dateFinAbonnement) ?? 999) - (daysUntil(b.dateFinAbonnement) ?? 999)),
    [directors],
  );
  const suspendedDirectors = useMemo(() => directors.filter(account => !account.abonnementActif), [directors]);
  const unreadSupport = useMemo(() => messages.filter(message => message.recipientId === 'admin' && !message.isRead).length, [messages]);
  const newTickets = useMemo(() => signalements.filter(item => item.statut === 'nouveau').length, [signalements]);
  const reportedPosts = useMemo(() => communityFeatures.filter(feature => feature.kind === 'report').length, [communityFeatures]);
  const hiddenPosts = useMemo(() => communityPosts.filter(post => post.statut === 'masquee').length, [communityPosts]);
  const incompleteDirectors = useMemo(
    () => directors.filter(account => !account.nomCreche?.trim() || !account.telephone?.trim() || !account.dateFinAbonnement || account.approvalStatus === 'pending'),
    [directors],
  );
  const inactiveDirectors = useMemo(() => directors.filter(account => isStale(account.lastActivityAt)), [directors]);
  const trialExtensionDate = dateKey(addDays(new Date(), 15));

  const text = (fr: string, ar: string) => isArabic ? ar : fr;
  const accountLabel = (account: UserAccount) => account.nomCreche || `${account.prenom} ${account.nom}`.trim();
  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
    : '—';
  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

  const run = async (key: string, operation: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(key);
    try {
      await operation();
    } catch (error) {
      console.error('Centre Administrateur :', error);
      showToast(error instanceof Error ? error.message : text('Action impossible. Réessayez.', 'تعذر تنفيذ الإجراء. أعيدوا المحاولة.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const approveRequest = async (request: DemandeDirecteur) => {
    const accepted = await confirm({
      title: text('Activer cette Directrice ?', 'تفعيل هذا الحساب؟'),
      message: text(
        `Le compte de ${request.prenom} ${request.nom} pour « ${request.nomCreche} » deviendra actif immédiatement.`,
        `سيتم تفعيل حساب ${request.prenom} ${request.nom} الخاص بـ « ${request.nomCreche} » فوراً.`,
      ),
      confirmLabel: text('Accepter et activer', 'قبول وتفعيل'),
    });
    if (!accepted) return;
    await run(`approve:${request.id}`, async () => {
      const accountId = await approveDemandeDirecteur(request.id);
      await logAdminAction('director_approved', 'director_request', request.id, request.nomCreche, { accountId });
      await refreshAll();
      showToast(text('Directrice activée.', 'تم تفعيل المديرة.'), 'success');
    });
  };

  const rejectRequest = async (request: DemandeDirecteur) => {
    const accepted = await confirm({
      title: text('Refuser la demande ?', 'رفض الطلب؟'),
      message: text(
        `La demande de ${request.prenom} ${request.nom} sera supprimée. Cette action est irréversible.`,
        `سيتم حذف طلب ${request.prenom} ${request.nom} نهائياً. لا يمكن التراجع عن هذا الإجراء.`,
      ),
      confirmLabel: text('Refuser la demande', 'رفض الطلب'),
      variant: 'danger',
    });
    if (!accepted) return;
    await run(`reject:${request.id}`, async () => {
      await deleteDemandeDirecteur(request.id);
      await logAdminAction('director_request_rejected', 'director_request', request.id, request.nomCreche);
      await refreshAll();
      showToast(text('Demande refusée.', 'تم رفض الطلب.'), 'success');
    });
  };

  const toggleSubscription = async (account: UserAccount) => {
    const nextActive = !account.abonnementActif;
    const accepted = await confirm({
      title: nextActive ? text('Réactiver l’abonnement ?', 'إعادة تفعيل الاشتراك؟') : text('Suspendre l’abonnement ?', 'تعليق الاشتراك؟'),
      message: nextActive
        ? text(`${accountLabel(account)} retrouvera son accès à Rawdha+.`, `سيستعيد ${accountLabel(account)} الوصول إلى Rawdha+.`)
        : text(`${accountLabel(account)} ne pourra plus accéder à Rawdha+ jusqu’à réactivation.`, `لن يتمكن ${accountLabel(account)} من الوصول إلى Rawdha+ حتى إعادة التفعيل.`),
      confirmLabel: nextActive ? text('Réactiver', 'إعادة التفعيل') : text('Suspendre', 'تعليق'),
      variant: nextActive ? 'default' : 'danger',
    });
    if (!accepted) return;
    await run(`subscription:${account.id}`, async () => {
      await updateDirectorSubscription(account.id, { abonnementActif: nextActive }, nextActive ? 'subscription_reactivated' : 'subscription_suspended');
      showToast(nextActive ? text('Abonnement réactivé.', 'تمت إعادة تفعيل الاشتراك.') : text('Abonnement suspendu.', 'تم تعليق الاشتراك.'), 'success');
    });
  };

  const extendTrial = async (account: UserAccount) => {
    const accepted = await confirm({
      title: text('Prolonger l’essai de 15 jours ?', 'تمديد التجربة 15 يوماً؟'),
      message: text(
        `L’accès de ${accountLabel(account)} restera actif jusqu’au ${formatDate(trialExtensionDate)}.`,
        `سيبقى وصول ${accountLabel(account)} نشطاً حتى ${formatDate(trialExtensionDate)}.`,
      ),
      confirmLabel: text('Prolonger l’essai', 'تمديد التجربة'),
    });
    if (!accepted) return;
    await run(`trial:${account.id}`, async () => {
      await updateDirectorSubscription(account.id, { abonnementActif: true, dateFinAbonnement: trialExtensionDate }, 'trial_extended');
      showToast(text('Essai prolongé de 15 jours.', 'تم تمديد التجربة لمدة 15 يوماً.'), 'success');
    });
  };

  if (user?.role !== 'admin') return null;

  const tabs: Array<{ id: AdminView; label: string; icon: typeof Sparkles; badge?: number }> = [
    { id: 'pilotage', label: text('Pilotage', 'القيادة'), icon: Sparkles },
    { id: 'creches', label: text('Crèches', 'الروضات'), icon: Building2, badge: directors.length },
    { id: 'validations', label: text('Validations', 'الموافقات'), icon: UserCheck, badge: pendingRequests.length },
    { id: 'qualite', label: text('Qualité', 'الجودة'), icon: ClipboardCheck, badge: incompleteDirectors.length + inactiveDirectors.length },
    { id: 'historique', label: text('Historique', 'السجل'), icon: History },
  ];

  const metricCards = [
    { label: text('Crèches actives', 'الروضات النشطة'), value: directors.filter(account => account.abonnementActif).length, detail: `${directors.length} ${text('au total', 'إجمالاً')}`, icon: Building2, tone: 'indigo' },
    { label: text('Demandes à traiter', 'طلبات للمعالجة'), value: pendingRequests.length, detail: text('Validation Directeur', 'موافقة المديرة'), icon: UserRoundPlus, tone: 'amber' },
    { label: text('Échéances sous 7 jours', 'اشتراكات تنتهي خلال 7 أيام'), value: expiringDirectors.length, detail: text('À relancer ou prolonger', 'تحتاج متابعة أو تمديد'), icon: CalendarClock, tone: 'rose' },
    { label: text('Support à suivre', 'طلبات الدعم'), value: unreadSupport + newTickets, detail: `${unreadSupport} ${text('messages', 'رسائل')} · ${newTickets} ${text('retours', 'ملاحظات')}`, icon: Headset, tone: 'emerald' },
  ];

  const renderPriority = (icon: ReactNode, title: string, description: string, count: number, actionLabel: string, action: () => void, tone: 'indigo' | 'amber' | 'rose' | 'emerald' = 'indigo') => {
    const palette = {
      indigo: 'border-indigo-100 bg-indigo-50/70 text-indigo-700',
      amber: 'border-amber-100 bg-amber-50/70 text-amber-700',
      rose: 'border-rose-100 bg-rose-50/70 text-rose-700',
      emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    }[tone];
    return <button type="button" onClick={action} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition hover:shadow-sm ${palette}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-900">{title}</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{description}</span></span>
      <span className="inline-flex items-center gap-1 text-xs font-black">{count}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" /></span>
    </button>;
  };

  const filteredDirectors = directors.filter(account => {
    const term = search.trim().toLocaleLowerCase();
    return !term || [account.nomCreche, account.prenom, account.nom, account.email, account.ville].filter(Boolean).join(' ').toLocaleLowerCase().includes(term);
  });

  return (
    <div className="min-w-0 space-y-5 sm:space-y-7" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-bl from-indigo-50 via-violet-50/60 to-transparent rtl:left-0 rtl:right-auto" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600"><ShieldCheck className="h-4 w-4" />{text('Rawdha+ plateforme', 'منصة Rawdha+')}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{text('Centre Administrateur', 'مركز الإدارة')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{text('Pilotez les crèches, les accès, les échéances et la qualité de service depuis un seul espace.', 'تابعوا الروضات والحسابات والاشتراكات وجودة الخدمة من مساحة واحدة.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('notifications')} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-xs font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50"><BellRing className="h-4 w-4" />{text('Nouvelle annonce', 'إعلان جديد')}</button>
            <button type="button" onClick={() => onNavigate('comptes')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"><UsersRound className="h-4 w-4" />{text('Gestion complète', 'إدارة الحسابات')}</button>
          </div>
        </div>
      </header>

      <nav className="mobile-scroll-x rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs" aria-label={text('Navigation du centre administrateur', 'تنقل مركز الإدارة')}>
        <div className="flex min-w-max gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return <button key={tab.id} type="button" onClick={() => setView(tab.id)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-black transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{tab.label}{tab.badge !== undefined && <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.badge}</span>}</button>;
          })}
        </div>
      </nav>

      {view === 'pilotage' && <>
        <section className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          {metricCards.map(card => {
            const Icon = card.icon;
            const tones = { indigo: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600' };
            return <article key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs"><div className="flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[card.tone as keyof typeof tones]}`}><Icon className="h-5 w-5" /></span><span className="text-2xl font-black tracking-tight text-slate-950">{card.value}</span></div><p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">{card.label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{card.detail}</p></article>;
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,.82fr)]">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{text('Priorités du jour', 'أولويات اليوم')}</h2><p className="mt-1 text-xs text-slate-500">{text('Ouvrez chaque file pour agir directement.', 'افتحوا كل قائمة للتصرف مباشرة.')}</p></div><AlertTriangle className="h-5 w-5 text-amber-500" /></div><div className="mt-4 space-y-2.5">
            {renderPriority(<UserRoundPlus className="h-5 w-5" />, text('Demandes Directeur', 'طلبات المديرات'), text('Comptes en attente de validation', 'حسابات بانتظار الموافقة'), pendingRequests.length, text('Examiner', 'مراجعة'), () => setView('validations'), 'amber')}
            {renderPriority(<CalendarClock className="h-5 w-5" />, text('Abonnements proches', 'اشتراكات قريبة الانتهاء'), text('Échéance dans les 7 prochains jours', 'تنتهي خلال الأيام السبعة القادمة'), expiringDirectors.length, text('Gérer', 'إدارة'), () => setView('creches'), 'rose')}
            {renderPriority(<Headset className="h-5 w-5" />, text('Support et retours', 'الدعم والملاحظات'), text('Messages non lus et tickets nouveaux', 'رسائل غير مقروءة وطلبات جديدة'), unreadSupport + newTickets, text('Ouvrir', 'فتح'), () => onNavigate('communication'), 'emerald')}
            {renderPriority(<Network className="h-5 w-5" />, text('Modération Connect', 'إدارة Rawdha Connect'), `${reportedPosts} ${text('signalement(s)', 'بلاغ')} · ${hiddenPosts} ${text('contenu(s) masqué(s)', 'محتوى مخفي')}`, reportedPosts + hiddenPosts, text('Modérer', 'إدارة'), () => onNavigate('community'), 'indigo')}
          </div></div>
          <div className="rounded-3xl border border-slate-100 bg-slate-950 p-5 text-white shadow-lg shadow-slate-900/10"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">{text('État de la plateforme', 'حالة المنصة')}</p><h2 className="mt-2 text-xl font-black">{text('Gardez une vue nette, sans multiplier les écrans.', 'تابعوا المنصة بوضوح دون التنقل بين شاشات كثيرة.')}</h2><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3"><span className="text-xs font-bold text-slate-200">{text('Directrices inactives 14j+', 'مديرات غير نشطات 14+ يوماً')}</span><span className="text-lg font-black">{inactiveDirectors.length}</span></div><div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3"><span className="text-xs font-bold text-slate-200">{text('Profils à compléter', 'ملفات تحتاج إكمالاً')}</span><span className="text-lg font-black">{incompleteDirectors.length}</span></div><div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-3"><span className="text-xs font-bold text-slate-200">{text('Abonnements suspendus', 'اشتراكات معلقة')}</span><span className="text-lg font-black">{suspendedDirectors.length}</span></div></div><button type="button" onClick={() => setView('qualite')} className="mt-5 inline-flex items-center gap-2 text-xs font-black text-white underline decoration-indigo-300 underline-offset-4">{text('Voir le contrôle qualité', 'عرض مراقبة الجودة')}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></button></div>
        </section>
      </>}

      {view === 'creches' && <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black text-slate-950">{text('Toutes les crèches', 'كل الروضات')}</h2><p className="mt-1 text-sm text-slate-500">{text('Suivez les abonnements, l’activité et les prolongations depuis une seule liste.', 'تابعوا الاشتراكات والنشاط والتمديدات من قائمة واحدة.')}</p></div><label className="relative block w-full sm:w-80"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Rechercher une crèche...', 'البحث عن روضة...')} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-xs font-semibold outline-none transition focus:border-indigo-500" /></label></div><div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="mobile-scroll-x"><table className="min-w-[920px] w-full text-start"><thead><tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-5 py-4">{text('Crèche / Directrice', 'الروضة / المديرة')}</th><th className="px-5 py-4">{text('Statut', 'الحالة')}</th><th className="px-5 py-4">{text('Échéance', 'تاريخ الانتهاء')}</th><th className="px-5 py-4">{text('Activité', 'النشاط')}</th><th className="px-5 py-4 text-center">{text('Actions', 'إجراءات')}</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredDirectors.map(account => { const remaining = daysUntil(account.dateFinAbonnement); const isExpiring = account.abonnementActif && (remaining ?? 999) <= 7; const busy = busyId?.endsWith(account.id); return <tr key={account.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-black text-slate-900">{accountLabel(account)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{account.prenom} {account.nom} · {account.email}</p></td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${account.abonnementActif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{account.abonnementActif ? text('Actif', 'نشط') : text('Suspendu', 'معلق')}</span>{account.approvalStatus === 'pending' && <span className="ms-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{text('À valider', 'بانتظار الموافقة')}</span>}</td><td className="px-5 py-4"><p className={`text-xs font-black ${isExpiring ? 'text-rose-600' : 'text-slate-700'}`}>{formatDate(account.dateFinAbonnement)}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{remaining === null ? text('Non renseignée', 'غير محدد') : remaining < 0 ? text('Expiré', 'منتهي') : `${remaining} ${text('jour(s)', 'يوم')}`}</p></td><td className="px-5 py-4"><span className={`text-xs font-bold ${isStale(account.lastActivityAt) ? 'text-amber-700' : 'text-emerald-700'}`}>{isStale(account.lastActivityAt) ? text('À relancer', 'تحتاج متابعة') : text('Récente', 'حديثة')}</span><p className="mt-1 text-[10px] text-slate-400">{formatDateTime(account.lastActivityAt)}</p></td><td className="px-5 py-4"><div className="flex justify-center gap-1.5"><button type="button" disabled={Boolean(busy)} onClick={() => void extendTrial(account)} title={text('Prolonger l’essai de 15 jours', 'تمديد التجربة 15 يوماً')} className="rounded-xl border border-indigo-200 p-2 text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"><CalendarClock className="h-4 w-4" /></button><button type="button" disabled={Boolean(busy)} onClick={() => void toggleSubscription(account)} title={account.abonnementActif ? text('Suspendre', 'تعليق') : text('Réactiver', 'إعادة تفعيل')} className={`rounded-xl border p-2 transition disabled:opacity-50 ${account.abonnementActif ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>{account.abonnementActif ? <CirclePause className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}</button></div></td></tr>; })}{filteredDirectors.length === 0 && <tr><td colSpan={5} className="px-5 py-14 text-center text-sm font-bold text-slate-400">{text('Aucune crèche trouvée.', 'لم يتم العثور على روضة.')}</td></tr>}</tbody></table></div></div></section>}

      {view === 'validations' && <section className="space-y-4"><div><h2 className="text-xl font-black text-slate-950">{text('Validation des Directrices', 'موافقة المديرات')}</h2><p className="mt-1 text-sm text-slate-500">{text('Contrôlez les informations reçues, puis activez ou refusez chaque accès.', 'راجعوا المعلومات ثم فعّلوا أو ارفضوا كل طلب.')}</p></div><div className="space-y-3">{pendingRequests.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 font-black text-slate-700">{text('Aucune demande en attente.', 'لا توجد طلبات معلقة.')}</p></div> : pendingRequests.map(request => <article key={request.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-900">{request.nomCreche}</h3><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">{text('À examiner', 'قيد المراجعة')}</span></div><p className="mt-2 text-sm font-bold text-slate-700">{request.prenom} {request.nom} · {request.email}</p><p className="mt-1 text-xs text-slate-500">{request.telephone} · {request.adresse} · {formatDateTime(request.dateDemande)}</p>{request.message && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs italic leading-5 text-slate-600">“{request.message}”</p>}</div><div className="flex shrink-0 flex-col gap-2 sm:flex-row"><button type="button" disabled={busyId === `reject:${request.id}`} onClick={() => void rejectRequest(request)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"><XCircle className="h-4 w-4" />{text('Refuser', 'رفض')}</button><button type="button" disabled={busyId === `approve:${request.id}`} onClick={() => void approveRequest(request)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700 disabled:opacity-50"><UserCheck className="h-4 w-4" />{text('Accepter et activer', 'قبول وتفعيل')}</button></div></div></article>)}</div></section>}

      {view === 'qualite' && <section className="grid gap-5 xl:grid-cols-2"><article className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{text('Profils à compléter', 'ملفات تحتاج إكمالاً')}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{text('Nom de crèche, téléphone, échéance ou validation manquante.', 'اسم الروضة أو الهاتف أو تاريخ الانتهاء أو الموافقة غير مكتملة.')}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><ClipboardCheck className="h-5 w-5" /></span></div><div className="mt-4 space-y-2">{incompleteDirectors.slice(0, 8).map(account => <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/70 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{accountLabel(account)}</p><p className="mt-0.5 text-[10px] font-semibold text-amber-800">{[!account.nomCreche && text('nom', 'الاسم'), !account.telephone && text('téléphone', 'الهاتف'), !account.dateFinAbonnement && text('échéance', 'الانتهاء'), account.approvalStatus === 'pending' && text('validation', 'الموافقة')].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={() => onNavigate('comptes')} className="rounded-lg bg-white p-2 text-amber-700 shadow-sm"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button></div>)}{incompleteDirectors.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{text('Tous les profils sont prêts.', 'كل الملفات مكتملة.')}</p>}</div></article><article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{text('Crèches à relancer', 'روضات تحتاج متابعة')}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{text('Aucune activité enregistrée depuis au moins 14 jours.', 'لا يوجد نشاط مسجل منذ 14 يوماً على الأقل.')}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Clock3 className="h-5 w-5" /></span></div><div className="mt-4 space-y-2">{inactiveDirectors.slice(0, 8).map(account => <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{accountLabel(account)}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{text('Dernière activité :', 'آخر نشاط:')} {formatDateTime(account.lastActivityAt)}</p></div><button type="button" onClick={() => onNavigate('notifications')} className="rounded-lg bg-white p-2 text-indigo-700 shadow-sm" title={text('Envoyer une annonce', 'إرسال إعلان')}><MessageSquareText className="h-4 w-4" /></button></div>)}{inactiveDirectors.length === 0 && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{text('Aucune relance prioritaire.', 'لا توجد متابعة أولوية.')}</p>}</div></article></section>}

      {view === 'historique' && <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black text-slate-950">{text('Historique Administrateur', 'سجل الإدارة')}</h2><p className="mt-1 text-sm text-slate-500">{text('Les actions sensibles de ce centre sont conservées pour le suivi interne.', 'يتم حفظ الإجراءات الحساسة في هذا المركز للمتابعة الداخلية.')}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{adminAuditLogs.length} {text('action(s)', 'إجراء')}</span></div><div className="mt-5 space-y-2">{adminAuditLogs.slice(0, 30).map(entry => <article key={entry.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-xs"><History className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800">{entry.targetLabel || entry.targetId}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{entry.action.replaceAll('_', ' ')} · {formatDateTime(entry.createdAt)}</p></div></article>)}{adminAuditLogs.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-14 text-center text-sm font-bold text-slate-400">{text('Les prochaines actions administratives apparaîtront ici.', 'ستظهر الإجراءات الإدارية القادمة هنا.')}</div>}</div></section>}
    </div>
  );
}
