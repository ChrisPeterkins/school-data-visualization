import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { indicatorApi } from '../services/api';
import { useUrlState } from '../hooks/useUrlState';
import FilterSelect from './FilterSelect';
import AccessibleChart from './AccessibleChart';
import ChartActions from './ChartActions';
import { useT } from '../i18n';

const MEASURES = ['regular_attendance', 'grad_rate_4yr', 'low_income', 'career_benchmark', 'rigorous_courses', 'postsecondary_transition', 'enrollment', 'perPupil', 'studentsPerTeacher', 'avgTeacherSalary'] as const;
type M = typeof MEASURES[number];
const fmt = (m: M, v: number | null | undefined) => (v == null ? '—' : m === 'enrollment' ? Math.round(v).toLocaleString() : m === 'perPupil' || m === 'avgTeacherSalary' ? `$${Math.round(v).toLocaleString()}` : m === 'studentsPerTeacher' ? `${v.toFixed(1)}:1` : `${v.toFixed(1)}%`);

/** Statewide series for the non-assessment measures, next to the test-score trends. */
export default function IndicatorTrends() {
  const t = useT();
  const [measure, setMeasure] = useUrlState<M>('ind', 'regular_attendance', (r) => (MEASURES.includes(r as M) ? (r as M) : null));
  const { data } = useQuery({ queryKey: ['indicators', 'state', 0], queryFn: indicatorApi.getState, staleTime: 60 * 60 * 1000 });
  if (!data) return null;
  const rows: Array<{ year: number; value: number | null }> =
    measure === 'enrollment' ? data.enrollment.map((e) => ({ year: e.year, value: e.total }))
    : measure === 'perPupil' ? data.finance.map((f) => ({ year: f.year, value: f.perPupil }))
    : measure === 'studentsPerTeacher' || measure === 'avgTeacherSalary' ? ((data as any).staff ?? []).map((s: any) => ({ year: s.year, value: s[measure] }))
    : (data.indicators.find((s) => s.indicator === measure)?.series ?? []).map((p) => ({ year: p.year, value: p.value }));
  const pts = rows.filter((r) => r.value != null);
  const isPct = !['enrollment', 'perPupil', 'studentsPerTeacher', 'avgTeacherSalary'].includes(measure);
  const label = t(`ind.${measure}`);
  return (
    <section className="card-surface p-4 sm:p-6" aria-labelledby="ind-trends-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 id="ind-trends-heading" className="text-base font-semibold text-stone-900">{t('trends.indTitle')}</h2>
          <p className="text-xs text-stone-500">{t('trends.indSub')}</p>
        </div>
        <FilterSelect label={t('cmp.measure')} value={measure} onChange={(e) => setMeasure(e.target.value as M)} fluid={false}>
          {MEASURES.map((m) => <option key={m} value={m} disabled={!(m === 'enrollment' ? data.enrollment.length : m === 'perPupil' ? data.finance.length : m === 'studentsPerTeacher' || m === 'avgTeacherSalary' ? ((data as any).staff ?? []).length : data.indicators.some((s) => s.indicator === m))}>{t(`ind.${m}`)}</option>)}
        </FilterSelect>
      </div>
      {pts.length < 2 ? <p className="text-sm text-stone-500">{t('common.nothing')}</p> : (
        <ChartActions filename={`statewide-${measure}`} title={`${label} · Pennsylvania`}>
          <AccessibleChart label={`${label}, statewide by year`} rows={pts} columns={[{ key: 'year', label: t('common.year') }, { key: 'value', label }]}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={pts} margin={{ top: 10, right: 20, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                <YAxis domain={isPct ? [0, 100] : ['auto', 'auto']} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => (isPct ? `${v}%` : measure === 'enrollment' ? `${Math.round(v / 1000)}k` : measure === 'studentsPerTeacher' ? `${v}` : `$${Math.round(v / 1000)}k`)} width={56} />
                <Tooltip formatter={(v: number) => [fmt(measure, v), label]} />
                <Line type="monotone" dataKey="value" stroke="#1e3a5f" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} name={label} />
              </LineChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </ChartActions>
      )}
      {pts.length > 1 && <p className="mt-2 text-xs text-stone-500">{pts[0].year}: {fmt(measure, pts[0].value)} → {pts[pts.length - 1].year}: {fmt(measure, pts[pts.length - 1].value)}</p>}
    </section>
  );
}
