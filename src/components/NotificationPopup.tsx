import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { motion, AnimatePresence } from 'motion/react';

// ✅ Popup plein écran pour les annonces admin marquées "showAsPopup".
// S'affiche par-dessus tout le reste dès qu'il y a une annonce non lue,
// avec exactement les couleurs/icône choisies par l'admin dans Notifications.tsx.
// Si plusieurs annonces non lues, elles s'affichent une par une (la plus récente d'abord).
//
// ✅ Répétition forcée : si l'admin a défini repeatCount > 0, fermer le popup ne le
// marque PAS comme lu tout de suite — il réapparaît automatiquement après
// repeatIntervalSeconds, jusqu'à épuisement du compteur. Seule la dernière fermeture
// marque réellement l'annonce comme lue.
//
// onNavigate : callback fourni par App.tsx pour que le bouton CTA (si ctaType === 'page')
// puisse changer de page dans l'appli.
export default function NotificationPopup({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useAuth();
  const { notifications, markNotificationRead } = useDb();
  const [dismissedThisSession, setDismissedThisSession] = useState<string[]>([]);
  const [hiddenTemporarily, setHiddenTemporarily] = useState<string[]>([]);
  const repeatsLeftRef = useRef<Record<string, number>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const popupsAVoir = notifications
    .filter(n =>
      (n.recipientRole === 'all_directeurs' || n.recipientRole === user?.id) &&
      n.showAsPopup !== false &&
      !n.readBy?.includes(user?.id || '') &&
      !dismissedThisSession.includes(n.id) &&
      !hiddenTemporarily.includes(n.id)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const current = popupsAVoir[0];

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
  }, []);

  const handleClose = () => {
    if (!current || !user?.id) return;

    if (repeatsLeftRef.current[current.id] === undefined) {
      repeatsLeftRef.current[current.id] = current.repeatCount || 0;
    }

    if (repeatsLeftRef.current[current.id] > 0) {
      repeatsLeftRef.current[current.id] -= 1;
      setHiddenTemporarily(prev => [...prev, current.id]);
      const delayMs = (current.repeatIntervalSeconds || 10) * 1000;
      timersRef.current[current.id] = setTimeout(() => {
        setHiddenTemporarily(prev => prev.filter(id => id !== current.id));
      }, delayMs);
    } else {
      setDismissedThisSession(prev => [...prev, current.id]);
      markNotificationRead(current.id, user.id);
    }
  };

  const handleCta = () => {
    if (!current || !user?.id) return;
    if (current.ctaType === 'link' && current.ctaUrl) {
      window.open(current.ctaUrl, '_blank', 'noopener,noreferrer');
    } else if (current.ctaType === 'page' && current.ctaPage && onNavigate) {
      onNavigate(current.ctaPage);
    }
    setDismissedThisSession(prev => [...prev, current.id]);
    markNotificationRead(current.id, user.id);
  };

  if (!current) return null;

  const bgColor = current.bgColor || '#4f46e5';
  const textColor = current.textColor || '#ffffff';
  const buttonColor = current.buttonColor || '#ffffff';
  const repeatsLeft = repeatsLeftRef.current[current.id] ?? (current.repeatCount || 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-3xl p-5 text-center shadow-2xl sm:p-7"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          <div className="text-5xl mb-4">{current.icon || '📢'}</div>
          <h3 className="font-black text-xl mb-2.5 break-words">{current.title}</h3>
          <p className="text-sm opacity-90 leading-relaxed break-words whitespace-pre-line">
            {current.message}
          </p>

          {current.ctaLabel && (
            <button
              onClick={handleCta}
              className="mt-5 w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition hover:opacity-90"
              style={{ backgroundColor: buttonColor, color: bgColor }}
            >
              {current.ctaLabel}
            </button>
          )}

          <button
            onClick={handleClose}
            className="mt-3 w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: buttonColor }}
          >
            Compris
          </button>

          {repeatsLeft > 0 && (
            <p className="text-[11px] opacity-70 mt-3">
              Ce message réapparaîtra {repeatsLeft} fois de plus
            </p>
          )}
          {popupsAVoir.length > 1 && (
            <p className="text-[11px] opacity-70 mt-1">
              +{popupsAVoir.length - 1} autre{popupsAVoir.length - 1 > 1 ? 's' : ''} annonce{popupsAVoir.length - 1 > 1 ? 's' : ''} après celle-ci
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
