// Style Rawdha+ : assistant compact et contextuel, toujours disponible sans surcharger la navigation principale.
import { useEffect, useRef, useState } from 'react';
import { Bot, CircleHelp, ClipboardList, Headset, MessageSquareQuote, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SupportBubbleProps = {
  currentPage: string;
  onNavigate: (page: 'aide' | 'demarrage' | 'support') => void;
};

const pageGuidance: Record<string, { fr: string; ar: string }> = {
  enfants: { fr: 'Besoin de mettre à jour un dossier enfant ?', ar: 'هل تحتاجين إلى تحديث ملف طفل؟' },
  presences: { fr: 'Besoin d’aide pour le pointage quotidien ?', ar: 'هل تحتاجين مساعدة في الحضور اليومي؟' },
  paiements: { fr: 'Besoin d’aide pour une facture ou un règlement ?', ar: 'هل تحتاجين مساعدة في فاتورة أو دفع؟' },
  achats: { fr: 'Besoin d’aide pour suivre les dépenses ?', ar: 'هل تحتاجين مساعدة في متابعة المصاريف؟' },
  parametres: { fr: 'Besoin de retrouver un réglage ?', ar: 'هل تحتاجين إلى العثور على إعداد؟' },
};

export default function SupportBubble({ currentPage, onNavigate }: SupportBubbleProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const guidance = pageGuidance[currentPage] || {
    fr: 'Une question sur votre gestion ?',
    ar: 'هل لديك سؤال حول التسيير؟',
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const choose = (page: 'aide' | 'demarrage' | 'support') => {
    setOpen(false);
    onNavigate(page);
  };

  return (
    <div ref={panelRef} className={`fixed bottom-4 z-40 sm:bottom-6 ${isArabic ? 'left-4 sm:left-6' : 'right-4 sm:right-6'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      {open && (
        <section className="mb-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl shadow-indigo-950/15">
          <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-white">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15"><Bot className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-black">{isArabic ? 'مساعد Rawdha+' : 'Assistant Rawdha+'}</p>
                <p className="mt-0.5 text-[11px] font-medium text-indigo-100">{isArabic ? guidance.ar : guidance.fr}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-indigo-100 transition hover:bg-white/10 hover:text-white" aria-label={isArabic ? 'إغلاق المساعد' : 'Fermer l’assistant'}><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1 p-2">
            <button type="button" onClick={() => choose('aide')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700">
              <CircleHelp className="h-4 w-4 text-indigo-600" />{isArabic ? 'الدليل السريع' : 'Guide rapide'}
            </button>
            <button type="button" onClick={() => choose('demarrage')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700">
              <ClipboardList className="h-4 w-4 text-indigo-600" />{isArabic ? 'مراجعة إعداد البداية' : 'Revoir le démarrage'}
            </button>
            <button type="button" onClick={() => choose('support')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700">
              <Headset className="h-4 w-4 text-emerald-600" />{isArabic ? 'مراسلة الدعم' : 'Contacter le support'}
            </button>
          </div>
          <div className="border-t border-slate-100 px-4 py-2.5 text-[10px] font-semibold text-slate-400"><MessageSquareQuote className="mr-1 inline h-3 w-3 text-indigo-400 rtl:ml-1 rtl:mr-0" />{isArabic ? 'اقتراح أو مشكلة؟ اكتبيلنا مباشرة.' : 'Une question ou un souci ? Écrivez-nous directement.'}</div>
        </section>
      )}
      <button type="button" onClick={() => setOpen(value => !value)} className={`group flex h-14 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-[0.97] ${open ? 'ring-4 ring-indigo-100' : ''}`} aria-expanded={open} aria-label={isArabic ? 'فتح مساعد Rawdha+' : 'Ouvrir l’assistant Rawdha+'}>
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5 transition group-hover:scale-110" />}
        <span className="text-xs font-black">{isArabic ? 'مساعدة' : 'Aide'}</span>
      </button>
    </div>
  );
}
