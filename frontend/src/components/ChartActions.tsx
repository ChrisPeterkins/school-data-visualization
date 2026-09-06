import { useRef, useState, type ReactNode } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { downloadChartPng } from '../lib/chartExport';
import { useT } from '../i18n';

/** Wraps a chart and adds a "Download PNG" button in its corner. */
export default function ChartActions({ filename, title, children, className = '' }: { filename: string; title?: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={async () => { if (!ref.current) return; setBusy(true); try { await downloadChartPng(ref.current, filename, title); } finally { setBusy(false); } }}
        className="absolute right-0 -top-8 sm:-top-9 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-stone-500 hover:text-navy-700 hover:bg-stone-100 print:hidden"
        title={t('chart.png')}
        disabled={busy}
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />{t('chart.png')}
      </button>
      <div ref={ref}>{children}</div>
    </div>
  );
}
