import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { downloadCsv } from '../lib/csv';

interface ExportCsvButtonProps {
  filename: string;
  rows: ReadonlyArray<object>;
  columns?: Array<{ key: string; label: string }>;
  label?: string;
  className?: string;
}

/** Small "Export CSV" action for any table; hidden when there is nothing to export. */
export default function ExportCsvButton({ filename, rows, columns, label = 'Export CSV', className = '' }: ExportCsvButtonProps) {
  if (!rows.length) return null;
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows as Array<Record<string, unknown>>, columns)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-navy-700 dark:hover:text-navy-100 dark:text-navy-200 transition-colors ${className}`}
    >
      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
