import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { motion, AnimatePresence } from 'motion/react';

// ✅ Popup plein écran pour les annonces admin marquées "showAsPopup".
// S'affiche par-dessus tout le reste dès qu'il y a une annonce non lue,
// avec exactement les couleurs/icône choisies par l'admin dans Notifications.tsx.
// Si plusieurs annonces non lues, elles s'affichent une par une (la plus récente d'abord).
export default function NotificationPopup() {
  const { user } = useAuth();
  const { notifications, markNotificationRead } = useDb();
  const [dismissedThisSession, setDismissedThisSession] = useState<string[]>([]);

  const popupsAVoir = notifications
    .filter(n =>
      (n.recipientRole === 'all_directeurs' || n.recipientRole === user?.id) &&
      n.showAsPopup !== false &&
      !n.readBy?.includes(user?.id || '') &&
      !dismissedThisSession.includes(n.id)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const current = popupsAVoir[0];

  const handleClose = () => {
    if (!current || !user?.id) return;
    setDismissedThisSession(prev => [...prev, current.id]); // disparaît immédiatement de l'écran
    markNotificationRead(current.id, user.id); // et se marque comme lue en base
  };

  if (!current) return null;

  const bgColor = current.bgColor || '#4f46e5';
  const textColor = current.textColor || '#ffffff';
  const buttonColor = current.buttonColor || '#ffffff';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="w-full max-w-sm rounded-3xl shadow-2xl p-7 text-center"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          <div className="text-5xl mb-4">{current.icon || '📢'}</div>
          <h3 className="font-black text-xl mb-2.5 break-words">{current.title}</h3>
          <p className="text-sm opacity-90 leading-relaxed break-words whitespace-pre-line">
            {current.message}
          </p>
          <button
            onClick={handleClose}
            className="mt-6 w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: buttonColor }}
          >
            Compris
          </button>
          {popupsAVoir.length > 1 && (
            <p className="text-[11px] opacity-70 mt-3">
              +{popupsAVoir.length - 1} autre{popupsAVoir.length - 1 > 1 ? 's' : ''} annonce{popupsAVoir.length - 1 > 1 ? 's' : ''} après celle-ci
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
