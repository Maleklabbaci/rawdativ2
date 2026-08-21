import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLanguage } from './LanguageContext';

type ConfirmVariant = 'danger' | 'primary';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setDialog(options);
    });
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialog, close]);

  useEffect(() => () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const title = dialog?.title || (isArabic ? 'تأكيد العملية' : 'Confirmer l’opération');
  const message = dialog?.message || '';
  const cancelLabel = dialog?.cancelLabel || (isArabic ? 'إلغاء' : 'Annuler');
  const confirmLabel = dialog?.confirmLabel || (isArabic ? 'تأكيد' : 'Confirmer');
  const variant = dialog?.variant || 'primary';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rawdha-confirm-title"
            aria-describedby="rawdha-confirm-message"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <h2 id="rawdha-confirm-title" className="text-lg font-black text-slate-900">
              {title}
            </h2>
            <p id="rawdha-confirm-message" className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
              {message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirmDialog must be used within ConfirmProvider');
  return context;
}
