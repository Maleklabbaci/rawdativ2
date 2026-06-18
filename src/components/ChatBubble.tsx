import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  MessageCircle, 
  X, 
  Send, 
  Shield, 
  Users,
  CheckCheck,
  ChevronLeft,
  Info,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatBubble() {
  const { user } = useAuth();
  const { messages, comptes, addMessage, updateMessage, refreshAll } = useDb();
  const { language, isFrench } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [activeDirectorThread, setActiveDirectorThread] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto Scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeDirectorThread]);

  // Background polling
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 7000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Calcul des messages non lus
  useEffect(() => {
    if (user?.role === 'directeur') {
      const dirUnread = messages.filter(
        (m) => m.recipientId === user.id && !m.isRead
      );
      setUnreadCount(dirUnread.length);
    } else if (user?.role === 'admin') {
      const adminUnread = messages.filter(
        (m) => m.recipientId === 'admin' && !m.isRead
      );
      setUnreadCount(adminUnread.length);
    }
  }, [messages, user]);

  // Marquer comme lu à l'ouverture pour le Directeur
  useEffect(() => {
    if (isOpen && user?.role === 'directeur') {
      messages
        .filter((m) => m.recipientId === user.id && !m.isRead)
        .forEach((m) => updateMessage(m.id, { isRead: true }));
    }
  }, [isOpen, messages, user]);

  // Seuls les directeurs et l'admin ont accès au chat
  if (!user || user.role === 'parent') return null; 

  const currentThreadId = user.role === 'directeur' ? user.id : activeDirectorThread;

  const threadMessages = currentThreadId
    ? messages
        .filter((m) => m.parentId === currentThreadId) // parentId agit comme l'ID de la conversation (ID du directeur)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !user) return;

    const timestamp = new Date().toISOString();
    
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
        senderName: 'Support Technique RAWDATI',
        recipientId: activeDirectorThread,
        parentId: activeDirectorThread,
        text: textToSend,
        timestamp,
        isRead: false
      });
    }

    setInputText('');
  };

  // Liste des directeurs ayant initié une conversation (Pour l'Admin)
  const directorsWithMessages = Array.from(new Set(messages.filter(m => m.recipientId === 'admin').map(m => m.senderId)));
  const conversationGroups = comptes
    .filter(c => c.role === 'directeur' && directorsWithMessages.includes(c.id))
    .map(dir => {
      const dirMsgs = messages.filter(m => m.parentId === dir.id);
      const lastMsg = dirMsgs[dirMsgs.length - 1];
      const unreadMsgs = dirMsgs.filter(m => m.recipientId === 'admin' && !m.isRead);

      return {
        director: dir,
        lastMessage: lastMsg?.text || '',
        lastTime: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        unreadCount: unreadMsgs.length
      };
    }).sort((a, b) => b.unreadCount - a.unreadCount);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Bouton Flottant avec Notification */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-indigo-200 transition cursor-pointer relative"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        
        {/* Bulle de notification claire */}
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
            transition={{ duration: 0.22 }}
            className="absolute bottom-20 right-0 w-85 sm:w-96 h-128 bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.role === 'admin' && activeDirectorThread && (
                  <button 
                    onClick={() => setActiveDirectorThread(null)}
                    className="p-1 hover:bg-white/10 rounded-lg text-white transition mr-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center font-bold">
                  {user.role === 'directeur' ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-wide">
                    {user.role === 'directeur' 
                      ? (isFrench ? 'Support Technique' : 'الدعم الفني للمنصة') 
                      : activeDirectorThread 
                        ? (comptes.find(c => c.id === activeDirectorThread)?.prenom + ' ' + comptes.find(c => c.id === activeDirectorThread)?.nom)
                        : (isFrench ? 'Messagerie Directeurs' : 'رسائل مدراء الروضات')}
                  </h4>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vue Admin : Liste des conversations */}
            {user.role === 'admin' && !activeDirectorThread ? (
              <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 mb-1 bg-white border border-slate-100/50 p-2 rounded-xl">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isFrench ? 'Répondez aux directeurs' : 'الرد على استفسارات المدراء'}</span>
                </div>

                {conversationGroups.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-10">{isFrench ? 'Aucun message reçu.' : 'لا توجد رسائل واردة.'}</p>
                )}

                {conversationGroups.map(({ director, lastMessage, lastTime, unreadCount }) => (
                  <button
                    key={director.id}
                    onClick={() => {
                      setActiveDirectorThread(director.id);
                      // Marquer comme lu pour l'admin
                      messages
                        .filter(m => m.parentId === director.id && m.recipientId === 'admin' && !m.isRead)
                        .forEach(m => updateMessage(m.id, { isRead: true }));
                    }}
                    className="w-full p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-indigo-400 hover:bg-slate-50 transition text-right sm:text-left cursor-pointer shadow-xs relative"
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {director.prenom[0]}{director.nom[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">{director.prenom} {director.nom}</p>
                        <span className="text-[10px] text-slate-400 font-medium font-mono">{lastTime}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold truncate mt-0.5">{lastMessage}</p>
                      <p className="text-[9px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block mt-1 truncate max-w-full">
                        {director.nomCreche}
                      </p>
                    </div>

                    {unreadCount > 0 && (
                      <span className="w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              // Vue Discussion (Directeur, ou Admin dans un thread)
              <>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5">
                  {threadMessages.map((msg) => {
                    const isMe = msg.senderId === user.id || (user.role === 'admin' && msg.senderId === 'adm1');
                    
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">
                          {msg.senderName}
                        </span>

                        <div className={`max-w-4/5 p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-none'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.text}</p>
                          
                          <div className={`text-[8px] font-bold mt-1.5 flex items-center justify-end gap-1 ${
                            isMe ? 'text-indigo-200' : 'text-slate-400'
                          }`}>
                            <Clock className="w-2 h-2" />
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3 text-emerald-300" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(inputText);
                  }}
                  className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isFrench ? 'Écrivez un message...' : 'اكتب رسالتك هنا...'}
                    className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-full outline-none focus:border-indigo-500 transition text-slate-800 font-medium"
                    required
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
