import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { indicatorApi, type IndicatorSeries } from '../services/api';
import { useT } from '../i18n';

const ROWS: Array<{ key: string; kind: 'indicator' | 'enrollment' | 'finance' | 'staff'; field?: string; fmt: 'pct' | 'int' | 'money' | 'ratio' }> = [
  { key: 'enrollment', kind: 'enrollment', fmt: 'int' },
  { key: 'low_income', kind: 'indicator', fmt: 'pct' },
  { key: 'regular_attendance', kind: 'indicator', fmt: 'pct' },
  { key: 'grad_rate_4yr', kind: 'indicator', fmt: 'pct' },
  { key: 'career_benchmark', kind: 'indicator', fmt: 'pct' },
  { key: 'rigorous_courses', kind: 'indicator', fmt: 'pct' },
  { key: 'postsecondary_transition', kind: 'indicator', fmt: 'pct' },
  { key: 'perPupil', kind: 'finance', field: 'perPupil', fmt: 'money' },
  { key: 'studentsPerTeacher', kind: 'staff', field: 'studentsPerTeacher', fmt: 'ratio' },
  { key: 'avgTeacherSalary', kind: 'staff', field: 'avgTeacherSalary', fmt: 'money' },
];
const fmt = (v: number | null | undefined, f: string) => (v == null ? '—' : f === 'pct' ? `${v.toFixed(1)}%` : f === 'money' ? `$${Math.round(v).toLocaleString()}` : f === 'ratio' ? `${v.toFixed(1)}:1` : Math.round(v).toLocaleString());
const latest = (s: IndicatorSeries | undefined) => { const p = s?.series.filter((x) => x.value != null).slice(-1)[0]; return p ? { value: p.value, year: p.year } : null; };

/** Side-by-side non-assessment measures for the compared schools or districts. */
export default function CompareIndicators({ entity, ids, names }: { entity: 'school' | 'district'; ids: number[]; names: Record<number, string> }) {
  const t = useT();
  const queries = useQueries({
    queries: ids.map((id) => ({ queryKey: ['indicators', entity, id], queryFn: () => (entity === 'school' ? indicatorApi.getSchool(id) : indicatorApi.getDistrict(id)), staleTime: 60 * 60 * 1000, retry: false })),
  });
  if (!ids.length || queries.every((q) => !q.data)) return null;
  const cell = (i: number, row: typeof ROWS[number]) => {
    const d: any = queries[i]?.data;
    if (!d) return { text: '…', year: null as number | null };
    if (row.kind === 'indicator') { const l = latest(d.indicators.find((s: IndicatorSeries) => s.indicator === row.key)); return { text: fmt(l?.value, row.fmt), year: l?.year ?? null }; }
    if (row.kind === 'enrollment') { const e = d.enrollment?.slice(-1)[0]; return { text: fmt(e?.total, row.fmt), year: e?.year ?? null }; }
    const arr = (row.kind === 'finance' ? d.finance : d.staff) as any[] | undefined;
    const last = arr?.filter((x) => x[row.field!] != null).slice(-1)[0];
    return { text: fmt(last?.[row.field!], row.fmt), year: last?.year ?? null };
  };
  const rows = ROWS.filter((r) => ids.some((_, i) => cell(i, r).text !== '—' && cell(i, r).text !== '…'));
  if (!rows.length) return null;
  return (
    <div className="card-surface p-4 sm:p-6">
      <h2 className="text-base font-semibold text-stone-900 mb-1">{t('ind.title')}</h2>
      <p className="text-xs text-stone-500 mb-4">{t('cmp.indSub')} <Link to="/about#indicators" className="text-navy-600 underline">{t('notes.about')}</Link></p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 pr-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t('cmp.measure')}</th>
              {ids.map((id) => <th key={id} className="text-right py-2 px-3 text-xs font-semibold text-stone-700 max-w-[10rem] truncate">{names[id] ?? id}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-2 pr-3 text-stone-600">{t(`ind.${row.key}`)}</td>
                {ids.map((id, i) => { const c = cell(i, row); return <td key={id} className="py-2 px-3 text-right tabular-nums text-stone-900">{c.text}{c.year ? <span className="text-[10px] text-stone-500 ml-1">{c.year}</span> : null}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
