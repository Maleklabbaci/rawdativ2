import { useMemo, useState } from 'react';
import {
  CheckCheck,
  ChevronLeft,
  Clock3,
  FileText,
  Inbox,
  Lightbulb,
  MessageCircle,
  MessageSquareQuote,
  Save,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useToast } from '../contexts/ToastContext';
import { useDb } from '../contexts/DbContext';
import type { Signalement, SignalementPriorite, SignalementStatut, SignalementType } from '../types';

const signalementTypes: SignalementType[] = ['bug', 'probleme', 'suggestion', 'amelioration'];
const signalementStatuses: SignalementStatut[] = ['nouveau', 'en_cours', 'resolu', 'rejete'];

export default function CommunicationAdmin() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const {
    comptes,
    messages,
    avis,
    signalements,
    addMessage,
    updateMessage,
    deleteAvis,
    updateSignalement,
    deleteSignalement,
    logAdminAction,
  } = useDb();
  const isFrench = language === 'fr';
  const [section, setSection] = useState<'messages' | 'avis' | 'retours'>('messages');
  const [activeDirectorId, setActiveDirectorId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [savingResponseId, setSavingResponseId] = useState<string | null>(null);

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
  const orderedSignalements = useMemo(() => [...signalements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [signalements]);
  const averageRating = orderedAvis.length
    ? (orderedAvis.reduce((sum, item) => sum + Number(item.rating || 0), 0) / orderedAvis.length).toFixed(1)
    : '0.0';

  const typeLabel = (type: SignalementType) => {
    const labels: Record<SignalementType, string> = isFrench
      ? { bug: 'Bug technique', probleme: 'Problème', suggestion: 'Suggestion', amelioration: 'Amélioration' }
      : { bug: 'خلل تقني', probleme: 'مشكلة', suggestion: 'اقتراح', amelioration: 'تحسين' };
    return labels[type];
  };

  const statusLabel = (status: SignalementStatut) => {
    const labels: Record<SignalementStatut, string> = isFrench
      ? { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', rejete: 'Rejeté' }
      : { nouveau: 'جديد', en_cours: 'قيد المعالجة', resolu: 'تم الحل', rejete: 'مرفوض' };
    return labels[status];
  };

  const priorityLabel = (priority: SignalementPriorite) => {
    const labels: Record<SignalementPriorite, string> = isFrench
      ? { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' }
      : { basse: 'منخفضة', normale: 'عادية', haute: 'مرتفعة', urgente: 'عاجلة' };
    return labels[priority];
  };

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
    const confirmed = await confirm({
      title: isFrench ? 'Confirmer la suppression de l’avis' : 'تأكيد حذف التقييم',
      message: question,
      confirmLabel: isFrench ? 'Supprimer l’avis' : 'حذف التقييم',
      variant: 'danger',
    });
    if (confirmed) await deleteAvis(id);
  };

  const handleDeleteSignalement = async (item: Signalement) => {
    const question = isFrench
      ? `Supprimer définitivement « ${item.titre} » ? Cette action est irréversible.`
      : `هل تريد حذف « ${item.titre} » نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`;
    const confirmed = await confirm({
      title: isFrench ? 'Confirmer la suppression du signalement' : 'تأكيد حذف البلاغ',
      message: question,
      confirmLabel: isFrench ? 'Supprimer le signalement' : 'حذف البلاغ',
      variant: 'danger',
    });
    if (confirmed) await deleteSignalement(item.id);
  };

  const handleStatusChange = async (id: string, statut: SignalementStatut) => {
    await updateSignalement(id, { statut });
    const item = signalements.find(signalement => signalement.id === id);
    await logAdminAction('ticket_status_updated', 'ticket', id, item?.titre, { statut });
  };

  const handleTicketUpdate = async (
    item: Signalement,
    patch: Partial<Pick<Signalement, 'priorite' | 'assigneeId' | 'assigneeName' | 'dueAt'>>,
    action: 'ticket_assigned' | 'ticket_priority_updated' | 'ticket_due_date_updated',
  ) => {
    try {
      await updateSignalement(item.id, patch);
      await logAdminAction(action, 'ticket', item.id, item.titre, patch);
      showToast(isFrench ? 'Ticket mis à jour.' : 'تم تحديث الطلب.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : (isFrench ? 'Impossible de mettre à jour le ticket.' : 'تعذر تحديث الطلب.'), 'error');
    }
  };

  const handleSaveResponse = async (item: Signalement) => {
    const response = (responseDrafts[item.id] ?? item.reponseAdmin ?? '').trim();
    if (!response || savingResponseId) return;
    setSavingResponseId(item.id);
    try {
      await updateSignalement(item.id, { reponseAdmin: response, statut: item.statut === 'nouveau' ? 'en_cours' : item.statut });
      await logAdminAction('ticket_response_saved', 'ticket', item.id, item.titre, { statut: item.statut === 'nouveau' ? 'en_cours' : item.statut });
    } finally {
      setSavingResponseId(null);
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="space-y-6 font-sans" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{isFrench ? 'Messages, avis & retours' : 'الرسائل والتقييمات والملاحظات'}</h1>
              <p className="text-sm text-slate-500 mt-1">{isFrench ? 'Gérez le support, les témoignages et les idées depuis un seul espace.' : 'إدارة الدعم والتقييمات والأفكار من مساحة واحدة.'}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{isFrench ? 'Avis publics' : 'التقييمات العامة'}</p><p className="text-xl font-black text-slate-900">{orderedAvis.length}</p></div>
          <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{isFrench ? 'Note moyenne' : 'المعدل'}</p><p className="text-xl font-black text-amber-500 flex items-center gap-1">{averageRating} <Star className="w-4 h-4 fill-amber-400" /></p></div>
          <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{isFrench ? 'Retours reçus' : 'الملاحظات'}</p><p className="text-xl font-black text-rose-600">{orderedSignalements.length}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-fit">
        <button type="button" onClick={() => setSection('messages')} className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition ${section === 'messages' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          <Inbox className="w-4 h-4" /> {isFrench ? 'Messages support' : 'رسائل الدعم'}
          {threads.some(item => item.unread > 0) && <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">{threads.reduce((sum, item) => sum + item.unread, 0)}</span>}
        </button>
        <button type="button" onClick={() => setSection('avis')} className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition ${section === 'avis' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          <MessageSquareQuote className="w-4 h-4" /> {isFrench ? 'Avis publics' : 'التقييمات العامة'}
          <span className="min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center">{orderedAvis.length}</span>
        </button>
        <button type="button" onClick={() => setSection('retours')} className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition ${section === 'retours' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          <Lightbulb className="w-4 h-4" /> {isFrench ? 'Signalements & idées' : 'البلاغات والأفكار'}
          <span className="min-w-5 h-5 px-1 rounded-full bg-rose-100 text-rose-700 text-[10px] flex items-center justify-center">{orderedSignalements.filter(item => item.statut === 'nouveau').length}</span>
        </button>
      </div>

      {section === 'messages' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 min-h-[520px]">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100"><div className="flex items-center justify-between"><h2 className="font-black text-slate-900">{isFrench ? 'Conversations' : 'المحادثات'}</h2><Users className="w-5 h-5 text-indigo-500" /></div><p className="text-xs text-slate-400 mt-1">{isFrench ? 'Répondez directement aux directeurs.' : 'الرد مباشرة على مديري الروضات.'}</p></div>
            <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
              {threads.length === 0 ? <div className="py-16 text-center text-slate-400"><Inbox className="w-10 h-10 mx-auto mb-3 text-slate-200" /><p className="text-sm font-bold">{isFrench ? 'Aucun message reçu.' : 'لا توجد رسائل حالياً.'}</p></div> : threads.map(item => (
                <button type="button" key={item.director.id} onClick={() => openThread(item.director.id)} className={`w-full p-3 rounded-2xl border text-start transition ${activeDirectorId === item.director.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'}`}>
                  <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0">{(item.director.prenom?.[0] || '') + (item.director.nom?.[0] || '')}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-black text-slate-900 truncate">{item.director.prenom} {item.director.nom}</p>{item.unread > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">{item.unread}</span>}</div><p className="text-[11px] text-slate-500 truncate mt-1">{item.latest?.text}</p><p className="text-[10px] text-slate-400 mt-1">{item.latest ? new Date(item.latest.timestamp).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ') : ''}</p></div></div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[520px]">
            {!activeThread ? <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400"><div><MessageCircle className="w-14 h-14 mx-auto mb-4 text-slate-200" /><h3 className="font-black text-slate-700">{isFrench ? 'Sélectionnez une conversation' : 'اختر محادثة'}</h3><p className="text-sm mt-2">{isFrench ? 'Les messages des directeurs apparaîtront ici.' : 'ستظهر رسائل مديري الروضات هنا.'}</p></div></div> : <>
              <div className="p-5 border-b border-slate-100 flex items-center gap-3"><button type="button" onClick={() => setActiveDirectorId(null)} className="xl:hidden p-2 rounded-xl hover:bg-slate-100"><ChevronLeft className="w-4 h-4 rtl:rotate-180" /></button><div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">{(activeThread.director.prenom?.[0] || '') + (activeThread.director.nom?.[0] || '')}</div><div><h2 className="font-black text-slate-900">{activeThread.director.prenom} {activeThread.director.nom}</h2><p className="text-xs text-slate-400">{activeThread.director.email || (isFrench ? 'Directeur' : 'مدير الروضة')}</p></div><ShieldCheck className="w-5 h-5 text-emerald-500 ms-auto" /></div>
              <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-slate-50/60">{activeThread.thread.map(message => { const isAdminMessage = message.senderId === user?.id || message.senderId === 'adm1'; return <div key={message.id} className={`flex flex-col ${isAdminMessage ? 'items-end' : 'items-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isAdminMessage ? 'bg-indigo-600 text-white rounded-ee-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-es-sm'}`}><p className="text-sm whitespace-pre-line">{message.text}</p><div className={`flex items-center gap-1 justify-end mt-2 text-[10px] ${isAdminMessage ? 'text-indigo-100' : 'text-slate-400'}`}><Clock3 className="w-3 h-3" />{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{isAdminMessage && <CheckCheck className="w-3 h-3" />}</div></div></div>; })}</div>
              <form onSubmit={event => { event.preventDefault(); void handleSend(); }} className="p-4 border-t border-slate-100 flex items-center gap-2"><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={isFrench ? 'Répondre au directeur...' : 'الرد على مدير الروضة...'} className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 text-sm" required /><button type="submit" disabled={sending} className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4 rtl:-scale-x-100" /></button></form>
            </>}
          </div>
        </div>
      ) : section === 'avis' ? (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">{isFrench ? 'Avis visibles par tous' : 'تقييمات مرئية للجميع'}</h2><p className="text-xs text-slate-400 mt-1">{isFrench ? 'Tous les comptes connectés peuvent publier. Vous pouvez modérer les avis ici.' : 'يمكن لكل الحسابات المتصلة نشر تقييماتها. يمكنك إدارة التقييمات هنا.'}</p></div><div className="flex items-center gap-1 text-amber-500 font-black text-sm"><Star className="w-4 h-4 fill-amber-400" /> {averageRating} / 5</div></div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{orderedAvis.length === 0 ? <div className="md:col-span-2 xl:col-span-3 py-16 text-center text-slate-400"><MessageSquareQuote className="w-12 h-12 mx-auto mb-3 text-slate-200" /><p className="font-bold">{isFrench ? 'Aucun avis pour le moment.' : 'لا توجد تقييمات حتى الآن.'}</p></div> : orderedAvis.map(item => <article key={item.id} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/70"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900 text-sm">{item.userName || item.nomCreche}</p><p className="text-[11px] text-slate-400 mt-1">{item.nomCreche}</p></div><button type="button" onClick={() => void handleDeleteAvis(item.id)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50" title={isFrench ? 'Supprimer' : 'حذف'}><Trash2 className="w-4 h-4" /></button></div><div className="flex gap-0.5 mt-3">{[0, 1, 2, 3, 4].map(index => <Star key={index} className={`w-4 h-4 ${index < item.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}</div><p className="text-sm text-slate-600 bg-white rounded-xl p-3 mt-3 min-h-20">{item.comment}</p><p className="text-[10px] text-slate-400 mt-3">{new Date(item.date).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}</p></article>)}</div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center"><Lightbulb className="w-5 h-5" /></div><div><h2 className="font-black text-slate-900">{isFrench ? 'Signalements & suggestions' : 'البلاغات والاقتراحات'}</h2><p className="text-xs text-slate-400 mt-1">{isFrench ? 'Répondez aux utilisateurs et suivez chaque retour jusqu’à sa résolution.' : 'الرد على المستخدمين ومتابعة كل ملاحظة حتى حلها.'}</p></div></div></div>
          <div className="p-5 space-y-4">{orderedSignalements.length === 0 ? <div className="py-16 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" /><p className="font-bold">{isFrench ? 'Aucun signalement ou suggestion.' : 'لا توجد بلاغات أو اقتراحات.'}</p></div> : orderedSignalements.map(item => {
            const response = responseDrafts[item.id] ?? item.reponseAdmin ?? '';
            const priority = item.priorite || 'normale';
            return <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[10px] font-black text-indigo-700">{typeLabel(item.type)}</span><span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${priority === 'urgente' ? 'bg-rose-100 text-rose-700' : priority === 'haute' ? 'bg-amber-100 text-amber-700' : priority === 'basse' ? 'bg-slate-100 text-slate-600' : 'bg-violet-100 text-violet-700'}`}>{priorityLabel(priority)}</span><span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleString(isFrench ? 'fr-FR' : 'ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}</span></div><h3 className="mt-2 text-base font-black text-slate-900">{item.titre}</h3><p className="mt-1 text-xs text-slate-500">{item.userName} · {item.nomCreche}</p></div><div className="flex shrink-0 items-center gap-2"><select value={item.statut} onChange={event => void handleStatusChange(item.id, event.target.value as SignalementStatut)} className={`rounded-xl border px-3 py-2 text-xs font-black outline-none ${item.statut === 'resolu' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.statut === 'rejete' ? 'border-rose-200 bg-rose-50 text-rose-700' : item.statut === 'en_cours' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>{signalementStatuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button type="button" onClick={() => void handleDeleteSignalement(item)} className="rounded-xl p-2 text-rose-500 hover:bg-rose-50" title={isFrench ? 'Supprimer définitivement' : 'حذف نهائي'}><Trash2 className="h-4 w-4" /></button></div></div>
              <p className="mt-4 whitespace-pre-line rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-700">{item.description}</p>
              <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-3"><label className="text-[10px] font-black uppercase tracking-wide text-slate-500">{isFrench ? 'Priorité' : 'الأولوية'}<select value={priority} onChange={event => void handleTicketUpdate(item, { priorite: event.target.value as SignalementPriorite }, 'ticket_priority_updated')} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold outline-none focus:border-indigo-500">{(['basse', 'normale', 'haute', 'urgente'] as SignalementPriorite[]).map(value => <option key={value} value={value}>{priorityLabel(value)}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-wide text-slate-500">{isFrench ? 'Responsable' : 'المسؤول'}<select value={item.assigneeId || ''} onChange={event => void handleTicketUpdate(item, event.target.value ? { assigneeId: event.target.value, assigneeName: `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Admin' } : { assigneeId: '', assigneeName: '' }, 'ticket_assigned')} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold outline-none focus:border-indigo-500"><option value="">{isFrench ? 'Non attribué' : 'غير معين'}</option>{user?.id && <option value={user.id}>{isFrench ? 'Moi (Administrateur)' : 'أنا (الإدارة)'}</option>}</select></label><label className="text-[10px] font-black uppercase tracking-wide text-slate-500">{isFrench ? 'Échéance' : 'الموعد'}<input type="date" value={item.dueAt || ''} onChange={event => void handleTicketUpdate(item, { dueAt: event.target.value || undefined }, 'ticket_due_date_updated')} className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold outline-none focus:border-indigo-500" /></label></div>
              <div className="mt-4"><label className="mb-2 flex items-center gap-2 text-xs font-black text-slate-600"><MessageSquareQuote className="h-4 w-4 text-indigo-500" />{isFrench ? 'Réponse à l’utilisateur' : 'الرد على المستخدم'}</label><div className="flex flex-col gap-2 sm:flex-row"><textarea value={response} onChange={event => setResponseDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} rows={2} placeholder={isFrench ? 'Écrire une réponse ou une indication...' : 'اكتب رداً أو توضيحاً...'} className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /><button type="button" onClick={() => void handleSaveResponse(item)} disabled={!response.trim() || savingResponseId === item.id} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 sm:self-end"><Save className="h-3.5 w-3.5" />{savingResponseId === item.id ? (isFrench ? 'Envoi...' : 'جارٍ الحفظ...') : (isFrench ? 'Enregistrer' : 'حفظ')}</button></div></div>
              {item.reponseAdmin && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-black text-emerald-700">{isFrench ? 'Réponse actuellement publiée' : 'الرد المنشور حالياً'}</p><p className="mt-1 whitespace-pre-line text-xs text-emerald-900">{item.reponseAdmin}</p></div>}
            </article>;
          })}</div>
        </div>
      )}
    </div>
  );
}
