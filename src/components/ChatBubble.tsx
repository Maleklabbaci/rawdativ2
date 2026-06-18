import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  MessageCircle, 
  X, 
  Send, 
  Sparkles, 
  Shield, 
  User, 
  HelpCircle, 
  CheckCheck,
  ChevronLeft,
  Users,
  Info,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ChatBubble() {
  const { user } = useAuth();
  const { messages, comptes, addMessage, updateMessage, refreshAll, loading } = useDb();
  const { language, isFrench } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [activeParentThread, setActiveParentThread] = useState<string | null>(null); // For Admin view
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto Scroll to bottom of message logs
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeParentThread]);

  // Soft Background polling for messages every 7 seconds to keep chats super-responsive in real-time
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 7000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Compute unread messages count for parent users
  useEffect(() => {
    if (user && user.role === 'parent') {
      const parentMsgs = messages.filter(
        (m) => m.parentId === user.id && m.senderId !== user.id && !m.isRead
      );
      setUnreadCount(parentMsgs.length);
    } else if (user && user.role === 'admin') {
      // For Admin, count total unread parent messages
      const adminUnread = messages.filter(
        (m) => m.senderId !== 'adm1' && m.recipientId === 'admin' && !m.isRead
      );
      setUnreadCount(adminUnread.length);
    }
  }, [messages, user]);

  if (!user) return null; // No bubble if not authenticated

  const currentParentId = user.role === 'parent' ? user.id : activeParentThread;

  // Filter messages for current active parent thread
  const threadMessages = currentParentId
    ? messages
        .filter((m) => m.parentId === currentParentId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !user) return;

    const timestamp = new Date().toISOString();
    
    if (user.role === 'parent') {
      // Send message to Admin
      await addMessage({
        senderId: user.id,
        senderName: `${user.prenom} ${user.nom}`,
        recipientId: 'admin',
        parentId: user.id,
        text: textToSend,
        timestamp,
        isRead: false
      });

      // Simple AI/Smart Auto-Reply trigger for instant live sensation
      triggerAutoResponse(textToSend);
    } else if (user.role === 'admin' && activeParentThread) {
      // Admin replying to a selected parent thread
      const recipient = comptes.find(c => c.id === activeParentThread);
      await addMessage({
        senderId: 'adm1',
        senderName: `${user.prenom} ${user.nom}`,
        recipientId: activeParentThread,
        parentId: activeParentThread,
        text: textToSend,
        timestamp,
        isRead: false
      });
    }

    setInputText('');
  };

  const triggerAutoResponse = (input: string) => {
    const textLower = input.toLowerCase();
    let reply = '';

    if (textLower.includes('abon') || textLower.includes('pay') || textLower.includes('tarif') || textLower.includes('renouvel') || textLower.includes('سعر') || textLower.includes('اشتراك') || textLower.includes('دفع')) {
      reply = isFrench
        ? "Pour renouveler votre abonnement ou obtenir des détails tarifaires de demi-pension ou pension complète, veuillez vous présenter au secrétariat de la crèche auprès du directeur. Vous obtiendrez votre accès immédiatement."
        : "لتجديد اشتراككم الشهري أو الحصول على تفاصيل الأسعار، يرجى التقدم لمكتب أمانة الروضة والدفع مباشرة. سيتم تفعيل حسابكم في نفس اللحظة.";
    } else if (textLower.includes('marche') || textLower.includes('fonction') || textLower.includes('كيف') || textLower.includes('عمل')) {
      reply = isFrench
        ? "Ce portail RAWDATI vous permet de suivre en direct l'alimentation (repas), la présence, les activités, les factures et les événements éducatifs de votre enfant depuis chez vous !"
        : "تتيح لكم بوابة 'روضتي' تتبع الوجبات اليومية، الحضور والغياب، الأنشطة التربوية، الفواتير وكافة المستجدات الخاصة بطفلكم مباشرة من هاتفكم!";
    } else {
      reply = isFrench
        ? "Merci pour votre message ! Notre administration a bien reçu votre demande et vous répondra très rapidement sur cette même discussion."
        : "شكراً لرسالتكم اللطيفة! لقد استلمت إدارة الحضانة استفساركم وسيجيبكم المدير أو المساعد الإداري هنا قريباً جداً.";
    }

    // Set 1.5 second delay response for real natural feels
    setTimeout(async () => {
      await addMessage({
        senderId: 'adm1',
        senderName: isFrench ? 'Administration Rawdati' : 'إدارة روضتي',
        recipientId: user.id,
        parentId: user.id,
        text: reply,
        timestamp: new Date().toISOString(),
        isRead: false
      });
    }, 1500);
  };

  // Suggesion chips action
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const suggestions = isFrench
    ? [
        "Comment s'abonner / renouveler ?",
        "Comment marche l'application ?",
        "Quels sont vos tarifs ?"
      ]
    : [
        "كيفية الاشتراك والتجديد؟",
        "كيف يعمل هذا التطبيق؟",
        "ما هي الأسعار والخدمات؟"
      ];

  // List of unique parent IDs who have sent a message (for admin view)
  const conversationGroups = comptes.filter(c => c.role === 'parent').map(parent => {
    const parentMsgs = messages.filter(m => m.parentId === parent.id);
    const lastMsg = parentMsgs[parentMsgs.length - 1];
    const unreadMsgs = parentMsgs.filter(m => m.senderId !== 'adm1' && !m.isRead);

    return {
      parent,
      lastMessage: lastMsg?.text || (isFrench ? 'Aucun message' : 'لا توجد رسائل'),
      lastTime: lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: unreadMsgs.length
    };
  }).sort((a, b) => b.unreadCount - a.unreadCount); // put unread threads on top

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-indigo-200 transition cursor-pointer relative"
        id="discussion-bubble-btn"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6 animate-pulse" />}
        
        {/* Unread dot */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </motion.button>

      {/* Panel popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-20 right-0 w-85 sm:w-96 h-128 bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Thread Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.role === 'admin' && activeParentThread && (
                  <button 
                    onClick={() => setActiveParentThread(null)}
                    className="p-1 hover:bg-white/10 rounded-lg text-white transition mr-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center font-bold">
                  {user.role === 'parent' ? <Shield className="w-5 h-5 text-indigo-200" /> : <Users className="w-5 h-5 text-indigo-200" />}
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-wide">
                    {user.role === 'parent' 
                      ? (isFrench ? 'Équipe Administrative' : 'إدارة الروضة') 
                      : activeParentThread 
                        ? (comptes.find(c => c.id === activeParentThread)?.prenom + ' ' + comptes.find(c => c.id === activeParentThread)?.nom)
                        : (isFrench ? 'Service Parent-Abonnés' : 'إدارة محادثات الأولياء')}
                  </h4>
                  <p className="text-[10px] text-indigo-200 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-ping" />
                    <span>{isFrench ? 'En ligne' : 'نشط الآن'}</span>
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

            {/* Content Switch */}

            {/* 1. ADMIN THREAD SELECTOR (Admin is in support view where they choose parent to chat with) */}
            {user.role === 'admin' && !activeParentThread ? (
              <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 mb-1 bg-white border border-slate-100/50 p-2 rounded-xl">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isFrench ? 'Cliquez sur un parent pour chatter' : 'اختر ولي أمر للرد عليه'}</span>
                </div>

                {conversationGroups.map(({ parent, lastMessage, lastTime, unreadCount }) => (
                  <button
                    key={parent.id}
                    onClick={() => {
                      setActiveParentThread(parent.id);
                      // Mark messages from parent to admin as read inside this thread
                      messages
                        .filter(m => m.parentId === parent.id && m.senderId !== 'adm1' && !m.isRead)
                        .forEach(m => updateMessage(m.id, { isRead: true }));
                    }}
                    className="w-full p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 hover:border-indigo-400 hover:bg-slate-50 transition text-right sm:text-left cursor-pointer shadow-xs"
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {parent.prenom[0]}{parent.nom[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 truncate">{parent.prenom} {parent.nom}</p>
                        <span className="text-[10px] text-slate-400 font-medium font-mono">{lastTime}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold truncate mt-0.5">{lastMessage}</p>
                      
                      {parent.enfantId && (
                        <p className="text-[9px] text-rose-500 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md inline-block mt-1">
                          🚸 Patient thread {parent.id}
                        </p>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              // 2. ACTIVE CHAT THREAD VIEW (Parents, or Admin chatting inside active parent's thread)
              <>
                {/* Message Log */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5">
                  <div className="text-center">
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full">
                      {isFrench ? 'Début de discussion sécurisée' : 'بدء المحادثة المباشرة المؤمّنة'}
                    </span>
                  </div>

                  {threadMessages.map((msg) => {
                    const isMe = msg.senderId === user.id || (user.role === 'admin' && msg.senderId === 'adm1');
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {/* Sender Label */}
                        <span className="text-[9px] text-slate-400 font-bold mb-1 px-1">
                          {msg.senderName}
                        </span>

                        {/* Bubble box */}
                        <div
                          className={`max-w-4/5 p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-none'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-line">{msg.text}</p>
                          
                          {/* Time label */}
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

                {/* Suggestions Section - Suggest chips if no messages or parent is selected */}
                {user.role === 'parent' && threadMessages.length <= 2 && (
                  <div className="p-3 bg-slate-100 border-t border-slate-200 max-h-32 overflow-y-auto space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>{isFrench ? 'Questions fréquentes' : 'أسئلة شائعة اقترحناها لك'}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(s)}
                          className="text-[11px] text-indigo-700 bg-white border border-indigo-150 rounded-full px-2.5 py-1 hover:bg-indigo-50 transition cursor-pointer text-right max-w-full font-medium"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Input Bar */}
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
                    placeholder={isFrench ? 'Tapez votre message...' : 'اكتب رسالتك للمدير هنا...'}
                    className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-full outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition text-slate-800 font-medium"
                    required
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition flex items-center justify-center cursor-pointer flex-shrink-0"
                    title={isFrench ? 'Envoyer' : 'إرسال'}
                  >
                    <Send className="w-3.5 h-3.5 transform rotate-0" />
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
