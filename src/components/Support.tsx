import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Flag, Headset, MessageSquare, Send, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { buildLegalHref } from '../config/legal';
import type { SignalementType } from '../types';

const feedbackTypes: SignalementType[] = ['bug', 'probleme', 'suggestion', 'amelioration'];

export default function Support() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { messages, avis, signalements, addMessage, addAvis, addSignalement } = useDb();
  const isFrench = language !== 'ar';
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [feedbackType, setFeedbackType] = useState<SignalementType>('probleme');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const pendingRef = useRef(new Set<string>());
  const [uncertain, setUncertain] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [confirmingAccountAction, setConfirmingAccountAction] = useState<'unsubscribe' | 'deletion' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sujet = new URLSearchParams(window.location.search).get('sujet');
    if (sujet === 'resiliation') {
      setMessage(current =>
        current ||
        (isFrench
          ? 'Bonjour, je souhaite demander le non-renouvellement / la résiliation de mon abonnement Rawdha+ à la fin de la période en cours.'
          : 'مرحباً، أرغب في طلب عدم تجديد / إلغاء اشتراكي في منصة Rawdha+ عند نهاية الفترة الحالية.')
      );
    } else if (sujet === 'suppression') {
      setMessage(current =>
        current ||
        (isFrench
          ? 'Bonjour, je souhaite exercer mon droit de suppression de mon compte et des données associées conformément à la Loi 18-07.'
          : 'مرحباً، أرغب في طلب حذف حسابي والبيانات المرتبطة به وفقاً للقانون 18-07.')
      );
    }
  }, [isFrench]);

  const ownMessages = useMemo(() => messages
    .filter(item => item.parentId === user?.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [messages, user?.id]);
  const ownReports = useMemo(() => signalements.filter(item => item.userId === user?.id).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [signalements, user?.id]);
  const ownReview = avis.find(item => item.userId === user?.id);

  const reportTypeLabel = (type: SignalementType) => {
    if (isFrench) return type === 'bug' ? 'Bug technique' : type === 'probleme' ? 'Problème' : type === 'suggestion' ? 'Suggestion' : 'Amélioration';
    return type === 'bug' ? 'خلل تقني' : type === 'probleme' ? 'مشكلة' : type === 'suggestion' ? 'اقتراح' : 'تحسين';
  };

  const reportStatusLabel = (value: string) => {
    if (isFrench) return value === 'resolu' ? 'Résolu' : value === 'en_cours' ? 'En cours' : 'Nouveau';
    return value === 'resolu' ? 'تم الحل' : value === 'en_cours' ? 'قيد المعالجة' : 'جديد';
  };

  const showStatus = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus(''), 3000);
  };

  const send = async (kind: string, action: () => Promise<unknown>, onSuccess: () => void, success: string) => {
    if (pendingRef.current.has(kind) || uncertain.includes(kind)) return;
    pendingRef.current.add(kind);
    setPending(items => [...items, kind]);
    setError('');
    setStatus('');
    try {
      await action();
      onSuccess();
      showStatus(success);
    } catch {
      setUncertain(items => [...items, kind]);
      setError(isFrench ? 'Envoi non confirmé. Vérifiez les historiques concernés avant une nouvelle tentative.' : 'لم يتأكد الإرسال. تحققوا من السجلات المعنية قبل المحاولة مجدداً.');
    } finally {
      pendingRef.current.delete(kind);
      setPending(items => items.filter(item => item !== kind));
    }
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!user || !message.trim()) return;
    void send('message', () => addMessage({ senderId: user.id, senderName: `${user.prenom} ${user.nom}`, recipientId: 'admin', parentId: user.id, text: message.trim(), timestamp: new Date().toISOString(), isRead: false }), () => setMessage(''), isFrench ? 'Message envoyé.' : 'تم إرسال الرسالة.');
  };

  const sendReview = (event: FormEvent) => {
    event.preventDefault();
    if (!user || !comment.trim() || ownReview) return;
    void send('review', () => addAvis({ userId: user.id, userName: `${user.prenom} ${user.nom}`, nomCreche: user.nomCreche || 'Rawdha+', rating, comment: comment.trim(), date: new Date().toISOString() }), () => setComment(''), isFrench ? 'Merci pour votre avis.' : 'شكراً على تقييمكم.');
  };

  const sendReport = (event: FormEvent) => {
    event.preventDefault();
    if (!user || !feedbackTitle.trim() || !feedbackDescription.trim()) return;
    void send('report', () => addSignalement({ userId: user.id, userName: `${user.prenom} ${user.nom}`, nomCreche: user.nomCreche || 'Rawdha+', type: feedbackType, titre: feedbackTitle.trim(), description: feedbackDescription.trim(), statut: 'nouveau', date: new Date().toISOString() }), () => { setFeedbackTitle(''); setFeedbackDescription(''); }, isFrench ? 'Votre retour a été envoyé.' : 'تم إرسال ملاحظتكم.');
  };

  const submitAccountComplianceAction = (kind: 'unsubscribe' | 'deletion') => {
    if (!user) return;
    const titre = kind === 'unsubscribe'
      ? (isFrench ? 'Demande de résiliation / non-renouvellement' : 'طلب إلغاء تجديد الاشتراك')
      : (isFrench ? 'Demande de suppression de compte et données' : 'طلب حذف الحساب والبيانات');
    const description = kind === 'unsubscribe'
      ? (isFrench
          ? `Demande officielle d’arrêt du renouvellement mensuel pour ${user.nomCreche || 'la crèche'} (${user.email || user.id}).`
          : `طلب رسمي لإيقاف التجديد الشهري لحساب ${user.nomCreche || 'الروضة'} (${user.email || user.id}).`)
      : (isFrench
          ? `Demande officielle de suppression du compte et des données (Loi 18-07) pour ${user.nomCreche || 'la crèche'} (${user.email || user.id}).`
          : `طلب رسمي لحذف الحساب والبيانات الشخصية (القانون 18-07) لحساب ${user.nomCreche || 'الروضة'} (${user.email || user.id}).`);

    void send(
      kind,
      () =>
        addSignalement({
          userId: user.id,
          userName: `${user.prenom} ${user.nom}`,
          nomCreche: user.nomCreche || 'Rawdha+',
          type: 'probleme',
          titre,
          description,
          statut: 'nouveau',
          date: new Date().toISOString(),
        }),
      () => setConfirmingAccountAction(null),
      kind === 'unsubscribe'
        ? (isFrench ? 'Votre demande de non-renouvellement a été enregistrée.' : 'تم تسجيل طلب عدم تجديد الاشتراك.')
        : (isFrench ? 'Votre demande de suppression de données a été enregistrée.' : 'تم تسجيل طلب حذف البيانات.')
    );
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600';

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isFrench ? 'Assistance' : 'المساعدة'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{isFrench ? 'Support et retours' : 'الدعم والملاحظات'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isFrench ? 'Écrivez à l’équipe, signalez un problème ou partagez votre expérience depuis cette page.' : 'تواصلوا مع الفريق أو أبلغوا عن مشكلة أو شاركوا تجربتكم من هذه الصفحة.'}</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button type="button" className="ms-2 underline" onClick={() => { setUncertain([]); setError(''); }}>{isFrench ? 'J’ai vérifié, autoriser une nouvelle tentative' : 'تحققت، السماح بمحاولة جديدة'}</button></div>}
      {status && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{status}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Headset className="h-5 w-5 text-indigo-600" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Écrire au support' : 'مراسلة الدعم'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Réponse depuis la plateforme.' : 'الرد من داخل المنصة.'}</p></div></div>
          <form onSubmit={sendMessage} className="mt-4 space-y-3">
            <label className={labelClass}>{isFrench ? 'Message à l’équipe Rawdha+' : 'رسالة إلى فريق روضتي+'}</label>
            <textarea className={inputClass} rows={5} value={message} onChange={event => setMessage(event.target.value)} placeholder={isFrench ? 'Décrivez votre demande avec le nom de l’écran concerné...' : 'اشرحوا طلبكم مع ذكر الصفحة المعنية...'} />
            <p className="text-xs text-slate-400">{isFrench ? 'Ajoutez le nom du module et les étapes suivies pour accélérer la réponse.' : 'أضيفوا اسم الوحدة والخطوات المتبعة لتسريع الرد.'}</p>
            <button type="submit" disabled={!message.trim() || pending.includes('message') || uncertain.includes('message')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isFrench ? 'Envoyer le message' : 'إرسال الرسالة'}</button>
          </form>
          {ownMessages.length > 0 && <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">{ownMessages.slice(-4).map(item => <div key={item.id} className={`rounded-lg px-3 py-2 text-sm ${item.senderId === user?.id ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-700'}`}><p>{item.text}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ')}</p></div>)}</div>}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Flag className="h-5 w-5 text-rose-600" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Signaler ou suggérer' : 'الإبلاغ أو الاقتراح'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Les retours sont suivis par l’équipe.' : 'يتابع الفريق ملاحظاتكم.'}</p></div></div>
          <form onSubmit={sendReport} className="mt-4 space-y-3">
            <div><label className={labelClass}>{isFrench ? 'Type' : 'النوع'}</label><select className={inputClass} value={feedbackType} onChange={event => setFeedbackType(event.target.value as SignalementType)}>{feedbackTypes.map(type => <option key={type} value={type}>{type === 'bug' ? (isFrench ? 'Bug technique' : 'خلل تقني') : type === 'probleme' ? (isFrench ? 'Problème' : 'مشكلة') : type === 'suggestion' ? (isFrench ? 'Suggestion' : 'اقتراح') : (isFrench ? 'Amélioration' : 'تحسين')}</option>)}</select></div>
            <div><label className={labelClass}>{isFrench ? 'Titre' : 'العنوان'}</label><input className={inputClass} value={feedbackTitle} onChange={event => setFeedbackTitle(event.target.value)} placeholder={isFrench ? 'Ex. : Le pointage ne s’enregistre pas' : 'مثال: لا يتم حفظ تسجيل الحضور'} /></div>
            <div><label className={labelClass}>{isFrench ? 'Description' : 'الوصف'}</label><textarea className={inputClass} rows={4} value={feedbackDescription} onChange={event => setFeedbackDescription(event.target.value)} placeholder={isFrench ? 'Décrivez ce que vous attendiez et ce qui s’est passé.' : 'اشرحوا ما كنتم تتوقعونه وما حدث فعلياً.'} /></div>
            <button type="submit" disabled={!feedbackTitle.trim() || !feedbackDescription.trim() || pending.includes('report') || uncertain.includes('report')} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isFrench ? 'Envoyer le retour' : 'إرسال الملاحظة'}</button>
          </form>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Star className="h-5 w-5 text-amber-500" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Donner votre avis' : 'شاركوا تقييمكم'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Un avis par compte.' : 'تقييم واحد لكل حساب.'}</p></div></div>
        {ownReview ? <p className="mt-4 text-sm text-slate-600">{isFrench ? 'Votre avis a déjà été enregistré. Merci.' : 'تم تسجيل تقييمكم، شكراً.'}</p> : <form onSubmit={sendReview} className="mt-4 space-y-3"><div className="flex gap-1">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} / 5`}><Star className={`h-7 w-7 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div><textarea className={inputClass} rows={3} value={comment} onChange={event => setComment(event.target.value)} placeholder={isFrench ? 'Votre commentaire...' : 'تعليقكم...'} /><button type="submit" disabled={!comment.trim() || pending.includes('review') || uncertain.includes('review')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><MessageSquare className="h-4 w-4" />{isFrench ? 'Enregistrer mon avis' : 'حفظ التقييم'}</button></form>}
        {ownReports.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500">{isFrench ? `${ownReports.length} retour(s) envoyé(s)` : `تم إرسال ${ownReports.length} ملاحظة`}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ownReports.slice(0, 6).map(report => (
                <div key={report.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800">{report.titre}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">{reportStatusLabel(report.statut)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{reportTypeLabel(report.type)} · {new Date(report.date).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
            <div>
              <h2 className="font-bold text-slate-900">
                {isFrench ? 'Abonnement, résiliation & données personnelles' : 'الاشتراك، إلغاء التجديد والبيانات الشخصية'}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-600">
                {isFrench
                  ? 'Arrêtez le renouvellement de votre abonnement sans pénalité ou demandez la suppression complète de vos données (Loi 18-07).'
                  : 'أوقفوا تجديد اشتراككم دون أي التزام أو اطلبوا الحذف الكامل لبياناتكم الشخصية (القانون 18-07).'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingAccountAction(prev => (prev === 'unsubscribe' ? null : 'unsubscribe'))}
              disabled={pending.includes('unsubscribe') || uncertain.includes('unsubscribe')}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              {isFrench ? 'Ne pas renouveler mon abonnement' : 'إلغاء تجديد الاشتراك'}
            </button>

            <button
              type="button"
              onClick={() => setConfirmingAccountAction(prev => (prev === 'deletion' ? null : 'deletion'))}
              disabled={pending.includes('deletion') || uncertain.includes('deletion')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isFrench ? 'Demander la suppression des données' : 'طلب حذف بياناتي'}</span>
            </button>

            <a
              href={buildLegalHref('confidentialite')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {isFrench ? 'Centre légal' : 'المركز القانوني'}
            </a>
          </div>
        </div>

        {confirmingAccountAction && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium leading-5">
              {confirmingAccountAction === 'unsubscribe'
                ? isFrench
                  ? 'Confirmer l’envoi de votre demande d’arrêt de renouvellement à l’équipe Rawdha+ ? Votre accès reste actif jusqu’à la fin de la période en cours.'
                  : 'هل تؤكدون إرسال طلب إيقاف تجديد الاشتراك؟ سيبقى حسابكم مفعلاً حتى نهاية الفترة الجارية.'
                : isFrench
                  ? 'Confirmer l’envoi d’une demande officielle de suppression de votre compte et des données associées ? L’équipe vous recontactera pour vérification avant effacement définitif.'
                  : 'هل تؤكدون إرسال طلب رسمي لحذف الحساب والبيانات المرتبطة به؟ سيتواصل معكم الفريق للتحقق قبل الحذف النهائي.'}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => submitAccountComplianceAction(confirmingAccountAction)}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 cursor-pointer"
              >
                {isFrench ? 'Confirmer la demande' : 'تأكيد الطلب'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingAccountAction(null)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                {isFrench ? 'Annuler' : 'إلغاء'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
