import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  if (!items || items.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 text-sm mb-4 overflow-x-auto pb-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
      {/* Home icon */}
      {items[0] && (
        <>
          <button
            onClick={items[0].onClick}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 whitespace-nowrap transition"
          >
            <Home className="w-4 h-4" />
            <span>{isArabic ? 'الرئيسية' : 'Accueil'}</span>
          </button>
          
          {items.length > 1 && (
            <ChevronRight className={`w-4 h-4 text-slate-300 flex-shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
          )}
        </>
      )}

      {/* Breadcrumb items */}
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}
        >
          <button
            onClick={item.onClick}
            className={`whitespace-nowrap transition ${
              item.active
                ? 'text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
          
          {index < items.length - 1 && (
            <ChevronRight className={`w-4 h-4 text-slate-300 flex-shrink-0 ${isArabic ? 'rotate-180' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}
