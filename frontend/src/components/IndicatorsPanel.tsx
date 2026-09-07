import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { indicatorApi, type IndicatorSeries, type EnrollmentPoint, type FinancePoint, type StaffPoint, type IndicatorGroupRow , SafetyPoint, PermitPoint } from '../services/api';
import { groupLabel } from '../lib/constants';
import { useGroupLabel } from '../i18n';
import { useT } from '../i18n';
import AccessibleChart from './AccessibleChart';

interface IndicatorsPanelProps {
  entity: 'school' | 'district' | 'state';
  id?: number;
  /** Years the assessment pages cover, to keep the same "latest" in headlines. */
  compact?: boolean;
}

/** Indicators worth a card, in display order; the rest stay in the API. */
const SHOWN = ['low_income', 'regular_attendance', 'chronic_absenteeism', 'grad_rate_4yr', 'grad_rate_4yr_econ', 'career_benchmark', 'rigorous_courses', 'postsecondary_transition', 'industry_learning', 'english_proficiency', 'grade3_reading', 'grade7_math'];
/** Indicators where a lower number is better. */
const LOWER_IS_BETTER = new Set(['chronic_absenteeism', 'low_income']);
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };

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

function IndicatorCard({ s, t, entity }: { s: IndicatorSeries; t: (k: string, v?: Record<string, string | number>) => string; entity: 'school' | 'district' | 'state' }) {
  const nLabel = s.indicator.startsWith('grad_rate') ? t('ind.cohort') : s.indicator === 'low_income' ? t('ind.enrolled') : entity === 'district' ? t('ind.schools') : '';
  const pts = s.series.filter((p) => p.value != null);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const first = pts[0];
  const diff = cur.stateValue != null ? Math.round((cur.value! - cur.stateValue) * 10) / 10 : null;
  const better = diff == null ? null : LOWER_IS_BETTER.has(s.indicator) ? diff < 0 : diff > 0;
  const label = t(`ind.${s.indicator}`);
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400 leading-snug">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{pct(cur.value)}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{cur.year}{cur.n && nLabel ? ` · ${cur.n.toLocaleString()} ${nLabel}` : ''}</span>
      </div>
      {diff != null && (
        <div className={`text-xs tabular-nums ${better ? 'text-teal-700 dark:text-teal-400' : 'text-brick-600 dark:text-brick-400'}`}>
          {diff > 0 ? '+' : ''}{diff} {t('ind.vsState', { value: pct(cur.stateValue) })}
        </div>
      )}
      {(s as any).percentile && (
        <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{t('ind.percentile', { p: ordinal((s as any).percentile.value), n: (s as any).percentile.n.toLocaleString() })}</div>
      )}
      <AccessibleChart label={`${label}, ${first.year} to ${cur.year}`} rows={pts.map((p) => ({ year: p.year, value: p.value, state: p.stateValue }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'value', label }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="value" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{first.year}: {pct(first.value)}</div>}
    </div>
  );
}

function EnrollmentCard({ rows, t }: { rows: EnrollmentPoint[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (!rows.length) return null;
  const cur = rows[rows.length - 1], first = rows[0];
  const change = first.total ? Math.round(((cur.total - first.total) / first.total) * 1000) / 10 : null;
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('ind.enrollment')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{cur.total.toLocaleString()}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400">{t('ind.octoberOf', { year: cur.year - 1 })}</span>
      </div>
      {change != null && rows.length > 1 && (
        <div className={`text-xs tabular-nums ${change >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-brick-600 dark:text-brick-400'}`}>{change > 0 ? '+' : ''}{change}% {t('ind.since', { year: first.year - 1 })}</div>
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
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('ind.perPupil')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{money(cur.perPupil)}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{cur.year - 1}-{String(cur.year).slice(2)}</span>
      </div>
      {diff != null && <div className="text-xs text-stone-600 dark:text-stone-400 tabular-nums">{diff >= 0 ? '+' : '-'}{money(Math.abs(diff))} {t('ind.vsState', { value: money(cur.statePerPupil) })}</div>}
      {share != null && <div className="text-xs text-stone-500 dark:text-stone-400">{t('ind.instructionShare', { pct: share, amount: money(cur.instructionPerPupil) })}</div>}
      <AccessibleChart label={t('ind.perPupil')} rows={pts.map((p) => ({ year: p.year, perPupil: p.perPupil, state: p.statePerPupil }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'perPupil', label: t('ind.perPupil') }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="perPupil" color="#0f766e" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{pts[0].year - 1}-{String(pts[0].year).slice(2)}: {money(pts[0].perPupil)}</div>}
    </div>
  );
}

function SafetyCard({ rows, t, entity }: { rows: SafetyPoint[]; t: (k: string, v?: Record<string, string | number>) => string; entity: 'school' | 'district' | 'state' }) {
  const pts = rows.filter((r) => r.incidentsPer100 != null);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const first = pts[0];
  const diff = cur.stateIncidentsPer100 != null && entity !== 'state' ? Math.round((cur.incidentsPer100! - cur.stateIncidentsPer100) * 10) / 10 : null;
  const cats: Array<[string, number]> = [['assaults', cur.assaults], ['harassment', cur.harassment], ['fighting', cur.fighting], ['weapons', cur.weapons], ['drugsAlcohol', cur.drugsAlcohol], ['tobaccoVaping', cur.tobaccoVaping], ['threats', cur.threats]];
  const top = cats.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400 leading-snug">{t('ind.safety')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{cur.incidentsPer100}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{t('ind.per100', { year: cur.year })}{cur.incidents ? ` · ${cur.incidents.toLocaleString()}` : ''}</span>
      </div>
      {diff != null && <div className={`text-xs tabular-nums ${diff <= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-brick-600 dark:text-brick-400'}`}>{diff > 0 ? '+' : ''}{diff} {t('ind.vsState', { value: String(cur.stateIncidentsPer100) })}</div>}
      {top.length > 0 && <div className="text-[11px] text-stone-500 dark:text-stone-400">{top.map(([k, n]) => `${t(`ind.safe.${k}`)} ${n.toLocaleString()}`).join(' · ')}</div>}
      {cur.truancyRate != null && <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{t('ind.truancy', { rate: cur.truancyRate, state: cur.stateTruancyRate ?? '—' })}</div>}
      <AccessibleChart label={`${t('ind.safety')}, ${first.year} to ${cur.year}`} rows={pts.map((p) => ({ year: p.year, value: p.incidentsPer100, state: p.stateIncidentsPer100 }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'value', label: t('ind.safety') }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="incidentsPer100" color="#b45309" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{first.year}: {first.incidentsPer100}</div>}
    </div>
  );
}

function PermitsCard({ rows, t }: { rows: PermitPoint[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const pts = rows.filter((r) => r.total != null);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const first = pts[0];
  const diff = cur.per100Teachers != null && cur.statePer100Teachers != null ? Math.round((cur.per100Teachers - cur.statePer100Teachers) * 10) / 10 : null;
  return (
    <div className="card-surface p-4 flex flex-col gap-1.5">
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400 leading-snug">{t('ind.permits')}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{cur.per100Teachers ?? cur.total.toLocaleString()}</span>
        <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{cur.per100Teachers != null ? t('ind.per100Teachers', { year: cur.year, n: cur.total.toLocaleString() }) : String(cur.year)}</span>
      </div>
      {diff != null && <div className={`text-xs tabular-nums ${diff <= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-brick-600 dark:text-brick-400'}`}>{diff > 0 ? '+' : ''}{diff} {t('ind.vsState', { value: String(cur.statePer100Teachers) })}</div>}
      <div className="text-[11px] text-stone-500 dark:text-stone-400">{t('ind.permitMix', { d2d: cur.dayToDay.toLocaleString(), lt: cur.longTerm.toLocaleString() })}</div>
      <AccessibleChart label={`${t('ind.permits')}, ${first.year} to ${cur.year}`} rows={pts.map((p) => ({ year: p.year, total: p.total, per100: p.per100Teachers, state: p.statePer100Teachers }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'total', label: t('ind.permits') }, { key: 'per100', label: t('ind.per100TeachersShort') }, { key: 'state', label: t('ind.state') }]}>
        <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey="total" color="#5b5f97" />
      </AccessibleChart>
      {pts.length > 1 && <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{first.year}: {first.total.toLocaleString()}</div>}
    </div>
  );
}

const RACE_KEYS: Array<[string, string]> = [['white', '#1e3a5f'], ['black', '#8a6d1c'], ['hispanic', '#0f766e'], ['asian', '#5b5f97'], ['multi', '#b45309'], ['aian', '#7c3aed'], ['nhpi', '#0891b2'], ['unknown', '#a8a29e']];
function DemographicsStrip({ d, t }: { d: Record<string, number | null> & { year: number; total: number; history?: Array<Record<string, number | null> & { year: number }> }; t: (k: string, v?: Record<string, string | number>) => string }) {
  const parts = RACE_KEYS.map(([k, color]) => ({ k, color, v: d[k] ?? 0 })).filter((p) => p.v > 0);
  if (!parts.length) return null;
  // Change since the earliest CCD year we hold, for the groups that moved most.
  const first = d.history && d.history.length > 1 ? d.history[0] : null;
  const changes = first ? RACE_KEYS.map(([k]) => ({ k, delta: Math.round(((d[k] ?? 0) - (first[k] ?? 0)) * 10) / 10 })).filter((c) => Math.abs(c.delta) >= 1).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3) : [];
  return (
    <div className="card-surface p-4 col-span-2 md:col-span-3 lg:col-span-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t('ind.demographics')}</div>
        <div className="text-[11px] text-stone-500 dark:text-stone-400">{t('ind.demoSub', { year: d.year - 1, n: d.total.toLocaleString() })}</div>
      </div>
      <div className="mt-2 flex h-3 rounded-full overflow-hidden" role="img" aria-label={parts.map((p) => `${t(`ind.race.${p.k}`)} ${p.v}%`).join(', ')}>
        {parts.map((p) => <div key={p.k} style={{ width: `${p.v}%`, backgroundColor: p.color }} title={`${t(`ind.race.${p.k}`)} ${p.v}%`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
        {parts.map((p) => <span key={p.k} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: p.color }} />{t(`ind.race.${p.k}`)} <span className="tabular-nums text-stone-900 dark:text-stone-100">{p.v}%</span></span>)}
      </div>
      {first && changes.length > 0 && <div className="mt-1.5 text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">{t('ind.demoSince', { year: first.year - 1 })}: {changes.map((c) => `${t(`ind.race.${c.k}`)} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(' · ')}</div>}
    </div>
  );
}

function StaffCards({ rows, t }: { rows: StaffPoint[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const pts = rows.filter((r) => r.teachers);
  const cur = pts[pts.length - 1];
  if (!cur) return null;
  const items: Array<{ key: string; value: string; state: string | null; diff: number | null; better: boolean | null; data: string }> = [
    { key: 'studentsPerTeacher', value: cur.studentsPerTeacher != null ? `${cur.studentsPerTeacher.toFixed(1)}:1` : '—', state: cur.stateStudentsPerTeacher != null ? `${cur.stateStudentsPerTeacher.toFixed(1)}:1` : null, diff: cur.studentsPerTeacher != null && cur.stateStudentsPerTeacher != null ? Math.round((cur.studentsPerTeacher - cur.stateStudentsPerTeacher) * 10) / 10 : null, better: null, data: 'studentsPerTeacher' },
    { key: 'avgTeacherSalary', value: money(cur.avgTeacherSalary), state: cur.stateAvgTeacherSalary != null ? money(cur.stateAvgTeacherSalary) : null, diff: cur.avgTeacherSalary != null && cur.stateAvgTeacherSalary != null ? Math.round(cur.avgTeacherSalary - cur.stateAvgTeacherSalary) : null, better: null, data: 'avgTeacherSalary' },
    { key: 'avgTeacherExperience', value: cur.avgTeacherExperience != null ? cur.avgTeacherExperience.toFixed(1) : '—', state: cur.stateAvgTeacherExperience != null ? cur.stateAvgTeacherExperience.toFixed(1) : null, diff: cur.avgTeacherExperience != null && cur.stateAvgTeacherExperience != null ? Math.round((cur.avgTeacherExperience - cur.stateAvgTeacherExperience) * 10) / 10 : null, better: null, data: 'avgTeacherExperience' },
  ];
  return (
    <>
      {items.map((it) => (
        <div key={it.key} className="card-surface p-4 flex flex-col gap-1.5">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{t(`ind.${it.key}`)}</div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{it.value}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">{cur.year - 1}-{String(cur.year).slice(2)} · {cur.teachers?.toLocaleString()} {t('ind.teachers').toLowerCase()}</span>
          </div>
          {it.diff != null && it.state && <div className="text-xs text-stone-600 dark:text-stone-400 tabular-nums">{it.diff > 0 ? '+' : ''}{it.key === 'avgTeacherSalary' ? money(Math.abs(it.diff)).replace('$', it.diff < 0 ? '-$' : '$') : it.diff} {t('ind.vsState', { value: it.state })}</div>}
          <AccessibleChart label={t(`ind.${it.key}`)} rows={pts.map((p) => ({ year: p.year, value: (p as any)[it.data] }))} columns={[{ key: 'year', label: t('common.year') }, { key: 'value', label: t(`ind.${it.key}`) }]}>
            <Spark data={pts as unknown as Array<Record<string, unknown>>} dataKey={it.data} color="#5b5f97" />
          </AccessibleChart>
        </div>
      ))}
    </>
  );
}

function GroupTable({ groups, t }: { groups: IndicatorGroupRow[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const label = useGroupLabel(groupLabel);
  const shown = groups.filter((g) => g.groups.length > 0);
  if (!shown.length) return null;
  const allGroups = [...new Set(shown.flatMap((g) => g.groups.map((x) => x.group)))];
  return (
    <div className="card-surface overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-stone-100 dark:border-stone-800">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t('ind.byGroup')}</h3>
        <p className="text-xs text-stone-500 dark:text-stone-400">{shown.map((g) => `${t(`ind.${g.indicator}`)} ${g.year}`).join(' · ')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-stone-50/80 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
            <th className="text-left px-4 sm:px-5 py-2 font-semibold">{t('common.studentGroup')}</th>
            {shown.map((g) => <th key={g.indicator} className="text-right px-3 py-2 font-semibold whitespace-nowrap">{t(`ind.${g.indicator}`)}</th>)}
            {shown.map((g) => <th key={`${g.indicator}-gap`} className="text-right px-3 py-2 font-semibold whitespace-nowrap">{t('ind.gapCol')}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            <tr className="bg-stone-50/60 dark:bg-stone-800/60 font-medium"><td className="px-4 sm:px-5 py-2">{label('All Students')}</td>{shown.map((g) => <td key={g.indicator} className="text-right px-3 py-2 tabular-nums">{pct(g.allStudents)}</td>)}{shown.map((g) => <td key={`${g.indicator}-gap`} className="text-right px-3 py-2 text-stone-500 dark:text-stone-400">—</td>)}</tr>
            {allGroups.map((grp) => (
              <tr key={grp}>
                <td className="px-4 sm:px-5 py-2 text-stone-700 dark:text-stone-300">{label(grp)}</td>
                {shown.map((g) => { const x = g.groups.find((y) => y.group === grp); return <td key={g.indicator} className="text-right px-3 py-2 tabular-nums">{pct(x?.value)}</td>; })}
                {shown.map((g) => { const x = g.groups.find((y) => y.group === grp); return <td key={`${g.indicator}-gap`} className={`text-right px-3 py-2 tabular-nums ${x?.gap == null ? 'text-stone-500' : x.gap < -5 ? 'text-brick-600 dark:text-brick-400' : x.gap > 5 ? 'text-teal-700 dark:text-teal-400' : 'text-stone-600 dark:text-stone-400'}`}>{x?.gap == null ? '—' : `${x.gap > 0 ? '+' : ''}${x.gap}`}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  interface IndicatorData { indicators: IndicatorSeries[]; enrollment: EnrollmentPoint[]; finance?: unknown[]; staff?: StaffPoint[]; groups?: IndicatorGroupRow[]; safety?: SafetyPoint[]; permits?: PermitPoint[] }
  const { data } = useQuery({
    queryKey: ['indicators', entity, id ?? 0],
    queryFn: async (): Promise<IndicatorData> => (entity === 'school' ? indicatorApi.getSchool(id!) : entity === 'district' ? indicatorApi.getDistrict(id!) : indicatorApi.getState()),
    enabled: entity === 'state' || id != null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  if (!data) return null;
  const shown = data.indicators.filter((s) => SHOWN.includes(s.indicator) && s.series.some((p) => p.value != null)).sort((a, b) => SHOWN.indexOf(a.indicator) - SHOWN.indexOf(b.indicator));
  const finance = entity === 'district' ? ((data.finance ?? []) as FinancePoint[]) : [];
  const staff = entity === 'district' ? (data.staff ?? []) : [];
  const groups = data.groups ?? [];
  const demographics = (data as any).demographics as (Record<string, number | null> & { year: number; total: number }) | null | undefined;
  if (shown.length === 0 && data.enrollment.length === 0 && finance.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="indicators-heading">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2 id="indicators-heading" className="text-lg font-bold text-stone-900 dark:text-stone-100">{t('ind.title')}</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">{t(entity === 'district' ? 'ind.subDistrict' : 'ind.sub')} <Link to="/about#indicators" className="text-navy-600 dark:text-navy-300 underline">{t('notes.about')}</Link></p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <EnrollmentCard rows={data.enrollment} t={t} />
        {finance.length > 0 && <FinanceCard rows={finance} t={t} />}
        {shown.map((s) => <IndicatorCard key={s.indicator} s={s} t={t} entity={entity} />)}
        {staff.length > 0 && <StaffCards rows={staff} t={t} />}
        {(data.safety?.length ?? 0) > 0 && <SafetyCard rows={data.safety!} t={t} entity={entity} />}
        {(data.permits?.length ?? 0) > 0 && <PermitsCard rows={data.permits!} t={t} />}
        {demographics && <DemographicsStrip d={demographics} t={t} />}
      </div>
      {groups.length > 0 && <GroupTable groups={groups} t={t} />}
    </section>
  );
}
