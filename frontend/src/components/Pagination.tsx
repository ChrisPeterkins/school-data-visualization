import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useIsSmUp } from '../hooks/useMediaQuery';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const smUp = useIsSmUp();
  const pages = [];
  // Phones get 3 numbered pages so first/last + arrows still fit on one row.
  const maxVisible = smUp ? 5 : 3;

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-between gap-2 py-4" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="inline-flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      <div className="flex items-center gap-1">
        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-8 h-8 sm:w-9 sm:h-9 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-stone-500">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`w-8 h-8 sm:w-9 sm:h-9 text-sm font-medium rounded-lg transition-colors ${
              page === currentPage
                ? 'bg-navy-700 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {page}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-stone-500">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-8 h-8 sm:w-9 sm:h-9 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="inline-flex items-center gap-1 px-2 sm:px-3 py-2 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </nav>
  );
}
