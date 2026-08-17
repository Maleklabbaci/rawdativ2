import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, Flag, Headset, MessageSquare, Send, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
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

  const ownMessages = useMemo(() => messages
    .filter(item => item.parentId === user?.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [messages, user?.id]);
  const ownReports = useMemo(() => signalements.filter(item => item.userId === user?.id).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [signalements, user?.id]);
  const ownReview = avis.find(item => item.userId === user?.id);

  const showStatus = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus(''), 3000);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !message.trim()) return;
    await addMessage({ senderId: user.id, senderName: `${user.prenom} ${user.nom}`, recipientId: 'admin', parentId: user.id, text: message.trim(), timestamp: new Date().toISOString(), isRead: false });
    setMessage('');
    showStatus(isFrench ? 'Message envoyé.' : 'تم إرسال الرسالة.');
  };

  const sendReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !comment.trim() || ownReview) return;
    await addAvis({ userId: user.id, userName: `${user.prenom} ${user.nom}`, nomCreche: user.nomCreche || 'Rawdha+', rating, comment: comment.trim(), date: new Date().toISOString() });
    setComment('');
    showStatus(isFrench ? 'Merci pour votre avis.' : 'شكراً على تقييمكم.');
  };

  const sendReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !feedbackTitle.trim() || !feedbackDescription.trim()) return;
    await addSignalement({ userId: user.id, userName: `${user.prenom} ${user.nom}`, nomCreche: user.nomCreche || 'Rawdha+', type: feedbackType, titre: feedbackTitle.trim(), description: feedbackDescription.trim(), statut: 'nouveau', date: new Date().toISOString() });
    setFeedbackTitle('');
    setFeedbackDescription('');
    showStatus(isFrench ? 'Votre retour a été envoyé.' : 'تم إرسال ملاحظتكم.');
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

      {status && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{status}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Headset className="h-5 w-5 text-indigo-600" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Écrire au support' : 'مراسلة الدعم'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Réponse depuis la plateforme.' : 'الرد من داخل المنصة.'}</p></div></div>
          <form onSubmit={sendMessage} className="mt-4 space-y-3">
            <textarea className={inputClass} rows={5} value={message} onChange={event => setMessage(event.target.value)} placeholder={isFrench ? 'Votre message...' : 'رسالتكم...'} />
            <button type="submit" disabled={!message.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isFrench ? 'Envoyer le message' : 'إرسال الرسالة'}</button>
          </form>
          {ownMessages.length > 0 && <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">{ownMessages.slice(-4).map(item => <div key={item.id} className={`rounded-lg px-3 py-2 text-sm ${item.senderId === user?.id ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-700'}`}><p>{item.text}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ')}</p></div>)}</div>}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Flag className="h-5 w-5 text-rose-600" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Signaler ou suggérer' : 'الإبلاغ أو الاقتراح'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Les retours sont suivis par l’équipe.' : 'يتابع الفريق ملاحظاتكم.'}</p></div></div>
          <form onSubmit={sendReport} className="mt-4 space-y-3">
            <div><label className={labelClass}>{isFrench ? 'Type' : 'النوع'}</label><select className={inputClass} value={feedbackType} onChange={event => setFeedbackType(event.target.value as SignalementType)}>{feedbackTypes.map(type => <option key={type} value={type}>{type === 'bug' ? (isFrench ? 'Bug technique' : 'خلل تقني') : type === 'probleme' ? (isFrench ? 'Problème' : 'مشكلة') : type === 'suggestion' ? (isFrench ? 'Suggestion' : 'اقتراح') : (isFrench ? 'Amélioration' : 'تحسين')}</option>)}</select></div>
            <div><label className={labelClass}>{isFrench ? 'Titre' : 'العنوان'}</label><input className={inputClass} value={feedbackTitle} onChange={event => setFeedbackTitle(event.target.value)} /></div>
            <div><label className={labelClass}>{isFrench ? 'Description' : 'الوصف'}</label><textarea className={inputClass} rows={4} value={feedbackDescription} onChange={event => setFeedbackDescription(event.target.value)} /></div>
            <button type="submit" disabled={!feedbackTitle.trim() || !feedbackDescription.trim()} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isFrench ? 'Envoyer le retour' : 'إرسال الملاحظة'}</button>
          </form>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Star className="h-5 w-5 text-amber-500" /><div><h2 className="font-bold text-slate-900">{isFrench ? 'Donner votre avis' : 'شاركوا تقييمكم'}</h2><p className="text-xs text-slate-500">{isFrench ? 'Un avis par compte.' : 'تقييم واحد لكل حساب.'}</p></div></div>
        {ownReview ? <p className="mt-4 text-sm text-slate-600">{isFrench ? 'Votre avis a déjà été enregistré. Merci.' : 'تم تسجيل تقييمكم، شكراً.'}</p> : <form onSubmit={sendReview} className="mt-4 space-y-3"><div className="flex gap-1">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} / 5`}><Star className={`h-7 w-7 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div><textarea className={inputClass} rows={3} value={comment} onChange={event => setComment(event.target.value)} placeholder={isFrench ? 'Votre commentaire...' : 'تعليقكم...'} /><button type="submit" disabled={!comment.trim()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><MessageSquare className="h-4 w-4" />{isFrench ? 'Enregistrer mon avis' : 'حفظ التقييم'}</button></form>}
        {ownReports.length > 0 && <p className="mt-4 text-xs text-slate-500">{isFrench ? `${ownReports.length} retour(s) envoyé(s).` : `تم إرسال ${ownReports.length} ملاحظة.`}</p>}
      </section>
    </div>
  );
}
