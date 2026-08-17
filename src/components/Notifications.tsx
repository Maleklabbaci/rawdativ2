import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { Megaphone, Send, Trash2, Users, CheckCheck, Palette, Eye } from 'lucide-react';

const PRESET_COLORS = [
  { bg: '#4f46e5', text: '#ffffff', btn: '#ffffff' }, // Indigo (défaut)
  { bg: '#e11d48', text: '#ffffff', btn: '#ffffff' }, // Rouge (urgent)
  { bg: '#059669', text: '#ffffff', btn: '#ffffff' }, // Vert (bonne nouvelle)
  { bg: '#d97706', text: '#ffffff', btn: '#ffffff' }, // Orange (avertissement)
  { bg: '#0f172a', text: '#ffffff', btn: '#818cf8' }, // Noir/slate (premium)
  { bg: '#ffffff', text: '#0f172a', btn: '#4f46e5' }, // Blanc épuré
];

const PRESET_ICONS = ['📢', '🎉', '⚠️', '✅', '💡', '🔧', '🎁', '📅'];

export default function Notifications() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { notifications, comptes, addNotification, deleteNotification } = useDb();
  const isFrench = language === 'fr';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [bgColor, setBgColor] = useState('#4f46e5');
  const [textColor, setTextColor] = useState('#ffffff');
  const [buttonColor, setButtonColor] = useState('#ffffff');
  const [icon, setIcon] = useState('📢');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // ✅ Destinataire : tous les directeurs, ou un seul en particulier
  const [recipientId, setRecipientId] = useState('all_directeurs');

  // ✅ Bouton d'action optionnel dans le popup
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaType, setCtaType] = useState<'link' | 'page'>('link');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaPage, setCtaPage] = useState('paiements');

  const directeurs = comptes.filter(c => c.role === 'directeur');

  const mesAnnonces = [...notifications]
    .filter(n => n.recipientRole === 'all_directeurs' || directeurs.some(d => d.id === n.recipientRole))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    setBgColor(preset.bg);
    setTextColor(preset.text);
    setButtonColor(preset.btn);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      await addNotification({
        title: title.trim(),
        message: message.trim(),
        recipientRole: recipientId,
        senderName: user?.prenom ? `${user.prenom} ${user.nom}` : 'Admin',
        createdAt: new Date().toISOString(),
        readBy: [],
        bgColor,
        textColor,
        buttonColor,
        icon,
        showAsPopup: false,
        ...(ctaLabel.trim() ? {
          ctaLabel: ctaLabel.trim(),
          ctaType,
          ...(ctaType === 'link' ? { ctaUrl: ctaUrl.trim() } : { ctaPage }),
        } : {}),
      });
      setTitle('');
      setMessage('');
      setCtaLabel('');
      setCtaUrl('');
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Formulaire de composition + personnalisation --- */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
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

          {/* --- Personnalisation visuelle --- */}
          <div className="pt-1 border-t border-slate-100">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase mb-3 mt-4">
              <Palette className="w-3.5 h-3.5 text-indigo-500" />
              {isFrench ? 'Style du popup' : 'تصميم النافذة'}
            </label>

            {/* Palettes prédéfinies */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(p)}
                  className="w-9 h-9 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 cursor-pointer hover:scale-110 transition"
                  style={{ backgroundColor: p.bg }}
                  title={isFrench ? 'Appliquer ce thème' : 'تطبيق هذا النمط'}
                />
              ))}
            </div>

            {/* Contrôles fins : couleurs exactes */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isFrench ? 'Fond' : 'الخلفية'}
                </label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={e => setBgColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isFrench ? 'Texte' : 'النص'}
                </label>
                <input
                  type="color"
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  {isFrench ? 'Bouton' : 'الزر'}
                </label>
                <input
                  type="color"
                  value={buttonColor}
                  onChange={e => setButtonColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                />
              </div>
            </div>

            {/* Icône */}
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
              {isFrench ? 'Icône' : 'الأيقونة'}
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESET_ICONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 cursor-pointer transition ${
                    icon === ic ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {ic}
                </button>
              ))}
              <input
                type="text"
                value={icon}
                onChange={e => setIcon(e.target.value.slice(0, 4))}
                className="w-16 h-10 text-center text-lg rounded-xl border-2 border-slate-100 outline-none focus:border-indigo-500"
                placeholder="✨"
              />
            </div>

            <p className="text-xs leading-5 text-slate-500">
              {isFrench
                ? 'Les annonces sont publiées dans la page Notifications des directeurs.'
                : 'تظهر الإعلانات في صفحة الإشعارات الخاصة بالمديرين.'}
            </p>
          </div>

          {/* ✅ Destinataire */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {isFrench ? 'Destinataire' : 'المستلم'}
            </label>
            <select
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
            >
              <option value="all_directeurs">
                {isFrench ? `Tous les directeurs (${directeurs.length})` : `جميع المديرين (${directeurs.length})`}
              </option>
              {directeurs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.prenom} {d.nom} — {d.nomCreche || d.email}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton d'action optionnel dans la notification */}
          <div className="border border-slate-100 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              {isFrench ? "Bouton d'action (optionnel)" : 'زر إجراء (اختياري)'}
            </label>
            <input
              type="text"
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder={isFrench ? 'Ex: Payer maintenant, Voir mes factures...' : 'مثال: ادفع الآن'}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
            />
            {ctaLabel.trim() && (
              <>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input type="radio" checked={ctaType === 'link'} onChange={() => setCtaType('link')} className="accent-indigo-600" />
                    {isFrench ? 'Lien externe (WhatsApp, site...)' : 'رابط خارجي'}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input type="radio" checked={ctaType === 'page'} onChange={() => setCtaType('page')} className="accent-indigo-600" />
                    {isFrench ? 'Page de l\'app' : 'صفحة في التطبيق'}
                  </label>
                </div>
                {ctaType === 'link' ? (
                  <input
                    type="text"
                    value={ctaUrl}
                    onChange={e => setCtaUrl(e.target.value)}
                    placeholder="https://wa.me/213..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                  />
                ) : (
                  <select
                    value={ctaPage}
                    onChange={e => setCtaPage(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                  >
                    <option value="paiements">{isFrench ? 'Paiements' : 'المدفوعات'}</option>
                    <option value="enfants">{isFrench ? 'Enfants' : 'الأطفال'}</option>
                    <option value="parametres">{isFrench ? 'Paramètres' : 'الإعدادات'}</option>
                  </select>
                )}
              </>
            )}
          </div>


          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <Send className="w-4 h-4" />
            {sending ? (isFrench ? 'Envoi...' : 'جارٍ الإرسال...') : (isFrench ? 'Envoyer' : 'إرسال')}
          </button>
          {success && (
            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" /> {isFrench ? 'Annonce envoyée !' : 'تم إرسال الإعلان!'}
            </p>
          )}
        </div>

        {/* --- Aperçu en direct --- */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase mb-4">
            <Eye className="w-3.5 h-3.5 text-indigo-500" />
            {isFrench ? 'Aperçu — exactement ce que le directeur verra' : 'معاينة — بالضبط كما سيراها المدير'}
          </label>
          <div className="bg-slate-100 rounded-2xl p-8 flex items-center justify-center min-h-[280px]">
            <div
              className="w-full max-w-xs rounded-2xl shadow-2xl p-6 text-center"
              style={{ backgroundColor: bgColor, color: textColor }}
            >
              <div className="text-4xl mb-3">{icon || '📢'}</div>
              <h3 className="font-black text-lg mb-2 break-words">{title || (isFrench ? 'Titre de ton annonce' : 'عنوان الإعلان')}</h3>
              <p className="text-sm opacity-90 leading-relaxed break-words">
                {message || (isFrench ? 'Le message de ton annonce apparaîtra ici...' : 'ستظهر رسالتك هنا...')}
              </p>
              <button
                className="mt-5 w-full py-2.5 rounded-xl font-bold text-sm cursor-default"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: buttonColor }}
              >
                {isFrench ? 'Compris' : 'حسناً'}
              </button>
            </div>
          </div>
        </div>
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
              const isTargeted = n.recipientRole !== 'all_directeurs';
              const targetDir = isTargeted ? directeurs.find(d => d.id === n.recipientRole) : null;
              const readCount = isTargeted
                ? (n.readBy?.includes(n.recipientRole) ? 1 : 0)
                : directeurs.filter(d => n.readBy?.includes(d.id)).length;
              const totalCount = isTargeted ? 1 : directeurs.length;
              return (
                <div key={n.id} className="px-5 sm:px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: n.bgColor || '#4f46e5' }}
                    >
                      {n.icon || '📢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {readCount}/{totalCount} {isFrench ? 'lue(s)' : 'قرأها'}
                        </span>
                        {isTargeted && (
                          <span className="text-[10px] font-bold text-slate-400">
                            → {targetDir ? `${targetDir.prenom} ${targetDir.nom}` : n.recipientRole}
                          </span>
                        )}
                      </div>
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
