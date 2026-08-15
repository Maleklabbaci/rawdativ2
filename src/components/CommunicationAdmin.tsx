import { useMemo, useState } from 'react';
import {
  CheckCheck,
  ChevronLeft,
  Clock3,
  Inbox,
  MessageCircle,
  MessageSquareQuote,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';

export default function CommunicationAdmin() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { comptes, messages, avis, addMessage, updateMessage, deleteAvis } = useDb();
  const isFrench = language === 'fr';
  const [section, setSection] = useState<'messages' | 'avis'>('messages');
  const [activeDirectorId, setActiveDirectorId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const directeurs = useMemo(() => comptes.filter(account => account.role === 'directeur'), [comptes]);

  const threads = useMemo(() => directeurs.map(director => {
    const thread = messages
      .filter(message => message.parentId === director.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const latest = thread[thread.length - 1];
    return {
      director,
      thread,
      latest,
      unread: thread.filter(message => message.recipientId === 'admin' && !message.isRead).length,
    };
  }).filter(item => item.thread.length > 0), [directeurs, messages]);

  const activeThread = threads.find(item => item.director.id === activeDirectorId) || null;
  const orderedAvis = useMemo(() => [...avis].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [avis]);
  const averageRating = orderedAvis.length
    ? (orderedAvis.reduce((sum, item) => sum + Number(item.rating || 0), 0) / orderedAvis.length).toFixed(1)
    : '0.0';

  const openThread = (directorId: string) => {
    setActiveDirectorId(directorId);
    messages
      .filter(message => message.parentId === directorId && message.recipientId === 'admin' && !message.isRead)
      .forEach(message => { void updateMessage(message.id, { isRead: true }); });
  };

  const handleSend = async () => {
    if (!activeThread || !draft.trim() || sending) return;
    setSending(true);
    try {
      await addMessage({
        senderId: user?.id || 'adm1',
        senderName: user?.prenom ? `${user.prenom} ${user.nom}` : 'Admin',
        recipientId: activeThread.director.id,
        parentId: activeThread.director.id,
        text: draft.trim(),
        timestamp: new Date().toISOString(),
        isRead: false,
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteAvis = async (id: string) => {
    const question = isFrench
      ? 'Supprimer définitivement cet avis ? Cette action est irréversible.'
      : 'هل تريد حذف هذا التقييم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.';
    if (!window.confirm(question)) return;
    await deleteAvis(id);
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="space-y-6 font-sans" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                {isFrench ? 'Messages & Avis' : 'الرسائل والتقييمات'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isFrench ? 'Gérez le support et les témoignages depuis un seul espace.' : 'إدارة الدعم والتقييمات من مساحة واحدة.'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400">{isFrench ? 'Avis publics' : 'التقييمات العامة'}</p>
            <p className="text-xl font-black text-slate-900">{orderedAvis.length}</p>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400">{isFrench ? 'Note moyenne' : 'المعدل'}</p>
            <p className="text-xl font-black text-amber-500 flex items-center gap-1">{averageRating} <Star className="w-4 h-4 fill-amber-400" /></p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setSection('messages')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition ${section === 'messages' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Inbox className="w-4 h-4" />
          {isFrench ? 'Messages support' : 'رسائل الدعم'}
          {threads.some(item => item.unread > 0) && <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">{threads.reduce((sum, item) => sum + item.unread, 0)}</span>}
        </button>
        <button
          type="button"
          onClick={() => setSection('avis')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition ${section === 'avis' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <MessageSquareQuote className="w-4 h-4" />
          {isFrench ? 'Avis publics' : 'التقييمات العامة'}
          <span className="min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center">{orderedAvis.length}</span>
        </button>
      </div>

      {section === 'messages' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 min-h-[520px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-slate-900">{isFrench ? 'Conversations' : 'المحادثات'}</h2>
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-xs text-slate-400 mt-1">{isFrench ? 'Répondez directement aux directeurs.' : 'الرد مباشرة على مديري الروضات.'}</p>
            </div>
            <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
              {threads.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Inbox className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                  <p className="text-sm font-bold">{isFrench ? 'Aucun message reçu.' : 'لا توجد رسائل حالياً.'}</p>
                </div>
              ) : threads.map(item => (
                <button
                  type="button"
                  key={item.director.id}
                  onClick={() => openThread(item.director.id)}
                  className={`w-full p-3 rounded-2xl border text-start transition ${activeDirectorId === item.director.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0">
                      {(item.director.prenom?.[0] || '') + (item.director.nom?.[0] || '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-900 truncate">{item.director.prenom} {item.director.nom}</p>
                        {item.unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">{item.unread}</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">{item.latest?.text}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{item.latest ? new Date(item.latest.timestamp).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ') : ''}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[520px]">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
                <div>
                  <MessageCircle className="w-14 h-14 mx-auto mb-4 text-slate-200" />
                  <h3 className="font-black text-slate-700">{isFrench ? 'Sélectionnez une conversation' : 'اختر محادثة'}</h3>
                  <p className="text-sm mt-2">{isFrench ? 'Les messages des directeurs apparaîtront ici.' : 'ستظهر رسائل مديري الروضات هنا.'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                  <button type="button" onClick={() => setActiveDirectorId(null)} className="xl:hidden p-2 rounded-xl hover:bg-slate-100"><ChevronLeft className="w-4 h-4 rtl:rotate-180" /></button>
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">
                    {(activeThread.director.prenom?.[0] || '') + (activeThread.director.nom?.[0] || '')}
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">{activeThread.director.prenom} {activeThread.director.nom}</h2>
                    <p className="text-xs text-slate-400">{activeThread.director.email || (isFrench ? 'Directeur' : 'مدير الروضة')}</p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-500 ms-auto" />
                </div>
                <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-slate-50/60">
                  {activeThread.thread.map(message => {
                    const isAdminMessage = message.senderId === user?.id || message.senderId === 'adm1';
                    return (
                      <div key={message.id} className={`flex flex-col ${isAdminMessage ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdminMessage ? 'bg-indigo-600 text-white rounded-ee-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-es-sm'}`}>
                          <p className="text-sm whitespace-pre-line">{message.text}</p>
                          <div className={`flex items-center gap-1 justify-end mt-2 text-[10px] ${isAdminMessage ? 'text-indigo-100' : 'text-slate-400'}`}>
                            <Clock3 className="w-3 h-3" />
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isAdminMessage && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={event => { event.preventDefault(); void handleSend(); }} className="p-4 border-t border-slate-100 flex items-center gap-2">
                  <input value={draft} onChange={event => setDraft(event.target.value)} placeholder={isFrench ? 'Répondre au directeur...' : 'الرد على مدير الروضة...'} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 text-sm" required />
                  <button type="submit" disabled={sending} className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4 rtl:-scale-x-100" /></button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">{isFrench ? 'Avis visibles par tous' : 'تقييمات مرئية للجميع'}</h2>
              <p className="text-xs text-slate-400 mt-1">{isFrench ? 'Les directeurs peuvent publier un témoignage. Vous pouvez modérer les avis ici.' : 'يمكن لمديري الروضات نشر تقييماتهم. يمكنك إدارة التقييمات هنا.'}</p>
            </div>
            <div className="flex items-center gap-1 text-amber-500 font-black text-sm"><Star className="w-4 h-4 fill-amber-400" /> {averageRating} / 5</div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {orderedAvis.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 py-16 text-center text-slate-400">
                <MessageSquareQuote className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="font-bold">{isFrench ? 'Aucun avis pour le moment.' : 'لا توجد تقييمات حتى الآن.'}</p>
              </div>
            ) : orderedAvis.map(item => (
              <article key={item.id} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900 text-sm">{item.userName || item.nomCreche}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{item.nomCreche}</p>
                  </div>
                  <button type="button" onClick={() => void handleDeleteAvis(item.id)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50" title={isFrench ? 'Supprimer' : 'حذف'}><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-0.5 mt-3">
                  {[0, 1, 2, 3, 4].map(index => <Star key={index} className={`w-4 h-4 ${index < item.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}
                </div>
                <p className="text-sm text-slate-600 bg-white rounded-xl p-3 mt-3 min-h-20">{item.comment}</p>
                <p className="text-[10px] text-slate-400 mt-3">{new Date(item.date).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ')}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
