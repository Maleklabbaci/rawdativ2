import { useLanguage } from '../contexts/LanguageContext';

export default function PageSkeleton() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      aria-busy="true"
      aria-label={isArabic ? 'جارٍ تحميل الصفحة…' : 'Chargement de la page…'}
      className="animate-pulse space-y-5 py-1"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-28 rounded-full bg-indigo-100/80" />
          <div className="h-7 w-56 rounded-xl bg-slate-200/80" />
        </div>
        <div className="h-10 w-36 rounded-2xl bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {[0, 1, 2, 3].map(idx => (
          <div
            key={idx}
            className="h-24 rounded-2xl border border-slate-100 bg-white p-4 shadow-2xs space-y-3"
          >
            <div className="h-8 w-8 rounded-xl bg-slate-100" />
            <div className="h-4 w-20 rounded-lg bg-slate-200/70" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-2xs space-y-3">
        <div className="h-10 w-full rounded-xl bg-slate-100/90" />
        <div className="h-16 w-full rounded-2xl bg-slate-50" />
        <div className="h-16 w-full rounded-2xl bg-slate-50" />
        <div className="h-16 w-full rounded-2xl bg-slate-50" />
      </div>
    </div>
  );
}
