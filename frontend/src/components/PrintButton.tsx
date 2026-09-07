import { PrinterIcon } from '@heroicons/react/24/outline';

/** Prints the current page using the print stylesheet (nav and controls hidden). */
export default function PrintButton({ label = 'Print report' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-navy-700 dark:hover:text-navy-100 dark:text-navy-200 transition-colors"
    >
      <PrinterIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
