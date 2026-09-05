import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { performanceApi } from '../services/api';
import { useIsSmUp } from '../hooks/useMediaQuery';
import FilterSelect from './FilterSelect';
import ExportCsvButton from './ExportCsvButton';
import { fillYearGaps, standardsChangeLine, covidGapArea, tooltipStyle, formatPct, growthBand } from '../lib/chartUtils';

type Exam = 'pssa' | 'keystone';
interface GapsPanelProps {
  level: 'school' | 'district' | 'state';
  schoolId?: number;
  districtId?: number;
  countyId?: number;
  /** Exams the entity actually has results for; defaults to both. */
  exams?: Exam[];
  year?: number;
}

const SUBJECTS: Record<Exam, string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};

/** Display order: the whole population, then program groups, then race/ethnicity, then sex. */
const GROUP_ORDER = [
  'All Students', 'Economically Disadvantaged', 'IEP', 'ELL', 'Historically Underperforming',
  'White (not Hispanic)', 'Black or African American (not Hispanic)', 'Hispanic (any race)', 'Asian (not Hispanic)',
  'Multi-ethnic (not Hispanic)', 'American Indian/Alaskan Native (not Hispanic)', 'Native Hawaiian or other Pacific Islander (not Hispanic)',
  'Male', 'Female',
];
const SHORT: Record<string, string> = {
  'Economically Disadvantaged': 'Econ. disadvantaged', 'IEP': 'Students with IEPs', 'ELL': 'English learners',
  'White (not Hispanic)': 'White', 'Black or African American (not Hispanic)': 'Black', 'Hispanic (any race)': 'Hispanic',
  'Asian (not Hispanic)': 'Asian', 'Multi-ethnic (not Hispanic)': 'Multi-ethnic',
  'American Indian/Alaskan Native (not Hispanic)': 'American Indian / Alaska Native',
  'Native Hawaiian or other Pacific Islander (not Hispanic)': 'Native Hawaiian / Pacific Islander',
  'Historically Underperforming': 'Historically underperforming',
};
const TREND_GROUPS = ['All Students', 'Economically Disadvantaged', 'IEP', 'ELL', 'White (not Hispanic)', 'Black or African American (not Hispanic)', 'Hispanic (any race)'];
const TREND_COLORS: Record<string, string> = {
  'All Students': '#1b2a4a', 'Economically Disadvantaged': '#d4aa3c', 'IEP': '#7a9bb5', 'ELL': '#27ab83',
  'White (not Hispanic)': '#4a6d8c', 'Black or African American (not Hispanic)': '#c53030', 'Hispanic (any race)': '#199473',
};

/**
 * Proficiency by student group against All Students for one year, and how the
 * largest gaps have moved over time. Weighted by students tested.
 */
export default function GapsPanel({ level, schoolId, districtId, countyId, exams = ['pssa', 'keystone'], year }: GapsPanelProps) {
  const smUp = useIsSmUp();
  const [exam, setExam] = useState<Exam>(exams[0]);
  const activeExam = exams.includes(exam) ? exam : exams[0];
  const [subjectChoice, setSubject] = useState<string | null>(null);
  const subject = subjectChoice && SUBJECTS[activeExam].includes(subjectChoice) ? subjectChoice : SUBJECTS[activeExam][0];

  const { data, isLoading } = useQuery({
    queryKey: ['gaps', activeExam, level, subject, year, schoolId, districtId, countyId],
    queryFn: () => performanceApi.getGaps({ exam: activeExam, level, subject, year, schoolId, districtId, countyId }),
  });

  const groups = (data?.groups ?? [])
    .filter((g) => GROUP_ORDER.includes(g.group))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  const hasGrowth = groups.some((g) => g.growth != null);

  const trendByYear: Record<number, any> = {};
  for (const t of data?.trend ?? []) {
    if (!TREND_GROUPS.includes(t.group)) continue;
    trendByYear[t.year] = trendByYear[t.year] ?? { year: t.year };
    trendByYear[t.year][t.group] = t.proficiency;
  }
  const trendRows = fillYearGaps(Object.values(trendByYear).sort((a, b) => a.year - b.year));
  const trendGroupsPresent = TREND_GROUPS.filter((g) => Object.values(trendByYear).some((r) => r[g] != null));
  const years = data?.years ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
        {exams.length > 1 && (
          <FilterSelect label="Exam" value={activeExam} onChange={(e) => { setExam(e.target.value as Exam); setSubject(null); }}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
        )}
        <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS[activeExam].map((s) => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
      </div>

      {isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-stone-400">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-stone-400">No student-group results for this selection.</div>
      ) : (
        <>
          <div className="card-surface overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex flex-wrap items-start justify-between gap-2">
              <div>
              <h3 className="text-base font-semibold text-stone-900">{subject} by student group ({data?.year})</h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Gap is percentage points from All Students ({formatPct(data?.allStudents)}). Groups under 11 students are suppressed by PDE and do not appear.
              </p>
              </div>
              <ExportCsvButton filename={`gaps-${subject}-${data?.year}`} rows={groups as unknown as Array<Record<string, unknown>>} columns={[{ key: 'group', label: 'Group' }, { key: 'proficiency', label: '% proficient or above' }, { key: 'gap', label: 'Gap vs All Students' }, { key: 'tested', label: 'Students tested' }, { key: 'growth', label: 'Growth index' }]} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    <th className="px-3 sm:px-6 py-3 text-left">Group</th>
                    <th className="px-3 sm:px-6 py-3 text-right whitespace-nowrap">Prof.+</th>
                    <th className="px-3 sm:px-6 py-3 text-left">Gap</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-right">Tested</th>
                    {hasGrowth && <th className="px-3 sm:px-6 py-3 text-right">Growth</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {groups.map((g) => {
                    const isAll = g.group === 'All Students';
                    const band = growthBand(g.growth);
                    const gapWidth = g.gap == null ? 0 : Math.min(50, Math.abs(g.gap));
                    return (
                      <tr key={g.group} className={isAll ? 'bg-stone-50/60 font-medium' : ''}>
                        <td className="px-3 sm:px-6 py-2.5 text-sm text-stone-900">{SHORT[g.group] ?? g.group}</td>
                        <td className="px-3 sm:px-6 py-2.5 text-sm text-right tabular-nums text-stone-900">{formatPct(g.proficiency)}</td>
                        <td className="px-3 sm:px-6 py-2.5">
                          {isAll || g.gap == null ? <span className="text-xs text-stone-400">—</span> : (
                            <div className="flex items-center gap-2 min-w-[7rem]">
                              <div className="relative h-2 w-24 bg-stone-100 rounded-full overflow-hidden" aria-hidden>
                                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-stone-300" />
                                <div
                                  className={`absolute top-0 bottom-0 ${g.gap >= 0 ? 'bg-navy-500 left-1/2' : 'bg-brick-400 right-1/2'}`}
                                  style={{ width: `${gapWidth}%` }}
                                />
                              </div>
                              <span className={`text-sm tabular-nums ${g.gap >= 0 ? 'text-navy-700' : 'text-brick-600'}`}>{g.gap > 0 ? '+' : ''}{g.gap.toFixed(1)}</span>
                            </div>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-2.5 text-sm text-right tabular-nums text-stone-500">{g.tested ? g.tested.toLocaleString() : '—'}</td>
                        {hasGrowth && (
                          <td className={`px-3 sm:px-6 py-2.5 text-sm text-right whitespace-nowrap ${band.className}`}>
                            {g.growth == null ? '—' : `${g.growth.toFixed(1)} · ${band.label}`}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {trendRows.length > 1 && trendGroupsPresent.length > 1 && (
            <div className="card-surface p-4 sm:p-6">
              <h3 className="text-base font-semibold text-stone-900 mb-1">{subject} proficiency by group over time</h3>
              <p className="text-xs text-stone-400 mb-4">The largest groups; a widening spread between lines is a widening gap</p>
              <ResponsiveContainer width="100%" height={smUp ? 320 : 260}>
                <LineChart data={trendRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} formatter={(v) => SHORT[v] ?? v} />
                  {covidGapArea(years)}
                  {activeExam === 'pssa' ? standardsChangeLine(years) : null}
                  {trendGroupsPresent.map((g) => (
                    <Line key={g} type="monotone" dataKey={g} connectNulls={false} stroke={TREND_COLORS[g]} strokeWidth={g === 'All Students' ? 3 : 2} dot={{ r: 2.5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
