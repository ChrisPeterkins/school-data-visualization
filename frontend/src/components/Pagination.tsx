import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = [];
  const maxVisible = 5;

  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-between py-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Previous
      </button>

      <div className="flex items-center gap-1">
        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-9 h-9 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-stone-400">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
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
            {end < totalPages - 1 && <span className="px-1 text-stone-400">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-9 h-9 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
      >
        Next
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </nav>
  );
}
