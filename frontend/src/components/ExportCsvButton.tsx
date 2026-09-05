import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { downloadCsv } from '../lib/csv';

interface ExportCsvButtonProps {
  filename: string;
  rows: Array<Record<string, unknown>>;
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
      onClick={() => downloadCsv(filename, rows, columns)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-navy-700 transition-colors ${className}`}
    >
      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
