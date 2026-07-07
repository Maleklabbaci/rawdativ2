import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { Megaphone, Send, Trash2, Users, CheckCheck } from 'lucide-react';

export default function Notifications() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { notifications, comptes, addNotification, deleteNotification } = useDb();
  const isFrench = language === 'fr';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const directeurs = comptes.filter(c => c.role === 'directeur');

  const mesAnnonces = [...notifications]
    .filter(n => n.recipientRole === 'all_directeurs')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      await addNotification({
        title: title.trim(),
        message: message.trim(),
        recipientRole: 'all_directeurs',
        senderName: user?.prenom ? `${user.prenom} ${user.nom}` : 'Admin',
        createdAt: new Date().toISOString(),
        readBy: [],
      });
      setTitle('');
      setMessage('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Erreur envoi notification:', err);
      alert(isFrench ? 'Échec de l\'envoi.' : 'فشل الإرسال.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmText = isFrench ? 'Supprimer cette annonce ?' : 'حذف هذا الإعلان؟';
    if (window.confirm(confirmText)) {
      await deleteNotification(id);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
          <Megaphone className="w-7 h-7 text-indigo-600" />
          {isFrench ? 'Notifications' : 'الإشعارات'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isFrench
            ? `Envoie une annonce à tous les directeurs de crèches (${directeurs.length} destinataire${directeurs.length > 1 ? 's' : ''}).`
            : `أرسل إعلاناً إلى جميع مديري الروضات (${directeurs.length} مستلم).`}
        </p>
      </div>

      {/* Formulaire de composition */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
            {isFrench ? 'Titre' : 'العنوان'}
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={isFrench ? 'Ex : Maintenance prévue ce soir' : 'مثال: صيانة مقررة هذا المساء'}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
            {isFrench ? 'Message' : 'الرسالة'}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder={isFrench ? 'Détaille ton annonce ici...' : 'اكتب تفاصيل الإعلان هنا...'}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium text-slate-800 resize-none"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <Send className="w-4 h-4" />
          {sending ? (isFrench ? 'Envoi...' : 'جارٍ الإرسال...') : (isFrench ? 'Envoyer à tous les directeurs' : 'إرسال لجميع المديرين')}
        </button>
        {success && (
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
            <CheckCheck className="w-4 h-4" /> {isFrench ? 'Annonce envoyée !' : 'تم إرسال الإعلان!'}
          </p>
        )}
      </div>

      {/* Historique des annonces envoyées */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            {isFrench ? 'Historique des annonces' : 'سجل الإعلانات'}
          </h2>
        </div>
        {mesAnnonces.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            {isFrench ? 'Aucune annonce envoyée pour le moment.' : 'لا توجد إعلانات مرسلة بعد.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {mesAnnonces.map(n => {
              const readCount = directeurs.filter(d => n.readBy?.includes(d.id)).length;
              return (
                <div key={n.id} className="px-5 sm:px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {readCount}/{directeurs.length} {isFrench ? 'lue(s)' : 'قرأها'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
