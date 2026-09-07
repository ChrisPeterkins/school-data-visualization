import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RssIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n';

interface Release { at: string; years: number[]; files: string[]; inserted: number; kinds: string[] }

/** Data loads, newest first, with the Atom feed link. */
export default function UpdatesPage() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('updates.title'), 'When new Pennsylvania Department of Education data was loaded into the explorer.');
  const { data, isLoading } = useQuery({ queryKey: ['imports-log'], queryFn: async () => (await api.get<{ releases: Release[] }>('/api/performance/imports')).data, staleTime: 60 * 60 * 1000 });
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('updates.title')}</h1>
          <p className="mt-1 text-sm text-stone-500">{t('updates.sub')}</p>
        </div>
        <a href="/paschools/feed.xml" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-800"><RssIcon className="w-4 h-4" />{t('updates.feed')}</a>
      </div>
      {isLoading && <div className="card-surface p-8 text-center"><div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>}
      {data && (
        <ol className="card-surface divide-y divide-stone-100">
          {data.releases.map((r) => (
            <li key={r.at} className="px-4 sm:px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900">{r.years.length ? t('updates.loadedFor', { years: r.years.sort().join(', ') }) : t('updates.loaded')}</h2>
                <time dateTime={r.at} className="text-xs text-stone-500">{fmt(r.at)}</time>
              </div>
              <p className="mt-1 text-xs text-stone-500">{t('updates.detail', { files: r.files.length, rows: r.inserted.toLocaleString() })}{r.kinds.length ? ` · ${r.kinds.join(', ')}` : ''}</p>
              <details className="mt-1"><summary className="text-xs text-navy-600 cursor-pointer">{t('updates.files')}</summary><ul className="mt-1 text-xs text-stone-600 space-y-0.5">{r.files.map((f) => <li key={f} className="font-mono break-all">{f}</li>)}</ul></details>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-sm text-stone-500">{t('updates.note')} <Link to="/about#updates" className="text-navy-600 underline">{t('notes.about')}</Link></p>
    </div>
  );
}
