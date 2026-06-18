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

  // Auto-scroll vers le dernier message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeDirectorThread]);

  // Rafraîchissement silencieux toutes les 5 secondes si le chat est ouvert
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Calcul du nombre de messages non lus
  useEffect(() => {
    if (!user) return;
    
    if (user.role === 'directeur') {
      const dirUnread = messages.filter(
        (m) => m.recipientId === user.id && !m.isRead
      );
      setUnreadCount(dirUnread.length);
    } else if (user.role === 'admin') {
      const adminUnread = messages.filter(
        (m) => m.recipientId === 'admin' && !m.isRead
      );
      setUnreadCount(adminUnread.length);
    }
  }, [messages, user]);

  // Marquer comme lu à l'ouverture (pour le directeur)
  useEffect(() => {
    if (isOpen && user?.role === 'directeur') {
      messages
        .filter((m) => m.recipientId === user.id && !m.isRead)
        .forEach((m) => updateMessage(m.id, { isRead: true }));
    }
  }, [isOpen, messages, user]);

  // Bloquer l'accès aux parents : ce chat est UNIQUEMENT Admin <-> Directeur
  if (!user || user.role === 'parent') return null; 

  // L'ID du thread est l'ID du directeur (stocké dans parentId pour des raisons de compatibilité de base de données)
  const currentThreadId = user.role === 'directeur' ? user.id : activeDirectorThread;

  const threadMessages = currentThreadId
    ? messages
        .filter((m) => m.parentId === currentThreadId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
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
          parentId: user.id, // On utilise parentId comme identifiant unique de la conversation
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
    } catch (error) {
      console.error("Erreur lors de l'envoi du message :", error);
    }
  };

  // Liste des conversations pour l'Admin (tous les directeurs)
  const conversationGroups = comptes
    .filter(c => c.role === 'directeur')
    .map(dir => {
      const dirMsgs = messages.filter(m => m.parentId === dir.id);
      const lastMsg = dirMsgs[dirMsgs.length - 1];
      const unreadMsgs = dirMsgs.filter(m => m.recipientId === 'admin' && !m.isRead);

      return {
        director: dir,
        lastMessage: lastMsg?.text || (isFrench ? 'Aucun message' : 'لا توجد رسائل'),
        lastTime: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        unreadCount: unreadMsgs.length,
        hasMessages: dirMsgs.length > 0
      };
    })
    .filter(group => group.hasMessages || user.role === 'admin') // L'admin voit tous les directeurs
    .sort((a, b) => b.unreadCount - a.unreadCount); // Les non-lus en premier

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Bouton Flottant avec Notification */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-slate-500/30 transition cursor-pointer relative border border-slate-700"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Headset className="w-6 h-6" />}
        
        {/* Bulle de notification */}
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
            {/* Header du Chat */}
            <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between shadow-md z-10">
              <div className="flex items-center gap-3">
                {user.role === 'admin' && activeDirectorThread && (
                  <button 
                    onClick={() => setActiveDirectorThread(null)}
                    className="p-1 hover:bg-white/10 rounded-lg text-white transition mr-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 bg-white/10 border border-white/20 text-white rounded-xl flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-wide">
                    {user.role === 'directeur' 
                      ? (isFrench ? 'Support Central RAWDATI' : 'الدعم الفني المركزي') 
                      : activeDirectorThread 
                        ? (comptes.find(c => c.id === activeDirectorThread)?.prenom + ' ' + comptes.find(c => c.id === activeDirectorThread)?.nom)
                        : (isFrench ? 'Messagerie Directeurs' : 'صندوق رسائل المدراء')}
                  </h4>
                  <p className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                    <span>{isFrench ? 'Plateforme sécurisée' : 'اتصال مشفر وآمن'}</span>
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* VUE ADMIN : Liste des conversations avec les directeurs */}
            {user.role === 'admin' && !activeDirectorThread ? (
              <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 mb-2 bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs">
                  <Info className="w-4 h-4 text-indigo-500" />
                  <span>{isFrench ? 'Sélectionnez une crèche pour répondre' : 'اختر روضة للرد على استفساراتها'}</span>
                </div>

                {conversationGroups.map(({ director, lastMessage, lastTime, unreadCount }) => (
                  <button
                    key={director.id}
                    onClick={() => {
                      setActiveDirectorThread(director.id);
                      // Marquer comme lu à l'ouverture du thread par l'admin
                      messages
                        .filter(m => m.parentId === director.id && m.recipientId === 'admin' && !m.isRead)
                        .forEach(m => updateMessage(m.id, { isRead: true }));
                    }}
                    className={`w-full p-3 bg-white border rounded-2xl flex items-center gap-3 transition text-right sm:text-left cursor-pointer shadow-xs ${
                      unreadCount > 0 ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center flex-shrink-0 text-sm border border-indigo-100">
                      {director.prenom[0]}{director.nom[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">{director.prenom} {director.nom}</p>
                        <span className="text-[10px] text-slate-400 font-bold">{lastTime}</span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${unreadCount > 0 ? 'text-slate-800 font-bold' : 'text-slate-500 font-medium'}`}>
                        {lastMessage}
                      </p>
                      <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest mt-1.5 truncate">
                        🏢 {director.nomCreche || 'Crèche'}
                      </p>
                    </div>

                    {unreadCount > 0 && (
                      <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              // VUE DISCUSSION (Directeur ou Admin dans le thread d'un directeur)
              <>
                <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] space-y-4">
                  {threadMessages.length === 0 && (
                    <div className="text-center py-10">
                      <Headset className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                      <p className="text-xs text-slate-400 font-bold">
                        {isFrench 
                          ? 'Envoyez votre demande au support technique.' 
                          : 'أرسل طلبك واستفسارك للدعم الفني مباشرة.'}
                      </p>
                    </div>
                  )}

                  {threadMessages.map((msg) => {
                    const isMe = msg.senderId === user.id || (user.role === 'admin' && msg.senderId === 'adm1');
                    
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">
                          {msg.senderName}
                        </span>

                        <div className={`max-w-[85%] p-3 text-xs leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-slate-800 text-white rounded-2xl rounded-br-sm'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.text}</p>
                          
                          <div className={`text-[9px] font-bold mt-2 flex items-center justify-end gap-1 ${
                            isMe ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && <CheckCheck className={`w-3.5 h-3.5 ${msg.isRead ? 'text-emerald-400' : 'text-slate-400'}`} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Barre de saisie */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(inputText);
                  }}
                  className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      user.role === 'directeur'
                        ? (isFrench ? 'Écrivez à l\'administration centrale...' : 'اكتب رسالتك للإدارة المركزية...')
                        : (isFrench ? 'Écrivez votre réponse au directeur...' : 'اكتب ردك للمدير هنا...')
                    }
                    className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition text-slate-800 font-medium"
                    required
                  />
                  <button
                    type="submit"
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer flex-shrink-0 shadow-md"
                  >
                    <Send className="w-4 h-4 rtl:-scale-x-100" />
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
