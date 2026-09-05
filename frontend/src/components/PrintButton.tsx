import { PrinterIcon } from '@heroicons/react/24/outline';

/** Prints the current page using the print stylesheet (nav and controls hidden). */
export default function PrintButton({ label = 'Print report' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-navy-700 transition-colors"
    >
      <PrinterIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
