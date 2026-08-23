/** Style Rawdha+ Communications: poste de commande clair, ciblage lisible, prévisualisation fidèle, aucune diffusion automatique non confirmée. */
import { useMemo, useState } from 'react';
import { BellRing, CheckCheck, CircleAlert, Clock3, ExternalLink, Eye, Link2, Megaphone, MonitorSmartphone, Send, Sparkles, Target, Trash2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabase';
import type { AppNotification, UserAccount } from '../types';

type Audience = 'all' | 'trial' | 'expiring' | 'inactive' | 'suspended' | 'individual';

const themes = [
  { id: 'indigo', label: 'Indigo', bg: '#4338ca', text: '#ffffff', button: '#ffffff' },
  { id: 'emerald', label: 'Émeraude', bg: '#047857', text: '#ffffff', button: '#ffffff' },
  { id: 'amber', label: 'Ambre', bg: '#b45309', text: '#ffffff', button: '#ffffff' },
  { id: 'slate', label: 'Ardoise', bg: '#0f172a', text: '#ffffff', button: '#c7d2fe' },
  { id: 'paper', label: 'Papier', bg: '#ffffff', text: '#0f172a', button: '#4338ca' },
];

const symbols = ['●', '!', '✓', 'i', '+'];

const dateDaysFromNow = (value?: string) => {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.ceil((target - start.getTime()) / 86_400_000);
};

const isInactive = (value?: string) => !value || Date.now() - new Date(value).getTime() > 14 * 86_400_000;

export default function Notifications() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const { notifications, comptes, publishAdminNotification, deleteNotification, logAdminAction } = useDb();
  const isFrench = language !== 'ar';
  const t = (fr: string, ar: string) => isFrench ? fr : ar;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [themeId, setThemeId] = useState('indigo');
  const [symbol, setSymbol] = useState('●');
  const [audience, setAudience] = useState<Audience>('all');
  const [individualId, setIndividualId] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaType, setCtaType] = useState<'link' | 'page'>('page');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaPage, setCtaPage] = useState('paiements');
  const [priorityPopup, setPriorityPopup] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [repeatInterval, setRepeatInterval] = useState(60);
  const [sending, setSending] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const directeurs = useMemo(() => comptes.filter(account => account.role === 'directeur' && account.approvalStatus !== 'pending'), [comptes]);
  const audienceDirectors = useMemo(() => {
    if (audience === 'trial') return directeurs.filter(account => account.commercialStage === 'essai');
    if (audience === 'expiring') return directeurs.filter(account => account.abonnementActif && (dateDaysFromNow(account.dateFinAbonnement) ?? 999) <= 7);
    if (audience === 'inactive') return directeurs.filter(account => isInactive(account.lastActivityAt));
    if (audience === 'suspended') return directeurs.filter(account => !account.abonnementActif);
    if (audience === 'individual') return directeurs.filter(account => account.id === individualId);
    return directeurs;
  }, [audience, directeurs, individualId]);
  const currentTheme = themes.find(theme => theme.id === themeId) || themes[0];
  const mesAnnonces = useMemo(() => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [notifications]);
  const unreadTotal = useMemo(() => mesAnnonces.reduce((sum, item) => sum + Math.max(0, audienceForNotification(item, directeurs).length - (item.readBy || []).length), 0), [mesAnnonces, directeurs]);

  const audienceOptions: Array<{ id: Audience; label: string; description: string }> = [
    { id: 'all', label: t('Toutes les Directrices', 'كل المديرات'), description: t('Communication plateforme générale', 'تواصل عام للمنصة') },
    { id: 'trial', label: t('Essais actifs', 'تجارب نشطة'), description: t('Comptes en phase d’essai', 'حسابات في فترة التجربة') },
    { id: 'expiring', label: t('Échéances proches', 'اشتراكات قريبة'), description: t('Abonnement sous 7 jours', 'اشتراك خلال 7 أيام') },
    { id: 'inactive', label: t('Crèches inactives', 'روضات غير نشطة'), description: t('Aucune activité depuis 14 jours', 'لا نشاط منذ 14 يوماً') },
    { id: 'suspended', label: t('Comptes suspendus', 'حسابات معلقة'), description: t('Accès à réactiver ou suivre', 'وصول يحتاج تفعيل أو متابعة') },
    { id: 'individual', label: t('Une Directrice', 'مديرة واحدة'), description: t('Communication individuelle', 'تواصل فردي') },
  ];

  const audienceLabel = audienceOptions.find(option => option.id === audience)?.label || t('Audience ciblée', 'جمهور مستهدف');
  const selectedAudienceValid = audienceDirectors.length > 0;
  const selectedAudienceIds = audienceDirectors.map(account => account.id);

  const publish = async () => {
    if (sending || !title.trim() || !message.trim()) return;
    if (!selectedAudienceValid) {
      showToast(t('Aucune Directrice ne correspond à cette audience.', 'لا توجد مديرة مطابقة لهذا الجمهور.'), 'error');
      return;
    }
    if (ctaLabel.trim() && ctaType === 'link' && (!/^https?:\/\//i.test(ctaUrl.trim()))) {
      showToast(t('Le lien d’action doit commencer par https:// ou http://.', 'يجب أن يبدأ رابط الإجراء بـ https:// أو http://.'), 'error');
      return;
    }
    const accepted = await confirm({
      title: priorityPopup ? t('Publier une communication prioritaire ?', 'نشر تواصل ذي أولوية؟') : t('Publier cette communication ?', 'نشر هذا التواصل؟'),
      message: t(
        `« ${title.trim()} » sera publiée immédiatement auprès de ${audienceDirectors.length} Directrice(s) : ${audienceLabel}.`,
        `سيُنشر « ${title.trim()} » فوراً لدى ${audienceDirectors.length} مديرة: ${audienceLabel}.`,
      ),
      confirmLabel: t('Publier maintenant', 'النشر الآن'),
    });
    if (!accepted) return;

    setSending(true);
    setDeliveryStatus(null);
    try {
      const notification = await publishAdminNotification({
        title: title.trim(),
        message: message.trim(),
        bgColor: currentTheme.bg,
        textColor: currentTheme.text,
        buttonColor: currentTheme.button,
        icon: symbol,
        showAsPopup: priorityPopup,
        repeatCount: priorityPopup ? repeatCount : 0,
        repeatIntervalSeconds: priorityPopup ? repeatInterval : undefined,
        audienceLabel,
        ...(ctaLabel.trim() ? { ctaLabel: ctaLabel.trim(), ctaType, ...(ctaType === 'link' ? { ctaUrl: ctaUrl.trim() } : { ctaPage }) } : {}),
      }, selectedAudienceIds.length === directeurs.length ? undefined : selectedAudienceIds);

      const pushTarget = selectedAudienceIds.length === directeurs.length ? 'all_directeurs' : selectedAudienceIds.length === 1 ? selectedAudienceIds[0] : null;
      if (pushTarget) {
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
          body: { target: pushTarget, title: title.trim(), message: message.trim(), notificationId: notification.id, page: ctaLabel.trim() && ctaType === 'page' ? ctaPage : 'notifications', url: ctaLabel.trim() && ctaType === 'link' ? ctaUrl.trim() : '' },
        });
        setDeliveryStatus(error || !data?.attempted
          ? { tone: 'warning', text: t('Communication enregistrée. La notification Android n’a pas été envoyée sur cet envoi.', 'تم حفظ التواصل. لم يُرسل إشعار أندرويد لهذا الإرسال.') }
          : { tone: data.failed ? 'warning' : 'success', text: t(`Communication publiée. Android : ${data.delivered}/${data.attempted} appareil(s) livré(s).`, `تم نشر التواصل. أندرويد: تم التسليم إلى ${data.delivered} من ${data.attempted} جهاز.`) });
      } else {
        setDeliveryStatus({ tone: 'success', text: t('Communication segmentée publiée dans Rawdha+. Les envois Android restent disponibles pour une audience globale ou individuelle.', 'تم نشر التواصل الموجّه داخل Rawdha+. تبقى إشعارات أندرويد متاحة للجمهور العام أو للفرد فقط.') });
      }
      setTitle(''); setMessage(''); setCtaLabel(''); setCtaUrl(''); setPriorityPopup(false); setRepeatCount(0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Impossible de publier la communication.', 'تعذر نشر التواصل.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const remove = async (notification: AppNotification) => {
    const accepted = await confirm({ title: t('Retirer cette communication ?', 'حذف هذا التواصل؟'), message: t('Elle ne sera plus visible dans Rawdha+. Cette suppression est irréversible.', 'لن يعود هذا التواصل مرئياً في Rawdha+. لا يمكن التراجع عن الحذف.'), confirmLabel: t('Retirer', 'حذف'), variant: 'danger' });
    if (!accepted) return;
    try {
      await deleteNotification(notification.id);
      await logAdminAction('notification_deleted' as never, 'notification', notification.id, notification.title);
      showToast(t('Communication retirée.', 'تم حذف التواصل.'), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('Impossible de retirer la communication.', 'تعذر حذف التواصل.'), 'error');
    }
  };

  if (user?.role !== 'admin') return null;

  return <div className="min-w-0 space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
    <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-bl from-indigo-100/70 via-violet-50 to-transparent rtl:left-0 rtl:right-auto" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600"><Megaphone className="h-4 w-4" />{t('Communication plateforme', 'تواصل المنصة')}</p><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{t('Centre de communication', 'مركز التواصل')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('Créez des annonces ciblées, prioritaires ou individuelles avec une trace claire de leur lecture.', 'أنشئوا إعلانات موجهة أو ذات أولوية أو فردية مع متابعة واضحة للقراءة.')}</p></div><div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{t('Directrices ciblables', 'مديرات مستهدفات')}</p><p className="mt-1 text-xl font-black text-slate-900">{directeurs.length}</p></div><div className="rounded-2xl border border-amber-100 bg-white/90 px-4 py-3 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{t('Lectures en attente', 'قراءات قيد الانتظار')}</p><p className="mt-1 text-xl font-black text-amber-700">{unreadTotal}</p></div></div></div></header>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(21rem,.8fr)]"><section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{t('Nouvelle communication', 'تواصل جديد')}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t('La publication reste une décision manuelle, confirmée avant diffusion.', 'يبقى النشر قراراً يدوياً مع تأكيد قبل التوزيع.')}</p></div><Target className="h-5 w-5 text-indigo-600" /></div>
      <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t('Audience', 'الجمهور')}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{audienceOptions.map(option => <button key={option.id} type="button" onClick={() => setAudience(option.id)} className={`rounded-2xl border p-3 text-start transition ${audience === option.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}><span className="block text-xs font-black text-slate-900">{option.label}</span><span className="mt-1 block text-[11px] text-slate-500">{option.description}</span></button>)}</div>{audience === 'individual' && <label className="mt-3 block text-xs font-black text-slate-600">{t('Directrice', 'المديرة')}<select value={individualId} onChange={event => setIndividualId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"><option value="">{t('Sélectionner une Directrice', 'اختيار مديرة')}</option>{directeurs.map(account => <option key={account.id} value={account.id}>{account.nomCreche || `${account.prenom} ${account.nom}`}</option>)}</select></label>}<div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 ${selectedAudienceValid ? 'bg-indigo-50 text-indigo-800' : 'bg-rose-50 text-rose-700'}`}><span className="text-xs font-black">{audienceLabel}</span><span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black">{audienceDirectors.length} {t('destinataire(s)', 'مستلم')}</span></div></div>
      <div className="mt-5 grid gap-3"><label className="text-xs font-black text-slate-600">{t('Titre', 'العنوان')}<input value={title} onChange={event => setTitle(event.target.value.slice(0, 140))} placeholder={t('Ex. Mise à jour importante de Rawdha+', 'مثال: تحديث مهم في Rawdha+')} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600">{t('Message', 'الرسالة')}<textarea value={message} onChange={event => setMessage(event.target.value.slice(0, 3000))} rows={5} placeholder={t('Rédigez une information claire, utile et actionnable...', 'اكتبوا معلومة واضحة ومفيدة وقابلة للتنفيذ...')} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" /></label></div>
      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-600" /><h3 className="text-xs font-black text-slate-800">{t('Présentation et priorité', 'التقديم والأولوية')}</h3></div><div className="mt-3 flex flex-wrap gap-2">{themes.map(theme => <button key={theme.id} type="button" onClick={() => setThemeId(theme.id)} aria-label={theme.label} className={`h-9 w-9 rounded-full border-2 transition ${themeId === theme.id ? 'border-slate-950 scale-110' : 'border-white shadow-sm'}`} style={{ background: theme.bg }} />)}<div className="ms-2 flex items-center gap-1.5 border-s border-slate-200 ps-3">{symbols.map(value => <button key={value} type="button" onClick={() => setSymbol(value)} className={`grid h-9 w-9 place-items-center rounded-lg text-base font-black transition ${symbol === value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{value}</button>)}</div></div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-white p-3"><input type="checkbox" checked={priorityPopup} onChange={event => setPriorityPopup(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" /><span><span className="block text-xs font-black text-slate-900">{t('Afficher en annonce prioritaire', 'عرض كإعلان ذي أولوية')}</span><span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{t('La Directrice verra une carte prioritaire à l’ouverture. Utilisez cette option seulement pour une information importante.', 'سترى المديرة بطاقة ذات أولوية عند الفتح. استخدموا هذا الخيار للمعلومات المهمة فقط.')}</span></span></label>{priorityPopup && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-black text-slate-600">{t('Rappels supplémentaires', 'تكرارات إضافية')}<input type="number" min="0" max="3" value={repeatCount} onChange={event => setRepeatCount(Math.max(0, Math.min(3, Number(event.target.value) || 0)))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600">{t('Intervalle (secondes)', 'الفاصل (ثوانٍ)')}<input type="number" min="30" max="3600" value={repeatInterval} onChange={event => setRepeatInterval(Math.max(30, Math.min(3600, Number(event.target.value) || 60)))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></label></div>}</div>
      <div className="mt-5 rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-indigo-600" /><h3 className="text-xs font-black text-slate-800">{t('Action optionnelle', 'إجراء اختياري')}</h3></div><input value={ctaLabel} onChange={event => setCtaLabel(event.target.value.slice(0, 50))} placeholder={t('Ex. Voir mes factures', 'مثال: عرض فواتيري')} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500" />{ctaLabel.trim() && <div className="mt-3 grid gap-3 sm:grid-cols-2"><select value={ctaType} onChange={event => setCtaType(event.target.value as 'link' | 'page')} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"><option value="page">{t('Page Rawdha+', 'صفحة Rawdha+')}</option><option value="link">{t('Lien externe', 'رابط خارجي')}</option></select>{ctaType === 'link' ? <input value={ctaUrl} onChange={event => setCtaUrl(event.target.value)} placeholder="https://..." className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /> : <select value={ctaPage} onChange={event => setCtaPage(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-500"><option value="paiements">{t('Paiements', 'المدفوعات')}</option><option value="achats">{t('Achats', 'المشتريات')}</option><option value="enfants">{t('Enfants', 'الأطفال')}</option><option value="parametres">{t('Paramètres', 'الإعدادات')}</option></select>}</div>}</div>
      <button type="button" disabled={sending || !title.trim() || !message.trim() || !selectedAudienceValid} onClick={() => void publish()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Send className="h-4 w-4" />{sending ? t('Publication...', 'جارٍ النشر...') : t(`Publier pour ${audienceDirectors.length} Directrice(s)`, `النشر إلى ${audienceDirectors.length} مديرة`)}</button>{deliveryStatus && <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${deliveryStatus.tone === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}><CheckCheck className="mt-0.5 h-4 w-4 shrink-0" />{deliveryStatus.text}</p>}</section>

      <aside className="space-y-5"><section className="sticky top-4 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Eye className="h-4 w-4 text-indigo-600" /><h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">{t('Aperçu Directrice', 'معاينة المديرة')}</h2></div><div className="bg-slate-100 p-5 sm:p-7"><div className="mx-auto max-w-sm rounded-3xl p-5 text-center shadow-2xl" style={{ backgroundColor: currentTheme.bg, color: currentTheme.text }}><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-xl font-black">{symbol}</div><p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{priorityPopup ? t('Information prioritaire', 'معلومة ذات أولوية') : t('Annonce Rawdha+', 'إعلان Rawdha+')}</p><h3 className="mt-2 text-lg font-black">{title || t('Titre de votre communication', 'عنوان تواصلكم')}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6 opacity-90">{message || t('Votre message apparaîtra ici de façon claire et lisible.', 'ستظهر رسالتكم هنا بشكل واضح وسهل القراءة.')}</p>{ctaLabel.trim() && <button className="mt-5 w-full rounded-xl py-3 text-sm font-black" style={{ backgroundColor: currentTheme.button, color: currentTheme.bg }}>{ctaLabel}</button>}<button className="mt-3 w-full rounded-xl bg-white/15 py-3 text-sm font-black">{t('Compris', 'فهمت')}</button></div></div><div className="flex items-center gap-2 px-5 py-4 text-[11px] leading-5 text-slate-500"><MonitorSmartphone className="h-4 w-4 shrink-0 text-indigo-500" />{t('Les annonces segmentées restent visibles uniquement pour les Directrices ciblées.', 'تظل الإعلانات الموجّهة مرئية فقط للمديرات المستهدفات.')}</div></section></aside></div>

    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">{t('Historique des communications', 'سجل التواصل')}</h2><p className="mt-1 text-xs text-slate-500">{t('Audience, lecture et actions restent visibles pour le pilotage.', 'يبقى الجمهور والقراءة والإجراءات ظاهرة للمتابعة.')}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{mesAnnonces.length} {t('publication(s)', 'منشور')}</span></div>{mesAnnonces.length === 0 ? <div className="px-5 py-16 text-center"><BellRing className="mx-auto h-10 w-10 text-slate-200" /><p className="mt-3 text-sm font-bold text-slate-400">{t('Aucune communication publiée pour le moment.', 'لا يوجد تواصل منشور حتى الآن.')}</p></div> : <div className="divide-y divide-slate-100">{mesAnnonces.map(notification => { const targets = audienceForNotification(notification, directeurs); const readCount = targets.filter(account => notification.readBy?.includes(account.id)).length; return <article key={notification.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black" style={{ backgroundColor: notification.bgColor || '#4338ca', color: notification.textColor || '#fff' }}>{notification.icon || '●'}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-900">{notification.title}</h3>{notification.showAsPopup && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">{t('Prioritaire', 'أولوية')}</span>}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{notification.message}</p><div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-400"><span className="inline-flex items-center gap-1"><Target className="h-3 w-3" />{notification.audienceLabel || (notification.recipientRole === 'all_directeurs' ? t('Toutes les Directrices', 'كل المديرات') : t('Audience ciblée', 'جمهور مستهدف'))} · {targets.length}</span><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{readCount}/{targets.length} {t('lu', 'قرأت')}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(notification.createdAt).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ')}</span></div></div></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => void remove(notification)} className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50" title={t('Retirer la communication', 'حذف التواصل')}><Trash2 className="h-4 w-4" /></button></div></article>; })}</div>}</section>
  </div>;
}

function audienceForNotification(notification: AppNotification, directors: UserAccount[]) {
  if (notification.recipientRole === 'all_directeurs') return directors;
  if (notification.recipientIds?.length) return directors.filter(account => notification.recipientIds?.includes(account.id));
  return directors.filter(account => account.id === notification.recipientRole);
}
