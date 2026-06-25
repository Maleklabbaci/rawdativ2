import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], itemsPerPage: number = 50) {
  const [currentPage, setCurrentPage] = useState(1);

  // Only recalculate when items or page changes
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    paginatedItems,
    currentPage,
    totalPages,
    goToPage,
    itemsPerPage,
    totalItems: items.length
  };
}
