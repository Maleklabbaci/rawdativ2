/** Style Rawdha+ Ops: fiche dense mais respirante, lecture immédiate des signaux, actions commerciales manuelles et confirmées. */
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, Copy, FileText, MessageCircle, PhoneCall, Send, UsersRound, X } from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useToast } from '../contexts/ToastContext';
import type { AdminFollowupChannel, AdminFollowupStatus, CommercialStage, UserAccount } from '../types';

type AdminCrecheDetailProps = {
  account: UserAccount;
  onClose: () => void;
  onNavigate: (page: string) => void;
};

const stageTone: Record<CommercialStage, string> = {
  nouveau: 'bg-slate-100 text-slate-700',
  essai: 'bg-indigo-50 text-indigo-700',
  relance: 'bg-amber-50 text-amber-700',
  interesse: 'bg-violet-50 text-violet-700',
  abonne: 'bg-emerald-50 text-emerald-700',
  suspendu: 'bg-rose-50 text-rose-700',
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

export default function AdminCrecheDetail({ account, onClose, onNavigate }: AdminCrecheDetailProps) {
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const {
    enfants,
    classes,
    personnel,
    presences,
    paiements,
    achats,
    messages,
    signalements,
    adminFollowups,
    updateDirectorOperations,
    createAdminFollowup,
  } = useDb();
  const isArabic = language === 'ar';
  const [stage, setStage] = useState<CommercialStage>(account.commercialStage || (account.abonnementActif ? 'abonne' : 'nouveau'));
  const [nextFollowUpAt, setNextFollowUpAt] = useState(account.nextFollowUpAt || '');
  const [commercialNote, setCommercialNote] = useState(account.commercialNote || '');
  const [followupChannel, setFollowupChannel] = useState<AdminFollowupChannel>('appel_manuel');
  const [followupStatus, setFollowupStatus] = useState<AdminFollowupStatus>('planned');
  const [followupDueAt, setFollowupDueAt] = useState(account.nextFollowUpAt || '');
  const [followupNote, setFollowupNote] = useState('');
  const [saving, setSaving] = useState(false);
  const t = (fr: string, ar: string) => isArabic ? ar : fr;

  useEffect(() => {
    setStage(account.commercialStage || (account.abonnementActif ? 'abonne' : 'nouveau'));
    setNextFollowUpAt(account.nextFollowUpAt || '');
    setCommercialNote(account.commercialNote || '');
    setFollowupDueAt(account.nextFollowUpAt || '');
    setFollowupNote('');
  }, [account.id, account.commercialStage, account.abonnementActif, account.nextFollowUpAt, account.commercialNote]);

  const childRows = useMemo(() => enfants.filter(child => child.crecheId === account.id), [enfants, account.id]);
  const childIds = useMemo(() => new Set(childRows.map(child => child.id)), [childRows]);
  const todayKey = toDateKey(new Date());
  const attendanceToday = useMemo(() => presences.filter(item => childIds.has(item.enfantId) && item.date === todayKey && item.statut === 'Présent').length, [presences, childIds, todayKey]);
  const invoicesOpen = useMemo(() => paiements.filter(item => childIds.has(item.enfantId) && item.statut !== 'Payé'), [paiements, childIds]);
  const purchases = useMemo(() => achats.filter(item => item.crecheId === account.id), [achats, account.id]);
  const teamCount = useMemo(() => personnel.filter(item => item.crecheId === account.id && item.statut === 'Actif').length, [personnel, account.id]);
  const classCount = useMemo(() => classes.filter(item => item.crecheId === account.id).length, [classes, account.id]);
  const ticketRows = useMemo(() => signalements.filter(item => item.userId === account.id), [signalements, account.id]);
  const supportMessages = useMemo(() => messages.filter(item => item.parentId === account.id), [messages, account.id]);
  const followups = useMemo(() => adminFollowups.filter(item => item.targetAccountId === account.id), [adminFollowups, account.id]);
  const pendingFollowups = useMemo(() => followups.filter(item => item.status === 'planned'), [followups]);
  const purchaseTotal = useMemo(() => purchases.reduce((sum, item) => sum + Number(item.montant || 0), 0), [purchases]);
  const invoiceTotal = useMemo(() => invoicesOpen.reduce((sum, item) => sum + Number(item.montant || 0), 0), [invoicesOpen]);

  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';
  const formatDateTime = (value?: string) => value ? new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
  const stageLabel: Record<CommercialStage, string> = {
    nouveau: t('Nouveau', 'جديد'), essai: t('Essai actif', 'تجربة نشطة'), relance: t('À relancer', 'تحتاج متابعة'), interesse: t('Intéressé', 'مهتم'), abonne: t('Abonné', 'مشترك'), suspendu: t('Suspendu', 'معلق'),
  };
  const channels: Array<{ value: AdminFollowupChannel; label: string }> = [
    { value: 'appel_manuel', label: t('Appel manuel', 'مكالمة يدوية') },
    { value: 'whatsapp_manual', label: t('WhatsApp manuel', 'واتساب يدوي') },
    { value: 'notification_interne', label: t('Annonce interne', 'إعلان داخلي') },
    { value: 'email', label: t('E-mail', 'بريد إلكتروني') },
    { value: 'autre', label: t('Autre', 'أخرى') },
  ];

  const savePipeline = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateDirectorOperations(account.id, { commercialStage: stage, nextFollowUpAt: nextFollowUpAt || undefined, commercialNote: commercialNote.trim() || undefined }, 'commercial_stage_updated');
      showToast(t('Suivi commercial enregistré.', 'تم حفظ المتابعة التجارية.'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Impossible d’enregistrer le suivi.', 'تعذر حفظ المتابعة.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveFollowup = async () => {
    if (saving) return;
    if (followupStatus === 'planned' && !followupDueAt) {
      showToast(t('Choisissez une date de relance.', 'اختاروا تاريخ المتابعة.'), 'error');
      return;
    }
    const accepted = await confirm({
      title: followupStatus === 'done' ? t('Consigner cette relance ?', 'تسجيل هذه المتابعة؟') : t('Planifier cette relance ?', 'جدولة هذه المتابعة؟'),
      message: followupStatus === 'done'
        ? t('Cette relance sera ajoutée à l’historique interne, sans envoyer de message automatiquement.', 'ستضاف هذه المتابعة إلى السجل الداخلي دون إرسال رسالة تلقائياً.')
        : t('Le rappel sera visible dans le Centre Administrateur. Aucun message ne sera envoyé automatiquement.', 'سيظهر التذكير في مركز الإدارة. لن يتم إرسال أي رسالة تلقائياً.'),
      confirmLabel: followupStatus === 'done' ? t('Consigner', 'تسجيل') : t('Planifier', 'جدولة'),
    });
    if (!accepted) return;
    setSaving(true);
    try {
      await createAdminFollowup(account.id, followupChannel, followupNote, followupDueAt || undefined, followupStatus);
      const today = toDateKey(new Date());
      await updateDirectorOperations(
        account.id,
        followupStatus === 'done' ? { lastFollowUpAt: today, commercialStage: 'relance' } : { nextFollowUpAt: followupDueAt, commercialStage: 'relance' },
        followupStatus === 'done' ? 'followup_recorded' : 'followup_scheduled',
      );
      setFollowupNote('');
      showToast(followupStatus === 'done' ? t('Relance consignée.', 'تم تسجيل المتابعة.') : t('Relance planifiée.', 'تمت جدولة المتابعة.'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Impossible d’enregistrer la relance.', 'تعذر حفظ المتابعة.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const phoneDigits = (account.telephone || '').replace(/\D/g, '').replace(/^0/, '213');
  const whatsappText = encodeURIComponent(t(`Bonjour ${account.prenom || ''}, l’équipe Rawdha+ vous contacte au sujet de votre crèche ${account.nomCreche || ''}.`, `مرحباً ${account.prenom || ''}، يتواصل معك فريق Rawdha+ بخصوص روضتك ${account.nomCreche || ''}.`));
  const whatsappHref = phoneDigits ? `https://wa.me/${phoneDigits}?text=${whatsappText}` : '';

  const kpis = [
    { label: t('Enfants actifs', 'الأطفال النشطون'), value: childRows.filter(item => item.statut === 'Actif').length, icon: UsersRound, tone: 'indigo' },
    { label: t('Présents aujourd’hui', 'الحاضرون اليوم'), value: attendanceToday, icon: CheckCircle2, tone: 'emerald' },
    { label: t('Factures ouvertes', 'فواتير مفتوحة'), value: invoicesOpen.length, icon: FileText, tone: 'amber' },
    { label: t('Tickets à suivre', 'طلبات تحتاج متابعة'), value: ticketRows.filter(item => item.statut !== 'resolu' && item.statut !== 'rejete').length, icon: CircleAlert, tone: 'rose' },
  ];

  return (
    <section className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-lg shadow-indigo-950/5 sm:p-6" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">{t('Fiche crèche', 'ملف الروضة')}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${stageTone[stage]}`}>{stageLabel[stage]}</span></div><h2 className="mt-2 text-xl font-black text-slate-950">{account.nomCreche || `${account.prenom} ${account.nom}`}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{account.prenom} {account.nom} · {account.email} · {account.ville || t('Ville non renseignée', 'المدينة غير محددة')}</p></div><button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center self-end rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 lg:self-start" aria-label={t('Fermer la fiche', 'إغلاق الملف')}><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{kpis.map(item => { const Icon = item.icon; const tones = { indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }; return <div key={item.label} className="rounded-2xl border border-slate-100 p-3"><span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[item.tone as keyof typeof tones]}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-xl font-black text-slate-950">{item.value}</p><p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</p></div>; })}</div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-5"><section className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">{t('Pipeline commercial', 'المتابعة التجارية')}</h3><p className="mt-1 text-xs text-slate-500">{t('Le suivi reste interne à l’équipe Admin.', 'هذه المتابعة داخلية لفريق الإدارة فقط.')}</p></div><CalendarClock className="h-5 w-5 text-indigo-500" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">{t('Étape', 'المرحلة')}<select value={stage} onChange={event => setStage(event.target.value as CommercialStage)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500">{(['nouveau','essai','relance','interesse','abonne','suspendu'] as CommercialStage[]).map(value => <option key={value} value={value}>{stageLabel[value]}</option>)}</select></label><label className="text-xs font-black text-slate-600">{t('Prochaine relance', 'المتابعة القادمة')}<input type="date" value={nextFollowUpAt} onChange={event => setNextFollowUpAt(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></label></div><label className="mt-3 block text-xs font-black text-slate-600">{t('Note interne', 'ملاحظة داخلية')}<textarea value={commercialNote} onChange={event => setCommercialNote(event.target.value.slice(0, 1200))} rows={3} placeholder={t('Contexte commercial, besoin exprimé, prochaine étape...', 'سياق تجاري، حاجة معبر عنها، الخطوة التالية...')} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-indigo-500" /></label><button type="button" disabled={saving} onClick={() => void savePipeline()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{t('Enregistrer le suivi', 'حفظ المتابعة')}</button></section>

          <section className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">{t('Indicateurs de gestion', 'مؤشرات التسيير')}</h3><p className="mt-1 text-xs text-slate-500">{t('Vue réelle des données de la crèche.', 'نظرة حقيقية على بيانات الروضة.')}</p></div><FileText className="h-5 w-5 text-slate-400" /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">{t('Équipe active', 'الفريق النشط')}</p><p className="mt-1 font-black text-slate-900">{teamCount} {t('personne(s)', 'شخص')}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">{t('Classes', 'الأقسام')}</p><p className="mt-1 font-black text-slate-900">{classCount}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-700">{t('Factures à traiter', 'فواتير للمعالجة')}</p><p className="mt-1 font-black text-amber-900">{invoiceTotal.toLocaleString()} DA</p></div><div className="rounded-xl bg-indigo-50 p-3"><p className="text-[10px] font-black uppercase text-indigo-700">{t('Achats enregistrés', 'المشتريات المسجلة')}</p><p className="mt-1 font-black text-indigo-900">{purchaseTotal.toLocaleString()} DA</p></div></div></section></div>

        <div className="space-y-5"><section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{t('Relance manuelle', 'متابعة يدوية')}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{t('Aucun message n’est envoyé sans votre action.', 'لا تُرسل أي رسالة دون تدخلكم.')}</p></div><PhoneCall className="h-5 w-5 text-emerald-600" /></div><div className="mt-4 grid gap-3"><label className="text-xs font-black text-slate-600">{t('Canal', 'القناة')}<select value={followupChannel} onChange={event => setFollowupChannel(event.target.value as AdminFollowupChannel)} className="mt-1.5 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500">{channels.map(channel => <option key={channel.value} value={channel.value}>{channel.label}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-black text-slate-600">{t('Statut', 'الحالة')}<select value={followupStatus} onChange={event => setFollowupStatus(event.target.value as AdminFollowupStatus)} className="mt-1.5 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"><option value="planned">{t('À faire', 'مخططة')}</option><option value="done">{t('Effectuée', 'منجزة')}</option><option value="cancelled">{t('Annulée', 'ملغاة')}</option></select></label><label className="text-xs font-black text-slate-600">{t('Date', 'التاريخ')}<input type="date" value={followupDueAt} onChange={event => setFollowupDueAt(event.target.value)} className="mt-1.5 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500" /></label></div><textarea value={followupNote} onChange={event => setFollowupNote(event.target.value.slice(0, 1200))} rows={2} placeholder={t('Note de relance...', 'ملاحظة المتابعة...')} className="w-full resize-none rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></div><div className="mt-3 flex flex-wrap gap-2">{whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"><MessageCircle className="h-4 w-4" />{t('Préparer WhatsApp', 'تحضير واتساب')}</a> : <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-400"><MessageCircle className="h-4 w-4" />{t('Téléphone manquant', 'الهاتف غير موجود')}</span>}<button type="button" disabled={saving} onClick={() => void saveFollowup()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"><CalendarClock className="h-4 w-4" />{t('Enregistrer', 'حفظ')}</button></div></section>

          <section className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">{t('Suivi récent', 'المتابعة الأخيرة')}</h3><p className="mt-1 text-xs text-slate-500">{pendingFollowups.length} {t('relance(s) à faire', 'متابعة قيد التنفيذ')} · {ticketRows.length} {t('ticket(s)', 'طلب')}</p></div><button type="button" onClick={() => onNavigate('communication')} title={t('Ouvrir le support', 'فتح الدعم')} className="rounded-xl border border-slate-200 p-2 text-indigo-600 transition hover:bg-indigo-50"><Send className="h-4 w-4" /></button></div><div className="mt-4 space-y-2">{followups.slice(0, 3).map(item => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black text-slate-800">{channels.find(channel => channel.value === item.channel)?.label || item.channel}</p><span className="text-[10px] font-bold text-slate-400">{item.status === 'done' ? t('Effectuée', 'منجزة') : item.dueAt ? formatDate(item.dueAt) : t('Sans date', 'دون تاريخ')}</span></div>{item.note && <p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div>)}{followups.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs font-semibold text-slate-400">{t('Aucune relance enregistrée.', 'لا توجد متابعة مسجلة.')}</p>}<div className="grid grid-cols-2 gap-2 text-xs"><button type="button" onClick={() => onNavigate('communication')} className="rounded-xl border border-slate-200 px-3 py-2.5 font-black text-slate-600 transition hover:bg-slate-50">{supportMessages.length} {t('message(s)', 'رسالة')}</button><button type="button" onClick={() => onNavigate('notifications')} className="rounded-xl border border-indigo-200 px-3 py-2.5 font-black text-indigo-700 transition hover:bg-indigo-50">{t('Communication', 'التواصل')}<ArrowUpRight className="ms-1 inline h-3.5 w-3.5" /></button></div></div></section></div>
      </div>
    </section>
  );
}
