import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useT } from '../i18n';

interface DataIndex { generatedAfterImport: number | null; tables: Array<{ table: string; note: string; rows: number; years: number[]; url: string }>; entityExports: string[] }

/** Bulk downloads: one CSV per table and year, plus per-entity exports. */
export default function DataPage() {
  const t = useT();
  useDocumentTitle(t('data.title'), t('data.sub'));
  const { data, isLoading } = useQuery({ queryKey: ['data-index'], queryFn: async () => (await api.get<DataIndex>('/api/data')).data, staleTime: 60 * 60 * 1000 });
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{t('data.title')}</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 max-w-3xl">{t('data.sub')} <Link to="/about" className="text-navy-600 dark:text-navy-300 underline">{t('nav.about')}</Link> · <a href="/paschools/api/docs/" className="text-navy-600 dark:text-navy-300 underline">API</a></p>
      </div>
      {isLoading && <p className="text-sm text-stone-500 dark:text-stone-400">{t('common.loading')}</p>}
      {data && (
        <div className="space-y-6">
          <section className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1">{t('data.entity')}</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">{t('data.entitySub')}</p>
            <code className="text-xs text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded px-2 py-1 inline-block">/paschools/api/data/schools/{'{id}'}.csv · /paschools/api/data/districts/{'{id}'}.csv</code>
          </section>
          <section className="card-surface overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-stone-100 dark:border-stone-800">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t('data.tables')}</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">{t('data.tablesSub')}</p>
            </div>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {data.tables.map((tb) => (
                <li key={tb.table} className="px-4 sm:px-6 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100 font-mono">{tb.table}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{tb.note}</div>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{tb.rows.toLocaleString()} {t('data.rows')}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tb.years.length === 0 ? (
                      <a href={`/paschools/api/data/${tb.table}.csv`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-navy-50 dark:bg-navy-900/50 text-navy-800 dark:text-navy-200 text-xs font-medium hover:bg-navy-100 dark:hover:bg-navy-800"><ArrowDownTrayIcon className="w-3.5 h-3.5" />CSV</a>
                    ) : tb.years.map((y) => (
                      <a key={y} href={`/paschools/api/data/${tb.table}.csv?year=${y}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-navy-50 dark:bg-navy-900/50 text-navy-800 dark:text-navy-200 text-xs font-medium tabular-nums hover:bg-navy-100 dark:hover:bg-navy-800"><ArrowDownTrayIcon className="w-3.5 h-3.5" />{y}</a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t('data.license')}</p>
        </div>
      )}
    </div>
  );
}
