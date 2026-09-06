import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { performanceApi } from '../services/api';
import { formatPct } from '../lib/chartUtils';
import { SUBJECTS } from '../lib/constants';
import GlobalSearch from '../components/GlobalSearch';
import WatchlistPanel from '../components/WatchlistPanel';
import { useI18n } from '../i18n';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/** Statewide headline for one subject: latest all-grades proficiency and the change from the prior results. */
function Headline({ label, exam, subject, latest }: { label: string; exam: 'pssa' | 'keystone'; subject: string; latest: number }) {
  const { data } = useQuery({
    queryKey: ['summary', exam, 'state', subject, 'home'],
    queryFn: () => performanceApi.getSummary({ exam, level: 'state', subject }),
    staleTime: 60 * 60 * 1000,
  });
  const series = (data?.series ?? []).filter((p) => p.proficiency != null).sort((a, b) => a.year - b.year);
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  const change = cur && prev ? Math.round((cur.proficiency! - prev.proficiency!) * 10) / 10 : null;
  const stale = cur && cur.year < latest;
  const { t } = useI18n();
  return (
    <Link to={`/state?exam=${exam}&subject=${encodeURIComponent(subject)}`} className="card-surface p-4 sm:p-5 hover:border-navy-300 transition-colors block">
      <div className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold text-navy-900 tabular-nums">{cur ? formatPct(cur.proficiency) : '…'}</span>
        {change != null && (
          <span className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${change >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>
            {change >= 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
            {change > 0 ? '+' : ''}{change}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-stone-500 tabular-nums">{cur ? (prev ? `${prev.year} → ${cur.year}` : String(cur.year)) : ''}{stale ? ` · ${t('home.noNewer')}` : ''}</div>
    </Link>
  );
}

export default function HomePage() {
  const availableYears = useAvailableYears();
  const { counts, latest, lastImportAt } = availableYears;
  const yearRange = formatYearRange(availableYears);
  const { t, lang } = useI18n();
  useDocumentTitle(null);

  const stats = [
    { label: t('home.stat.schools'), value: counts ? counts.schools.toLocaleString() : '…' },
    { label: t('home.stat.districts'), value: counts ? counts.districts.toLocaleString() : '…' },
    { label: t('home.stat.results'), value: counts ? compact.format(counts.pssaRecords) : '…' },
    { label: t('home.stat.years'), value: yearRange || '…' },
  ];

  // Biggest district movers in Math since the previous year.
  const [movers] = useQueries({
    queries: [{
      queryKey: ['rankings', 'home-movers', latest],
      queryFn: () => performanceApi.getRankings({ year: latest!, examType: 'pssa', subject: 'Mathematics', limit: 5, entity: 'district', mode: 'change', minTested: 200 } as any),
      enabled: latest != null,
      staleTime: 60 * 60 * 1000,
    }],
  });
  const compareYear: number | undefined = movers.data?.filters?.compareYear;
  const moverRow = (r: any) => (
    <li key={r.schoolId}>
      <Link to={`/districts/${r.schoolId}`} className="flex items-center justify-between gap-3 py-2 hover:bg-stone-50 -mx-2 px-2 rounded-md">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-stone-900 truncate">{r.schoolName}</span>
          <span className="block text-xs text-stone-500 truncate">{r.countyName} · {formatPct(r.previousProficiency)} → {formatPct(r.avgProficiency)}</span>
        </span>
        <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${r.change >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>{r.change > 0 ? '+' : ''}{r.change} pts</span>
      </Link>
    </li>
  );

  const updated = lastImportAt ? new Date(lastImportAt).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

  const features = [
    { key: 'map', link: '/map' }, { key: 'rankings', link: '/rankings' }, { key: 'compare', link: '/compare' },
    { key: 'nearby', link: '/nearby' }, { key: 'trends', link: '/trends' }, { key: 'about', link: '/about' },
  ];

  return (
    <div>
      {/* Hero */}
      <div className="bg-navy-900 border-t-4 border-gold-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-gold-400">{yearRange ? t('home.eyebrow', { range: yearRange }) : t('common.loading')}</p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-bold text-white tracking-tight">{t('home.title')}</h1>
            <p className="mt-5 text-base sm:text-lg text-navy-200 leading-relaxed">{t('home.lead')}</p>
            <div className="mt-8 max-w-xl">
              <GlobalSearch id="home-search" large placeholder={t('home.searchPlaceholder')} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-stone-200">
        <dl className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-y-6 py-6 sm:py-8">
          {stats.map((stat) => (
            <div key={stat.label} className="lg:border-l lg:border-stone-200 lg:first:border-l-0 lg:pl-6 lg:first:pl-0">
              <dd className="text-2xl sm:text-3xl font-bold text-navy-900 tabular-nums whitespace-nowrap">{stat.value}</dd>
              <dt className="mt-1 text-sm text-stone-500">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* State at a glance */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10 empty:hidden"><WatchlistPanel /></div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">{t('home.glance')}{latest ? <span className="text-stone-500 font-semibold"> · {latest}</span> : null}</h2>
            <p className="mt-2 text-base text-stone-500 max-w-2xl">{t('home.glanceSub')}</p>
          </div>
          {updated && <p className="text-xs text-stone-500">{t('home.updated', { date: updated })}</p>}
        </div>

        {latest != null && (
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            {SUBJECTS.pssa.map((s) => <Headline key={s} label={`${t('common.pssa')} · ${s === 'English Language Arts' ? 'ELA' : s === 'Mathematics' ? 'Math' : s}`} exam="pssa" subject={s} latest={latest} />)}
            {SUBJECTS.keystone.map((s) => <Headline key={s} label={`${t('common.keystone')} · ${s}`} exam="keystone" subject={s} latest={latest} />)}
          </div>
        )}

        {movers.data && movers.data.top.length > 0 && (
          <div className="mt-8 card-surface p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-stone-900">{t('home.movers')}</h3>
            <p className="mt-1 text-sm text-stone-500">{t('home.moversSub', { year: compareYear ?? '' })}</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">{t('home.improved')}</div>
                <ul className="mt-1 divide-y divide-stone-100">{movers.data.top.slice(0, 3).map(moverRow)}</ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-brick-600">{t('home.declined')}</div>
                <ul className="mt-1 divide-y divide-stone-100">{movers.data.bottom.slice(0, 3).map(moverRow)}</ul>
              </div>
            </div>
            <Link to={`/rankings?entity=district&mode=change&subject=${encodeURIComponent('Mathematics')}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:text-navy-800">
              {t('nav.rankings')} <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">{t('home.explore')}</h2>
        <p className="mt-2 text-base text-stone-500 max-w-2xl">{t('home.exploreSub')}</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => (
            <Link key={f.key} to={f.link} className="group card-surface p-6 flex flex-col hover:border-navy-300 transition-colors">
              <h3 className="text-lg font-semibold text-stone-900 group-hover:text-navy-700 transition-colors">{t(`home.f.${f.key}`)}</h3>
              <p className="mt-2 text-sm text-stone-500 leading-relaxed flex-1">{t(`home.f.${f.key}Desc`)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600">
                {t('home.explore.cta')}
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
