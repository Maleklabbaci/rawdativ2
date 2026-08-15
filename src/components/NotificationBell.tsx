import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { Bell, Megaphone, CreditCard, X, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ✅ Cloche de notifications pour le directeur :
//    - Section "Annonces" : messages envoyés par l'admin (diffusion ou ciblés)
//    - Section "Paiements en attente" : dérivée EN DIRECT des factures non payées
//      (pas de stockage séparé -> disparaît automatiquement dès que la facture
//      passe à "Payé", exactement comme demandé)
export default function NotificationBell({ onNavigateToPaiements }: { onNavigateToPaiements: () => void }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { notifications, paiements, enfants, markNotificationRead } = useDb();
  const isFrench = language === 'fr';
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Annonces destinées à ce directeur (diffusion générale ou ciblée sur lui)
  const mesAnnonces = notifications
    .filter(n => n.recipientRole === 'all_directeurs' || n.recipientRole === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const annoncesNonLues = mesAnnonces.filter(n => !n.readBy?.includes(user?.id || ''));

  // Les anciennes annonces de démonstration ne doivent pas apparaître telles quelles
  // dans une interface professionnelle. On conserve l'annonce mais on présente un
  // texte neutre côté directrice, sans réécrire la donnée Supabase.
  const displayAnnonce = (notification: (typeof mesAnnonces)[number]) => {
    const legacyText = `${notification.title} ${notification.message}`.toLowerCase();
    if (legacyText.includes('siteweb') || legacyText.includes('si ta pas')) {
      return {
        title: isFrench ? 'Information de la plateforme' : 'معلومة من المنصة',
        message: isFrench
          ? 'La plateforme Rawdha+ est disponible pour vous accompagner dans la gestion de votre crèche.'
          : 'منصة Rawdha+ متاحة لمساعدتكم في تسيير الحضانة.',
      };
    }
    return { title: notification.title, message: notification.message };
  };

  // Paiements non réglés de ses propres enfants -> reste visible tant que non payé
  const paiementsEnAttente = paiements
    .filter(p => p.statut !== 'Payé')
    .map(p => ({ paiement: p, enfant: enfants.find(e => e.id === p.enfantId) }))
    .filter(x => x.enfant); // ignore si l'enfant lié n'existe plus

  // Le badge correspond aux éléments réellement visibles dans le panneau :
  // annonces + paiements à traiter, et non uniquement aux annonces non lues.
  const totalBadge = mesAnnonces.length + paiementsEnAttente.length;

  // Ferme le popup si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenAnnonce = (id: string) => {
    if (user?.id) markNotificationRead(id, user.id);
  };

  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0) {
      const futureDays = Math.ceil(Math.abs(diffMs) / 86400000);
      return isFrench ? `Dans ${futureDays}j` : `بعد ${futureDays} يوم`;
    }
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return isFrench ? 'À l\'instant' : 'الآن';
    if (diffH < 24) return isFrench ? `Il y a ${diffH}h` : `منذ ${diffH} س`;
    const diffJ = Math.floor(diffH / 24);
    return isFrench ? `Il y a ${diffJ}j` : `منذ ${diffJ} يوم`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex-shrink-0"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute ltr:right-0 rtl:left-0 mt-2 w-80 sm:w-96 max-h-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-sm text-slate-800">
                  {isFrench ? 'Notifications' : 'الإشعارات'}
                </h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  {totalBadge} {isFrench ? (totalBadge > 1 ? 'éléments visibles' : 'élément visible') : 'عناصر ظاهرة'}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Section Annonces admin */}
              {mesAnnonces.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">
                      {isFrench ? 'Annonces' : 'إعلانات'}
                    </span>
                  </div>
                  {mesAnnonces.map(n => {
                    const isRead = n.readBy?.includes(user?.id || '');
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleOpenAnnonce(n.id)}
                        className={`w-full text-left rtl:text-right px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer block ${!isRead ? 'bg-indigo-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                          <div className={!isRead ? '' : 'ltr:pl-3.5 rtl:pr-3.5'}>
                            <p className="text-xs font-bold text-slate-800">{displayAnnonce(n).title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{displayAnnonce(n).message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Section Paiements en attente (dérivée en direct, disparaît si payé) */}
              {paiementsEnAttente.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                      {isFrench ? 'Paiements en attente' : 'مدفوعات معلقة'}
                    </span>
                  </div>
                  {paiementsEnAttente.map(({ paiement, enfant }) => (
                    <button
                      key={paiement.id}
                      onClick={() => { setIsOpen(false); onNavigateToPaiements(); }}
                      className="w-full text-left rtl:text-right px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer block"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {enfant?.prenom} {enfant?.nom}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {paiement.moisConcerne} — {paiement.montant.toLocaleString()} DA
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0 ${
                          paiement.statut === 'Retard' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {paiement.statut}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {mesAnnonces.length === 0 && paiementsEnAttente.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <CheckCheck className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-500">
                    {isFrench ? 'Tout est à jour, rien à signaler !' : 'كل شيء على ما يرام!'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
