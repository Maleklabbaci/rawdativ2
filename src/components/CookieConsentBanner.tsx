import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { buildLegalHref, LEGAL_CONFIG } from '../config/legal';

export default function CookieConsentBanner() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LEGAL_CONFIG.cookieNoticeStorageKey);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  const acknowledgeEssentialOnly = () => {
    try {
      window.localStorage.setItem(LEGAL_CONFIG.cookieNoticeStorageKey, 'essential_only');
    } catch {
      // Ignore storage quota / private mode restrictions
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label={isAr ? 'إشعار ملفات الارتباط والتخزين المحلي' : 'Information sur les cookies et le stockage local'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-slate-200 bg-white/98 p-3.5 text-slate-800 shadow-lg backdrop-blur sm:inset-x-auto sm:end-5 sm:bottom-5 sm:w-full sm:max-w-md sm:p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <p className="text-xs leading-5 text-slate-600">
            {isAr
              ? 'تستخدم Rawdha+ تخزيناً تقنياً ضرورياً فقط لحفظ جلستكم ولغة العرض، دون أي ملفات تتبع إعلانية.'
              : 'Rawdha+ utilise uniquement un stockage technique strictement nécessaire (session sécurisée et langue), sans cookie publicitaire ni traqueur tiers.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={acknowledgeEssentialOnly}
              className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 cursor-pointer"
            >
              {isAr ? 'فهمت (الضرورية فقط)' : 'Compris (essentiels uniquement)'}
            </button>
            <a
              href={buildLegalHref('cookies')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {isAr ? 'التفاصيل' : 'En savoir plus'}
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
