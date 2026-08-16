import { Check, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  const icons = {
    success: <Check className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />
  };

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900'
  };

  return (
    <div className="fixed inset-x-3 top-4 z-[9999] space-y-2 pointer-events-none sm:left-auto sm:right-4 sm:inset-x-auto">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, x: 400 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 400 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`flex w-full max-w-[min(28rem,calc(100vw-1.5rem))] items-start gap-3 break-words px-4 py-3 rounded-lg border shadow-lg pointer-events-auto ${colors[toast.type]}`}
          >
            {icons[toast.type]}
            <span className="min-w-0 flex-1 text-sm font-medium leading-relaxed">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto p-1 hover:bg-black/10 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
