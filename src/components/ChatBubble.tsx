import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  Flag,
  Headset,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Signalement, SignalementType } from '../types';

const signalementTypes: SignalementType[] = ['bug', 'probleme', 'suggestion', 'amelioration'];

export default function ChatBubble() {
  const { user } = useAuth();
  const {
    messages,
    avis,
    signalements,
    addMessage,
    updateMessage,
    addAvis,
    addSignalement,
    refreshAll,
  } = useDb();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isFrench = language !== 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'avis' | 'retours'>('chat');
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAvisPopup, setShowAvisPopup] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [feedbackType, setFeedbackType] = useState<SignalementType>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sendingAvis, setSendingAvis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const typeLabel = (type: SignalementType) => {
    const labels: Record<SignalementType, string> = isFrench
      ? { bug: 'Bug technique', probleme: 'Problème', suggestion: 'Suggestion', amelioration: 'Amélioration' }
      : { bug: 'خلل تقني', probleme: 'مشكلة', suggestion: 'اقتراح', amelioration: 'تحسين' };
    return labels[type];
  };

  const statusLabel = (status: Signalement['statut']) => {
    const labels: Record<Signalement['statut'], string> = isFrench
      ? { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', rejete: 'Rejeté' }
      : { nouveau: 'جديد', en_cours: 'قيد المعالجة', resolu: 'تم الحل', rejete: 'مرفوض' };
    return labels[status];
  };

  const ownSignalements = useMemo(
    () => (signalements || [])
      .filter(item => item.userId === user?.id)
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [signalements, user?.id],
  );

  useEffect(() => {
    if (messagesEndRef.current && activeTab === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = window.setInterval(() => { void refreshAll(); }, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, refreshAll]);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    setUnreadCount(messages.filter(message => message.recipientId === user.id && !message.isRead).length);
  }, [messages, user]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat' || !user || user.role === 'admin') return;
    messages
      .filter(message => message.recipientId === user.id && !message.isRead)
      .forEach(message => { void updateMessage(message.id, { isRead: true }); });
  }, [isOpen, messages, user, activeTab, updateMessage]);

  useEffect(() => {
    if (!user || user.role === 'admin' || !avis) return;
    const hasReviewed = avis.some(item => item.userId === user.id);
    const dismissed = localStorage.getItem(`avis_dismissed_${user.id}`) === 'true';
    if (!hasReviewed && !dismissed) {
      const timer = window.setTimeout(() => setShowAvisPopup(true), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [user, avis]);

  if (!user || user.role === 'admin') return null;

  const threadMessages = messages
    .filter(message => message.parentId === user.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    try {
      await addMessage({
        senderId: user.id,
        senderName: `${user.prenom} ${user.nom}`,
        recipientId: 'admin',
        parentId: user.id,
        text: textToSend.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      setInputText('');
    } catch (error) {
      console.error('Erreur envoi message support:', error);
    }
  };

  const handleSubmitAvis = async () => {
    if (!comment.trim() || sendingAvis) return;
    setSendingAvis(true);
    try {
      await addAvis({
        userId: user.id,
        userName: `${user.prenom} ${user.nom}`,
        nomCreche: user.nomCreche || (isFrench ? 'Utilisateur Rawdha+' : 'مستخدم روضتي'),
        rating,
        comment: comment.trim(),
        date: new Date().toISOString(),
      });
      setComment('');
      setShowAvisPopup(false);
      localStorage.setItem(`avis_dismissed_${user.id}`, 'true');
      showToast(isFrench ? 'Merci pour votre avis.' : 'شكراً على تقييمك.', 'success');
    } finally {
      setSendingAvis(false);
    }
  };

  const handleSubmitSignalement = async () => {
    if (!feedbackTitle.trim() || !feedbackDescription.trim() || sendingFeedback) return;
    setSendingFeedback(true);
    try {
      await addSignalement({
        userId: user.id,
        userName: `${user.prenom} ${user.nom}`,
        nomCreche: user.nomCreche || (isFrench ? 'Utilisateur Rawdha+' : 'مستخدم روضتي'),
        type: feedbackType,
        titre: feedbackTitle.trim(),
        description: feedbackDescription.trim(),
        statut: 'nouveau',
        date: new Date().toISOString(),
      });
      setFeedbackTitle('');
      setFeedbackDescription('');
      setActiveTab('retours');
      showToast(
        isFrench ? 'Votre retour a été envoyé à l’équipe.' : 'تم إرسال ملاحظتك إلى الفريق.',
        'success',
      );
    } catch (error) {
      console.error('Erreur envoi signalement:', error);
    } finally {
      setSendingFeedback(false);
    }
  };

  const closeAvisPopup = () => {
    setShowAvisPopup(false);
    localStorage.setItem(`avis_dismissed_${user.id}`, 'true');
  };

  return (
    <>
      <AnimatePresence>
        {showAvisPopup && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-900/60 p-3 backdrop-blur-md sm:items-center sm:p-4 font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl bg-white p-5 shadow-2xl sm:p-8"
            >
              <button onClick={closeAvisPopup} className="absolute top-4 right-4 rtl:left-4 rtl:right-auto text-slate-400 hover:text-slate-600 transition" aria-label={isFrench ? 'Fermer' : 'إغلاق'}>
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">{isFrench ? 'Votre avis compte !' : 'رأيك يهمنا!'}</h2>
                <p className="text-sm text-slate-500 mt-2">{isFrench ? 'Aidez-nous à améliorer la plateforme RAWDHA+.' : 'ساعدنا في تقييم وتحسين منصة روضتي.'}</p>
              </div>
              <div className="flex justify-center gap-2 mb-6 cursor-pointer" aria-label={isFrench ? 'Choisir une note' : 'اختر التقييم'}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} onClick={() => setRating(star)} className={`w-10 h-10 transition-all ${star <= rating ? 'text-amber-400 fill-amber-400 scale-110' : 'text-slate-200'}`} />
                ))}
              </div>
              <textarea
                rows={4}
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder={isFrench ? 'Laissez un commentaire sur votre expérience...' : 'أكتب تعليقك حول تجربتك في المنصة...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-indigo-500 transition text-sm font-medium mb-4 resize-none"
              />
              <button onClick={() => void handleSubmitAvis()} disabled={!comment.trim() || sendingAvis} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer disabled:opacity-50">
                {isFrench ? 'Soumettre mon avis' : 'إرسال التقييم'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={`fixed z-40 font-sans ${language === 'ar' ? 'left-3 sm:left-6' : 'right-3 sm:right-6'}`} style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.button
          onClick={() => setIsOpen(value => !value)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-slate-500/30 transition cursor-pointer relative border border-slate-700"
          aria-label={isFrench ? 'Ouvrir le support et les retours' : 'فتح الدعم والملاحظات'}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Headset className="w-6 h-6" />}
          {unreadCount > 0 && (
            <span className={`absolute -top-2 ${language === 'ar' ? '-left-2' : '-right-2'} bg-rose-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-md`}>
              {unreadCount}
            </span>
          )}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] ${language === 'ar' ? 'left-0' : 'right-0'} h-[min(70dvh,600px)] max-h-[calc(100dvh-6.5rem)] w-[min(calc(100vw-1.5rem),420px)] max-w-[calc(100vw-1.5rem)] overscroll-contain rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden sm:bottom-20 sm:max-h-[calc(100dvh-6rem)]`}
            >
              <div className="shrink-0 p-3.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between shadow-md z-10 sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 border border-white/20 text-white rounded-xl flex items-center justify-center font-bold">
                    {activeTab === 'chat' ? <ShieldCheck className="w-5 h-5" /> : activeTab === 'avis' ? <Star className="w-5 h-5 fill-amber-400 text-amber-400" /> : <Flag className="w-5 h-5 text-rose-300" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black tracking-wide">
                      {activeTab === 'chat'
                        ? (isFrench ? 'Support RAWDHA+' : 'الدعم الفني')
                        : activeTab === 'avis'
                          ? (isFrench ? 'Avis des utilisateurs' : 'تقييمات المستخدمين')
                          : (isFrench ? 'Signaler / Suggérer' : 'إبلاغ / اقتراح')}
                    </h4>
                    <p className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                      {activeTab === 'chat' ? <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{isFrench ? 'Support sécurisé' : 'دعم آمن'}</> : activeTab === 'avis' ? '⭐⭐⭐⭐⭐' : (isFrench ? 'Votre voix développe la plateforme' : 'ملاحظتك تطور المنصة')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition" aria-label={isFrench ? 'Fermer' : 'إغلاق'}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-[11px] font-black flex items-center justify-center gap-1.5 border-b-2 transition ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <Headset className="w-3.5 h-3.5" /> {isFrench ? 'Chat' : 'المحادثة'}
                </button>
                <button onClick={() => setActiveTab('avis')} className={`flex-1 py-3 text-[11px] font-black flex items-center justify-center gap-1.5 border-b-2 transition ${activeTab === 'avis' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <MessageSquareQuote className="w-3.5 h-3.5" /> {isFrench ? 'Avis' : 'التقييمات'}
                </button>
                <button onClick={() => setActiveTab('retours')} className={`flex-1 py-3 text-[11px] font-black flex items-center justify-center gap-1.5 border-b-2 transition ${activeTab === 'retours' ? 'border-rose-500 text-rose-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <Flag className="w-3.5 h-3.5" /> {isFrench ? 'Retours' : 'الملاحظات'}
                </button>
              </div>

              {activeTab === 'avis' ? (
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
                  <form onSubmit={event => { event.preventDefault(); void handleSubmitAvis(); }} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{isFrench ? 'Partager votre expérience' : 'شارك تجربتك'}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{isFrench ? 'Tous les comptes connectés peuvent publier.' : 'كل الحسابات المتصلة يمكنها النشر.'}</p>
                      </div>
                      <MessageSquareQuote className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex gap-1.5 mb-3" aria-label={isFrench ? 'Note' : 'التقييم'}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => setRating(star)} className="cursor-pointer" aria-label={`${star}/5`}>
                          <Star className={`w-6 h-6 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                        </button>
                      ))}
                    </div>
                    <textarea value={comment} onChange={event => setComment(event.target.value)} rows={3} placeholder={isFrench ? 'Votre avis sur Rawdha+...' : 'رأيك حول منصة روضتي...'} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-amber-400 resize-none" />
                    <button type="submit" disabled={!comment.trim() || sendingAvis} className="w-full mt-3 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black hover:bg-amber-600 disabled:opacity-50 transition">
                      {sendingAvis ? (isFrench ? 'Envoi...' : 'جارٍ الإرسال...') : (isFrench ? 'Publier mon avis' : 'نشر تقييمي')}
                    </button>
                  </form>

                  {(avis || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-8 font-bold">{isFrench ? 'Aucun avis pour le moment.' : 'لا توجد تقييمات حتى الآن.'}</p>
                  ) : (
                    (avis || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm leading-none">{item.nomCreche}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">{item.userName}</p>
                          </div>
                          <div className="flex shrink-0">
                            {[1, 2, 3, 4, 5].map(star => <Star key={star} className={`w-3.5 h-3.5 ${star <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">{item.comment}</p>
                        <p className="text-[10px] text-slate-400 mt-2">{new Date(item.date).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ')}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'retours' ? (
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{isFrench ? 'Aidez-nous à progresser' : 'ساعدنا على التطور'}</p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{isFrench ? 'Signalez un bug ou proposez une amélioration. L’équipe examinera votre retour.' : 'أبلغ عن خلل أو اقترح تحسيناً. سيراجع الفريق ملاحظتك.'}</p>
                      </div>
                    </div>
                    <form onSubmit={event => { event.preventDefault(); void handleSubmitSignalement(); }} className="space-y-3">
                      <select value={feedbackType} onChange={event => setFeedbackType(event.target.value as SignalementType)} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:border-rose-400">
                        {signalementTypes.map(type => <option key={type} value={type}>{typeLabel(type)}</option>)}
                      </select>
                      <input value={feedbackTitle} onChange={event => setFeedbackTitle(event.target.value)} placeholder={isFrench ? 'Titre de votre retour' : 'عنوان الملاحظة'} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-rose-400" maxLength={120} required />
                      <textarea value={feedbackDescription} onChange={event => setFeedbackDescription(event.target.value)} placeholder={isFrench ? 'Décrivez le problème ou votre idée...' : 'اشرح المشكلة أو فكرتك...'} rows={4} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-rose-400 resize-none" maxLength={2000} required />
                      <button type="submit" disabled={!feedbackTitle.trim() || !feedbackDescription.trim() || sendingFeedback} className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                        <Send className="w-3.5 h-3.5 rtl:-scale-x-100" /> {sendingFeedback ? (isFrench ? 'Envoi...' : 'جارٍ الإرسال...') : (isFrench ? 'Envoyer à l’équipe' : 'إرسال إلى الفريق')}
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center gap-2 px-1"><ListChecks className="w-4 h-4 text-slate-400" /><p className="text-xs font-black text-slate-600">{isFrench ? 'Mes retours' : 'ملاحظاتي'}</p></div>
                  {ownSignalements.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center border border-slate-100"><Lightbulb className="w-8 h-8 mx-auto text-slate-200 mb-2" /><p className="text-xs text-slate-400 font-bold">{isFrench ? 'Vous n’avez encore rien envoyé.' : 'لم ترسل أي ملاحظة بعد.'}</p></div>
                  ) : ownSignalements.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><span className="inline-flex px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">{typeLabel(item.type)}</span><h5 className="text-sm font-black text-slate-900 mt-2 truncate">{item.titre}</h5></div>
                        <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black ${item.statut === 'resolu' ? 'bg-emerald-100 text-emerald-700' : item.statut === 'rejete' ? 'bg-rose-100 text-rose-700' : item.statut === 'en_cours' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{statusLabel(item.statut)}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-3 whitespace-pre-line">{item.description}</p>
                      <p className="text-[10px] text-slate-400 mt-3">{new Date(item.date).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}</p>
                      {item.reponseAdmin && <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100"><p className="text-[10px] font-black text-emerald-700 mb-1">{isFrench ? 'Réponse de l’équipe' : 'رد الفريق'}</p><p className="text-xs text-emerald-900 whitespace-pre-line">{item.reponseAdmin}</p></div>}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] space-y-4">
                    {threadMessages.length === 0 && (
                      <div className="text-center py-10"><Headset className="w-12 h-12 mx-auto text-slate-200 mb-3" /><p className="text-xs text-slate-400 font-bold">{isFrench ? 'Envoyez votre demande au support technique.' : 'أرسل طلبك واستفسارك للدعم الفني مباشرة.'}</p></div>
                    )}
                    {threadMessages.map(message => {
                      const isMe = message.senderId === user.id;
                      return (
                        <div key={message.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">{message.senderName}</span>
                          <div className={`max-w-[85%] p-3 text-xs leading-relaxed shadow-sm ${isMe ? 'bg-slate-800 text-white rounded-2xl rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm'}`}>
                            <p className="whitespace-pre-line">{message.text}</p>
                            <div className={`text-[9px] font-bold mt-2 flex items-center justify-end gap-1 ${isMe ? 'text-slate-300' : 'text-slate-400'}`}><Clock className="w-2.5 h-2.5" /><span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{isMe && <CheckCheck className={`w-3.5 h-3.5 ${message.isRead ? 'text-emerald-400' : 'text-slate-400'}`} />}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={event => { event.preventDefault(); void handleSendMessage(inputText); }} className="shrink-0 p-3 bg-white border-t border-slate-200 flex items-center gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                    <input type="text" value={inputText} onChange={event => setInputText(event.target.value)} placeholder={isFrench ? 'Écrivez un message...' : 'اكتب رسالتك...'} className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium" required />
                    <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer shadow-md"><Send className="w-4 h-4 rtl:-scale-x-100" /></button>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
