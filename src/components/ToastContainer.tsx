import { Check, AlertCircle, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const tones = {
    success: {
      icon: <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />,
      badge: 'bg-emerald-50 ring-1 ring-inset ring-emerald-200/80',
      card: 'bg-white/98 border-slate-200/90 text-slate-900',
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600 stroke-[2.2]" />,
      badge: 'bg-rose-50 ring-1 ring-inset ring-rose-200/80',
      card: 'bg-white/98 border-rose-200/90 text-slate-900',
    },
    info: {
      icon: <Bell className="w-3.5 h-3.5 text-indigo-600 stroke-[2.2]" />,
      badge: 'bg-indigo-50 ring-1 ring-inset ring-indigo-200/80',
      card: 'bg-white/98 border-slate-200/90 text-slate-900',
    },
  };

  return (
    <div className="fixed inset-x-3 top-2.5 z-[9999] flex flex-col items-center sm:items-end gap-2 pointer-events-none sm:inset-x-auto sm:end-4">
      <AnimatePresence>
        {toasts.map(toast => {
          const style = tones[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`flex w-full max-w-[min(24rem,calc(100vw-1.5rem))] items-center gap-2.5 px-3 py-2.5 rounded-2xl border shadow-xl shadow-slate-900/10 backdrop-blur-md pointer-events-auto ${style.card}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${style.badge}`}>
                {style.icon}
              </span>
              <span className="min-w-0 flex-1 text-xs font-semibold leading-snug truncate sm:whitespace-normal sm:line-clamp-2">
                {toast.message}
              </span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Fermer / إغلاق"
                className="min-h-7! min-w-7 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
