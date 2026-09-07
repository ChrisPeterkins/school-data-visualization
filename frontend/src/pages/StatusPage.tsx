import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n';

interface Status {
  now: string;
  build: { sha: string | null; at: string | null; processUptimeSec: number; node: string };
  data: { lastImportAt: string | null; importedFiles: number; counts: Record<string, number> };
  backup: { at: string; file: string; bytes: number } | null;
  restoreDrill: { at: string | null; result: string; ok: boolean } | null;
  releaseCheck: { checkedAt: string | null; latestYearOnPage: number | null; newYears: number[] } | null;
  health: { uptime30d: number; incidents: Array<{ at: string; detail: string }>; checkedEvery: string; lastEvent: { at: string; down: boolean; detail: string } | null };
}

/** Public operational status: data freshness, backups, restore drills, uptime. */
export default function StatusPage() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('status.title'), t('status.sub'));
  const { data, isLoading, error } = useQuery({ queryKey: ['status'], queryFn: async () => (await api.get<Status>('/api/status')).data, staleTime: 60 * 1000, refetchInterval: 5 * 60 * 1000 });
  const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const ago = (iso: string | null | undefined) => { if (!iso) return ''; const h = (Date.now() - Date.parse(iso)) / 3600000; return h < 1 ? t('status.minsAgo', { n: Math.max(1, Math.round(h * 60)) }) : h < 48 ? t('status.hoursAgo', { n: Math.round(h) }) : t('status.daysAgo', { n: Math.round(h / 24) }); };
  const Row = ({ label, value, ok, sub }: { label: string; value: string; ok?: boolean | null; sub?: string }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="text-sm text-stone-600 dark:text-stone-400 shrink-0 w-40 sm:w-52">{label}</div>
      <div className="text-right min-w-0">
        <div className="text-sm font-medium text-stone-900 dark:text-stone-100 inline-flex items-center gap-2">{ok != null && <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-teal-600' : 'bg-brick-600'}`} aria-label={ok ? t('status.ok') : t('status.attention')} />}{value}</div>
        {sub && <div className="text-xs text-stone-500 dark:text-stone-400 break-words">{sub}</div>}
      </div>
    </div>
  );
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{t('status.title')}</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('status.sub')}</p>
      </div>
      {isLoading && <p className="text-sm text-stone-500 dark:text-stone-400">{t('common.loading')}</p>}
      {error && <p className="text-sm text-brick-600 dark:text-brick-400">{t('error.section')}</p>}
      {data && (
        <div className="space-y-6">
          <section className="card-surface px-4 sm:px-6 divide-y divide-stone-100 dark:divide-stone-800">
            <Row label={t('status.uptime')} value={`${data.health.uptime30d}%`} ok={data.health.uptime30d >= 99.5} sub={t('status.uptimeSub', { every: data.health.checkedEvery })} />
            <Row label={t('status.lastImport')} value={fmt(data.data.lastImportAt)} ok={!!data.data.lastImportAt} sub={`${ago(data.data.lastImportAt)} · ${data.data.importedFiles} ${t('updates.files').toLowerCase()}`} />
            <Row label={t('status.backup')} value={fmt(data.backup?.at)} ok={!!data.backup && Date.now() - Date.parse(data.backup.at) < 2 * 86400000} sub={data.backup ? `${ago(data.backup.at)} · ${(data.backup.bytes / 1048576).toFixed(0)} MB` : t('status.none')} />
            <Row label={t('status.drill')} value={fmt(data.restoreDrill?.at)} ok={data.restoreDrill?.ok ?? null} sub={data.restoreDrill?.result.slice(0, 160)} />
            <Row label={t('status.release')} value={fmt(data.releaseCheck?.checkedAt)} ok={!!data.releaseCheck?.checkedAt && Date.now() - Date.parse(data.releaseCheck.checkedAt) < 8 * 86400000} sub={data.releaseCheck ? t('status.releaseSub', { year: data.releaseCheck.latestYearOnPage ?? '—', n: data.releaseCheck.newYears.length }) : undefined} />
            <Row label={t('status.build')} value={data.build.sha ?? '—'} sub={`${data.build.at ? fmt(data.build.at) : ''} · ${t('status.running', { h: Math.round(data.build.processUptimeSec / 3600) })} · ${data.build.node}`} />
          </section>
          <section className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-2">{t('status.incidents')}</h2>
            {data.health.incidents.length === 0 ? <p className="text-sm text-stone-500 dark:text-stone-400">{t('status.noIncidents')}</p> : (
              <ul className="text-sm text-stone-700 dark:text-stone-300 space-y-1">
                {data.health.incidents.map((i) => <li key={i.at} className="tabular-nums">{fmt(i.at)} · {i.detail}</li>)}
              </ul>
            )}
          </section>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t('status.counts', { schools: data.data.counts.schools.toLocaleString(), districts: data.data.counts.districts.toLocaleString(), rows: (data.data.counts.pssa_results + data.data.counts.keystone_results).toLocaleString() })} <Link to="/updates" className="text-navy-600 dark:text-navy-300 underline">{t('updates.title')}</Link></p>
        </div>
      )}
    </div>
  );
}
