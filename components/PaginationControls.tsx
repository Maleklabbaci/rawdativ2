import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}: PaginationControlsProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Determine which page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);
    
    let startPage = Math.max(2, currentPage - 2);
    let endPage = Math.min(totalPages - 1, currentPage + 2);

    if (startPage > 2) pages.push('...');
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex items-center justify-between p-4 border-t bg-slate-50 ${isArabic ? 'flex-row-reverse' : ''}`}>
      {/* Info text */}
      <span className="text-sm text-slate-600">
        {isArabic
          ? `العناصر ${endItem} - ${startItem} من ${totalItems}`
          : `Affichage ${startItem}-${endItem} sur ${totalItems}`}
      </span>

      {/* Controls */}
      <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          aria-label={isArabic ? 'الصفحة السابقة' : 'Page précédente'}
        >
          <ChevronLeft className={`w-5 h-5 ${isArabic ? 'rotate-180' : ''}`} />
        </button>

        {/* Page numbers */}
        <div className={`flex items-center gap-1 ${isArabic ? 'flex-row-reverse' : ''}`}>
          {pageNumbers.map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-slate-400">...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page as number)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold transition ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white'
                      : 'border hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 border rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          aria-label={isArabic ? 'الصفحة التالية' : 'Page suivante'}
        >
          <ChevronRight className={`w-5 h-5 ${isArabic ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
