import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { indicatorApi, type IndicatorSeries, type EnrollmentPoint, type FinancePoint } from '../services/api';
import { useT } from '../i18n';
import AccessibleChart from './AccessibleChart';

interface IndicatorsPanelProps {
  entity: 'school' | 'district' | 'state';
  id?: number;
  /** Years the assessment pages cover, to keep the same "latest" in headlines. */
  compact?: boolean;
}

/** Indicators worth a card, in display order; the rest stay in the API. */
const SHOWN = ['regular_attendance', 'chronic_absenteeism', 'grad_rate_4yr', 'grad_rate_4yr_econ', 'career_benchmark', 'rigorous_courses', 'postsecondary_transition', 'industry_learning', 'english_proficiency', 'grade3_reading', 'grade7_math'];
/** Indicators where a lower number is better. */
const LOWER_IS_BETTER = new Set(['chronic_absenteeism']);

const money = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`);

function Spark({ data, dataKey, color = '#1e3a5f' }: { data: Array<Record<string, unknown>>; dataKey: string; color?: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['auto', 'auto']} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IndicatorCard({ s, t }: { s: IndicatorSeries; t: (k: string, v?: Record<string, string | number>) => string }) {
  const pts = s.series.filter((p) => p.value != null);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const first = pts[0];
  const diff = cur.stateValue != null ? Math.round((cur.value! - cur.stateValue) * 10) / 10 : null;
  const better = diff == null ? null : LOWER_IS_BETTER.has(s.indicator) ? diff < 0 : diff > 0;
  const label = t(`ind.${s.indicator}`);
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500 leading-snug">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 tabular-nums">{pct(cur.value)}</span>
        <span className="text-xs text-stone-500 tabular-nums">{cur.year}{cur.n ? ` · ${cur.n.toLocaleString()} ${t('ind.cohort')}` : ''}</span>
      </div>
      {diff != null && (
        <div className={`text-xs tabular-nums ${better ? 'text-teal-700' : 'text-brick-600'}`}>
          {diff > 0 ? '+' : ''}{diff} {t('ind.vsState', { value: pct(cur.stateValue) })}
        </div>
      )}
      <AccessibleChart label={`${label}, ${first.year} to ${cur.year}`} rows={pts.map((p) => ({ year: p.year, value: p.value, state: p.stateValue }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'value', label }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="value" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 tabular-nums">{first.year}: {pct(first.value)}</div>}
    </div>
  );
}

function EnrollmentCard({ rows, t }: { rows: EnrollmentPoint[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (!rows.length) return null;
  const cur = rows[rows.length - 1], first = rows[0];
  const change = first.total ? Math.round(((cur.total - first.total) / first.total) * 1000) / 10 : null;
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500">{t('ind.enrollment')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 tabular-nums">{cur.total.toLocaleString()}</span>
        <span className="text-xs text-stone-500">{t('ind.octoberOf', { year: cur.year - 1 })}</span>
      </div>
      {change != null && rows.length > 1 && (
        <div className={`text-xs tabular-nums ${change >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>{change > 0 ? '+' : ''}{change}% {t('ind.since', { year: first.year - 1 })}</div>
      )}
      <AccessibleChart label={t('ind.enrollment')} rows={rows.map((r) => ({ year: r.year, total: r.total }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'total', label: t('ind.enrollment') }]}>
        <Spark data={rows as unknown as Array<Record<string, unknown>>} dataKey="total" color="#8a6d1c" />
      </AccessibleChart>
    </div>
  );
}

function FinanceCard({ rows, t }: { rows: FinancePoint[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const pts = rows.filter((r) => r.perPupil != null);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const diff = cur.statePerPupil != null ? cur.perPupil! - cur.statePerPupil : null;
  const share = cur.total && cur.instruction != null ? Math.round((cur.instruction / cur.total) * 100) : null;
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500">{t('ind.perPupil')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 tabular-nums">{money(cur.perPupil)}</span>
        <span className="text-xs text-stone-500 tabular-nums">{cur.year - 1}-{String(cur.year).slice(2)}</span>
      </div>
      {diff != null && <div className="text-xs text-stone-600 tabular-nums">{diff >= 0 ? '+' : '-'}{money(Math.abs(diff))} {t('ind.vsState', { value: money(cur.statePerPupil) })}</div>}
      {share != null && <div className="text-xs text-stone-500">{t('ind.instructionShare', { pct: share, amount: money(cur.instructionPerPupil) })}</div>}
      <AccessibleChart label={t('ind.perPupil')} rows={pts.map((p) => ({ year: p.year, perPupil: p.perPupil, state: p.statePerPupil }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'perPupil', label: t('ind.perPupil') }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="perPupil" color="#0f766e" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 tabular-nums">{pts[0].year - 1}-{String(pts[0].year).slice(2)}: {money(pts[0].perPupil)}</div>}
    </div>
  );
}

/**
 * "Beyond test scores": attendance, graduation, career readiness, and
 * enrollment from the Future Ready PA Index, PDE cohort files, and PDE
 * enrollment reports; districts also get AFR spending per pupil.
 */
export default function IndicatorsPanel({ entity, id }: IndicatorsPanelProps) {
  const t = useT();
  const { data } = useQuery({
    queryKey: ['indicators', entity, id ?? 0],
    queryFn: () => (entity === 'school' ? indicatorApi.getSchool(id!) : entity === 'district' ? indicatorApi.getDistrict(id!) : indicatorApi.getState()),
    enabled: entity === 'state' || id != null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  if (!data) return null;
  const shown = data.indicators.filter((s) => SHOWN.includes(s.indicator) && s.series.some((p) => p.value != null)).sort((a, b) => SHOWN.indexOf(a.indicator) - SHOWN.indexOf(b.indicator));
  const finance = 'finance' in data && entity === 'district' ? (data.finance as FinancePoint[]) : [];
  if (shown.length === 0 && data.enrollment.length === 0 && finance.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="indicators-heading">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2 id="indicators-heading" className="text-lg font-bold text-stone-900">{t('ind.title')}</h2>
        <p className="text-xs text-stone-500">{t(entity === 'district' ? 'ind.subDistrict' : 'ind.sub')} <Link to="/about#indicators" className="text-navy-600 underline">{t('notes.about')}</Link></p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <EnrollmentCard rows={data.enrollment} t={t} />
        {finance.length > 0 && <FinanceCard rows={finance} t={t} />}
        {shown.map((s) => <IndicatorCard key={s.indicator} s={s} t={t} />)}
      </div>
    </section>
  );
}
