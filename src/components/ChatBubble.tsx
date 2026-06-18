import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  MessageCircle, 
  X, 
  Send, 
  ShieldCheck, 
  Headset,
  CheckCheck,
  ChevronLeft,
  Info,
  Clock,
  Star,
  MessageSquareQuote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatBubble() {
  const { user } = useAuth();
  const { messages, comptes, avis, addMessage, updateMessage, addAvis, refreshAll } = useDb();
  const { language, isFrench } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'avis'>('chat');
  const [activeDirectorThread, setActiveDirectorThread] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [showAvisPopup, setShowAvisPopup] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && activeTab === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeDirectorThread, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => { refreshAll(); }, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'directeur') {
      setUnreadCount(messages.filter(m => m.recipientId === user.id && !m.isRead).length);
    } else if (user.role === 'admin') {
      setUnreadCount(messages.filter(m => m.recipientId === 'admin' && !m.isRead).length);
    }
  }, [messages, user]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && user?.role === 'directeur') {
      messages.filter(m => m.recipientId === user.id && !m.isRead)
              .forEach(m => updateMessage(m.id, { isRead: true }));
    }
  }, [isOpen, messages, user, activeTab]);

  useEffect(() => {
    if (user && user.role === 'directeur' && avis) {
      const hasReviewed = avis.some(a => a.userId === user.id);
      const dismissed = localStorage.getItem('avis_dismissed') === 'true';
      if (!hasReviewed && !dismissed) {
        const timer = setTimeout(() => setShowAvisPopup(true), 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, avis]);

  if (!user || user.role === 'parent') return null; 

  const currentThreadId = user.role === 'directeur' ? user.id : activeDirectorThread;
  const threadMessages = currentThreadId
    ? messages.filter(m => m.parentId === currentThreadId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !user) return;
    const timestamp = new Date().toISOString();
    try {
      if (user.role === 'directeur') {
        await addMessage({
          senderId: user.id,
          senderName: `${user.prenom} ${user.nom} (${user.nomCreche || 'Directeur'})`,
          recipientId: 'admin',
          parentId: user.id,
          text: textToSend,
          timestamp,
          isRead: false
        });
      } else if (user.role === 'admin' && activeDirectorThread) {
        await addMessage({
          senderId: 'adm1',
          senderName: isFrench ? 'Support Central RAWDATI' : 'الدعم الفني المركزي',
          recipientId: activeDirectorThread,
          parentId: activeDirectorThread,
          text: textToSend,
          timestamp,
          isRead: false
        });
      }
      setInputText('');
    } catch (error) { console.error(error); }
  };

  const handleSubmitAvis = async () => {
    if (!comment.trim()) return;
    await addAvis({
      userId: user.id,
      userName: `${user.prenom} ${user.nom}`,
      nomCreche: user.nomCreche || 'Directeur',
      rating,
      comment,
      date: new Date().toISOString()
    });
    setShowAvisPopup(false);
    localStorage.setItem('avis_dismissed', 'true');
  };

  const conversationGroups = comptes.filter(c => c.role === 'directeur').map(dir => {
    const dirMsgs = messages.filter(m => m.parentId === dir.id);
    const lastMsg = dirMsgs[dirMsgs.length - 1];
    return {
      director: dir,
      lastMessage: lastMsg?.text || (isFrench ? 'Aucun message' : 'لا توجد رسائل'),
      lastTime: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: dirMsgs.filter(m => m.recipientId === 'admin' && !m.isRead).length,
      hasMessages: dirMsgs.length > 0
    };
  }).filter(group => group.hasMessages || user.role === 'admin').sort((a, b) => b.unreadCount - a.unreadCount);

  return (
    <>
      <AnimatePresence>
        {showAvisPopup && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z- flex items-center justify-center p-4 font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
            >
              <button onClick={() => { setShowAvisPopup(false); localStorage.setItem('avis_dismissed', 'true'); }} className="absolute top-4 right-4 rtl:left-4 rtl:right-auto text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">{isFrench ? 'Votre avis compte !' : 'رأيك يهمنا!'}</h2>
                <p className="text-sm text-slate-500 mt-2">{isFrench ? 'Aidez-nous à améliorer la plateforme RAWDATI.' : 'ساعدنا في تقييم وتحسين منصة روضتي.'}</p>
              </div>

              <div className="flex justify-center gap-2 mb-6 cursor-pointer">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star 
                    key={star} 
                    onClick={() => setRating(star)} 
                    className={`w-10 h-10 transition-all ${star <= rating ? 'text-amber-400 fill-amber-400 scale-110' : 'text-slate-200'}`} 
                  />
                ))}
              </div>

              <textarea 
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={isFrench ? 'Laissez un commentaire sur votre expérience...' : 'أكتب تعليقك حول تجربتك في المنصة...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:border-indigo-500 transition text-sm font-medium mb-4 resize-none"
              />

              <button 
                onClick={handleSubmitAvis}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
              >
                {isFrench ? 'Soumettre mon avis' : 'إرسال التقييم'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-40 font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-slate-500/30 transition cursor-pointer relative border border-slate-700"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Headset className="w-6 h-6" />}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-md">
              {unreadCount}
            </span>
          )}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-20 right-0 w-85 sm:w-[400px] h-[550px] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between shadow-md z-10">
                <div className="flex items-center gap-3">
                  {user.role === 'admin' && activeDirectorThread && activeTab === 'chat' && (
                    <button onClick={() => setActiveDirectorThread(null)} className="p-1 hover:bg-white/10 rounded-lg text-white transition mr-1">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <div className="w-10 h-10 bg-white/10 border border-white/20 text-white rounded-xl flex items-center justify-center font-bold">
                    {activeTab === 'chat' ? <ShieldCheck className="w-5 h-5" /> : <Star className="w-5 h-5 fill-amber-400 text-amber-400" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black tracking-wide">
                      {activeTab === 'chat' 
                        ? (user.role === 'directeur' ? (isFrench ? 'Support RAWDATI' : 'الدعم الفني') : activeDirectorThread ? comptes.find(c => c.id === activeDirectorThread)?.prenom : (isFrench ? 'Messagerie' : 'صندوق الرسائل'))
                        : (isFrench ? 'Avis des Crèches' : 'تقييمات الروضات')}
                    </h4>
                    <p className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                      {activeTab === 'chat' ? <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />{isFrench ? 'Sécurisé' : 'آمن'}</> : '⭐⭐⭐⭐⭐'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <button 
                  onClick={() => setActiveTab('chat')} 
                  className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  <Headset className="w-4 h-4" /> {isFrench ? 'Chat' : 'المحادثة'}
                </button>
                <button 
                  onClick={() => setActiveTab('avis')} 
                  className={`flex-1 py-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'avis' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  <MessageSquareQuote className="w-4 h-4" /> {isFrench ? 'Avis & Témoignages' : 'التقييمات'}
                </button>
              </div>

              {activeTab === 'avis' ? (
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
                  {(avis || []).length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-10 font-bold">{isFrench ? 'Aucun avis pour le moment.' : 'لا توجد تقييمات حتى الآن.'}</p>
                  ) : (
                    (avis || []).slice().reverse().map(a => (
                      <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm leading-none">{a.nomCreche}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">{a.userName}</p>
                          </div>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < a.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">{a.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                user.role === 'admin' && !activeDirectorThread ? (
                  <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2">
                    {conversationGroups.map(({ director, lastMessage, lastTime, unreadCount }) => (
                      <button
                        key={director.id}
                        onClick={() => {
                          setActiveDirectorThread(director.id);
                          messages.filter(m => m.parentId === director.id && m.recipientId === 'admin' && !m.isRead).forEach(m => updateMessage(m.id, { isRead: true }));
                        }}
                        className={`w-full p-3 bg-white border rounded-2xl flex items-center gap-3 transition text-right sm:text-left cursor-pointer shadow-xs ${unreadCount > 0 ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'}`}
                      >
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center flex-shrink-0 text-sm border border-indigo-100">{director.prenom}{director.nom}</div>
                        <div className="flex-1 min-w-0 text-left rtl:text-right">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-900 truncate">{director.prenom} {director.nom}</p>
                            <span className="text-[10px] text-slate-400 font-bold">{lastTime}</span>
                          </div>
                          <p className={`text-[11px] truncate mt-0.5 ${unreadCount > 0 ? 'text-slate-800 font-bold' : 'text-slate-500 font-medium'}`}>{lastMessage}</p>
                          <p className="text-[9px] text-indigo-600 font-black mt-1.5 truncate">🏢 {director.nomCreche || 'Crèche non spécifiée'}</p>
                        </div>
                        {unreadCount > 0 && <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">{unreadCount}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] space-y-4">
                      {threadMessages.length === 0 && (
                        <div className="text-center py-10">
                          <Headset className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                          <p className="text-xs text-slate-400 font-bold">{isFrench ? 'Envoyez votre demande au support technique.' : 'أرسل طلبك واستفسارك للدعم الفني مباشرة.'}</p>
                        </div>
                      )}
                      {threadMessages.map((msg) => {
                        const isMe = msg.senderId === user.id || (user.role === 'admin' && msg.senderId === 'adm1');
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">{msg.senderName}</span>
                            <div className={`max-w-[85%] p-3 text-xs leading-relaxed shadow-sm ${isMe ? 'bg-slate-800 text-white rounded-2xl rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm'}`}>
                              <p className="whitespace-pre-line">{msg.text}</p>
                              <div className={`text-[9px] font-bold mt-2 flex items-center justify-end gap-1 ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
                                <Clock className="w-2.5 h-2.5" />
                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isMe && <CheckCheck className={`w-3.5 h-3.5 ${msg.isRead ? 'text-emerald-400' : 'text-slate-400'}`} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={e => { e.preventDefault(); handleSendMessage(inputText); }} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                      <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={isFrench ? 'Écrivez un message...' : 'اكتب رسالتك...'} className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium" required />
                      <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer shadow-md">
                        <Send className="w-4 h-4 rtl:-scale-x-100" />
                      </button>
                    </form>
                  </>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
