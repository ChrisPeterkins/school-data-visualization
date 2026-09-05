import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
} from 'recharts';
import { MagnifyingGlassIcon, XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { schoolApi, performanceApi } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseNumberList } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { tooltipStyle, formatPct, growthBand, CHART_COLORS } from '../lib/chartUtils';

const COMPARE_COLORS = ['#2d4a6f', '#27ab83', '#c53030', '#4a6d8c', '#199473'];
const STATE_COLOR = CHART_COLORS.gold; // gold is reserved for the state-average reference
type Exam = 'pssa' | 'keystone';
const SUBJECTS: Record<Exam, string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};
const SHORT: Record<string, string> = {
  'Mathematics': 'Math', 'English Language Arts': 'ELA', 'Science': 'Science',
  'Algebra I': 'Algebra I', 'Biology': 'Biology', 'Literature': 'Literature',
};

interface SubjectFigure { proficiency: number | null; growth: number | null; tested: number }

/**
 * One figure per subject for a school in a year. PSSA prefers the all-grades
 * total row (grade 0); if a year lacks it, the grade rows are weighted by
 * students tested. Keystone rows are already one per subject.
 */
function subjectFigures(rows: any[], exam: Exam, year: number): Record<string, SubjectFigure> {
  const out: Record<string, SubjectFigure> = {};
  for (const subject of SUBJECTS[exam]) {
    const inYear = rows.filter((r) => r.year === year && r.subject === subject && r.percentProficientOrAbove != null);
    const total = exam === 'pssa' ? inYear.find((r) => r.grade === 0) : inYear[0];
    if (total) {
      out[subject] = { proficiency: total.percentProficientOrAbove, growth: total.growthScore ?? null, tested: total.numberScored ?? 0 };
      continue;
    }
    const graded = inYear.filter((r) => r.numberScored > 0);
    const tested = graded.reduce((s, r) => s + r.numberScored, 0);
    if (tested > 0) {
      const prof = graded.reduce((s, r) => s + r.percentProficientOrAbove * r.numberScored, 0) / tested;
      const growthRows = graded.filter((r) => r.growthScore != null);
      const growth = growthRows.length ? growthRows.reduce((s, r) => s + r.growthScore, 0) / growthRows.length : null;
      out[subject] = { proficiency: parseFloat(prof.toFixed(1)), growth, tested };
    }
  }
  return out;
}

export default function ComparePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const availableYears = useAvailableYears();
  const { latest } = availableYears;
  const smUp = useIsSmUp();

  const [ids, setIds] = useUrlState<number[]>('schools', [], parseNumberList, (v) => v.join(','));
  const [yearParam, setYearParam] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [examParam, setExamParam] = useUrlState<Exam | null>('exam', null, (r) => (r === 'pssa' || r === 'keystone' ? r : null), (v) => v ?? '');
  const year = yearParam ?? latest;

  const { data: searchResults } = useQuery({
    queryKey: ['school-search', searchTerm],
    queryFn: () => schoolApi.getSchools({ search: searchTerm, limit: 50 }),
    enabled: searchTerm.length >= 2,
  });

  // Each selected school's full record carries every year of results plus growth.
  const schoolQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['school', String(id)],
      queryFn: () => schoolApi.getSchool(String(id)),
      staleTime: 60 * 60 * 1000,
    })),
  });
  const schools = schoolQueries.map((q) => q.data).filter(Boolean) as any[];

  // Pick the exam: the URL if set, otherwise whichever the first school actually has for this year.
  const first = schools[0];
  const firstHasPssa = !!first && year != null && first.pssaResults.some((r: any) => r.year === year && r.percentProficientOrAbove != null);
  const firstHasKeystone = !!first && year != null && first.keystoneResults.some((r: any) => r.year === year && r.percentProficientOrAbove != null);
  const exam: Exam = examParam ?? (first && !firstHasPssa && firstHasKeystone ? 'keystone' : 'pssa');
  const subjects = SUBJECTS[exam];
  const years = yearsForExam(availableYears, exam);

  const { data: statePerformance } = useQuery({
    queryKey: ['state-performance', year],
    queryFn: () => performanceApi.getStatePerformance(year!),
    enabled: year != null,
  });
  const stateBySubject: Record<string, number> = {};
  if (exam === 'pssa') {
    (statePerformance?.pssa ?? []).forEach((r: any) => {
      if (r.grade === 0 && r.avgProficientOrAbove != null) stateBySubject[r.subject] = parseFloat(r.avgProficientOrAbove.toFixed(1));
    });
  } else {
    (statePerformance?.keystone ?? []).forEach((r: any) => {
      if (r.avgProficientOrAbove != null) stateBySubject[r.subject] = parseFloat(r.avgProficientOrAbove.toFixed(1));
    });
  }

  useDocumentTitle(schools.length ? `Compare: ${schools.map((s) => s.name).join(' vs ')}` : 'Compare schools', 'Side-by-side PSSA and Keystone results for up to five Pennsylvania schools against the state average.');

  const figures = year == null ? [] : schools.map((school) => ({
    school,
    bySubject: subjectFigures(exam === 'pssa' ? school.pssaResults : school.keystoneResults, exam, year),
  }));

  const addSchool = (school: any) => {
    if (ids.length < 5 && !ids.includes(school.id)) {
      setIds([...ids, school.id]);
      setSearchTerm('');
      setShowSearch(false);
    }
  };
  const removeSchool = (id: number) => setIds(ids.filter((x) => x !== id));

  const barData = subjects.map((subject) => {
    const row: any = { subject: SHORT[subject] };
    figures.forEach(({ school, bySubject }) => { if (bySubject[subject]) row[school.name] = bySubject[subject].proficiency; });
    return row;
  });
  const dotSeries = figures.map(({ school, bySubject }) => ({
    name: school.name,
    data: subjects.filter((s) => bySubject[s]).map((s) => ({ subject: SHORT[s], value: bySubject[s].proficiency })),
  }));
  const stateSeries = subjects.filter((s) => stateBySubject[s] != null).map((s) => ({ subject: SHORT[s], value: stateBySubject[s] }));
  const stateAverage = stateSeries.length ? stateSeries.reduce((s, d) => s + d.value, 0) / stateSeries.length : NaN;
  const noDataForExam = figures.length > 0 && figures.every((f) => Object.keys(f.bySubject).length === 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Compare Schools</h1>
        <p className="mt-1 text-sm text-stone-500">Up to 5 schools against each other and the state average</p>
      </div>

      <div className="card-surface p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4 mb-4">
          <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYearParam(Number(e.target.value))} fluid={false}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Exam" value={exam} onChange={(e) => setExamParam(e.target.value as Exam)} fluid={false}>
            <option value="pssa">PSSA (grades 3-8)</option>
            <option value="keystone">Keystone (high school)</option>
          </FilterSelect>
          <button
            onClick={() => setShowSearch(true)}
            disabled={ids.length >= 5}
            className="px-4 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Add School ({ids.length}/5)
          </button>
        </div>

        {showSearch && (
          <div className="mb-4">
            <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for a school..."
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  autoFocus
                />
              </div>
              {searchResults && searchResults.data.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                  {searchResults.data.map((school: any) => (
                    <li key={school.id}>
                      <button
                        onClick={() => addSchool(school)}
                        disabled={ids.includes(school.id)}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 disabled:opacity-40 transition-colors"
                      >
                        <div className="font-medium text-stone-900">{school.name}</div>
                        <div className="text-xs text-stone-500">{school.districtName}{school.type ? ` · ${school.type}` : ''}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {schools.map((school, index) => (
            <div
              key={school.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full"
              style={{ borderColor: COMPARE_COLORS[index] }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[index] }} />
              <span className="text-sm font-medium text-stone-700">{school.name}</span>
              <button onClick={() => removeSchool(school.id)} aria-label={`Remove ${school.name}`} className="text-stone-400 hover:text-stone-600 transition-colors">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {ids.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <ArrowsRightLeftIcon className="w-10 h-10 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500">Add up to 5 schools to compare their results</p>
        </div>
      ) : noDataForExam ? (
        <div className="card-surface p-8 text-center text-sm text-stone-500">
          None of the selected schools have {exam === 'pssa' ? 'PSSA' : 'Keystone'} results for {year}.
          {exam === 'pssa' ? ' High schools report Keystone exams; switch the exam above.' : ''}
        </div>
      ) : figures.length > 0 && (
        <div className="space-y-6">
          <div className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Proficient or above by subject ({year})</h2>
            <ResponsiveContainer width="100%" height={smUp ? 400 : 300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#78716c' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {figures.map(({ school }, index) => (
                  <Bar key={school.id} dataKey={school.name} fill={COMPARE_COLORS[index]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-1">Schools vs. state average ({year})</h2>
            <p className="text-xs text-stone-400 mb-4">Each dot is a school's % proficient or above; the gold diamond is the statewide figure</p>
            <ResponsiveContainer width="100%" height={smUp ? 260 : 220}>
              <ScatterChart margin={{ top: 10, right: smUp ? 30 : 16, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis type="number" dataKey="value" domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="subject" allowDuplicatedCategory={false} width={smUp ? 80 : 64} tick={{ fontSize: 12, fill: '#57534e' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Proficient or above']} cursor={{ strokeDasharray: '3 3' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {dotSeries.map((series, index) => (
                  <Scatter key={series.name} name={series.name} data={series.data} fill={COMPARE_COLORS[index]} />
                ))}
                {stateSeries.length > 0 && <Scatter name="State average" data={stateSeries} fill={STATE_COLOR} shape="diamond" />}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Summary ({year})</h2>
              <p className="text-xs text-stone-400 mt-0.5">Proficient or above per subject; growth is the PVAAS growth index averaged across subjects</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200">
                    <th className="px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">School</th>
                    {subjects.map((s) => (
                      <th key={s} className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">{SHORT[s]}</th>
                    ))}
                    <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Average</th>
                    <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {figures.map(({ school, bySubject }, index) => {
                    const vals = subjects.map((s) => bySubject[s]?.proficiency).filter((v): v is number => v != null);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
                    const growths = subjects.map((s) => bySubject[s]?.growth).filter((v): v is number => v != null);
                    const growth = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : null;
                    const band = growthBand(growth);
                    return (
                      <tr key={school.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                            <span className="text-sm font-medium text-stone-900">{school.name}</span>
                          </div>
                        </td>
                        {subjects.map((s) => (
                          <td key={s} className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{formatPct(bySubject[s]?.proficiency)}</td>
                        ))}
                        <td className="px-3 sm:px-5 py-3.5 text-center text-sm font-semibold text-navy-600 whitespace-nowrap">{isNaN(avg) ? 'N/A' : formatPct(avg)}</td>
                        <td className={`px-3 sm:px-5 py-3.5 text-center text-sm whitespace-nowrap ${band.className}`}>
                          {growth == null ? '—' : `${growth.toFixed(1)} · ${band.label}`}
                        </td>
                      </tr>
                    );
                  })}
                  {stateSeries.length > 0 && (
                    <tr className="bg-stone-50/80">
                      <td className="px-3 sm:px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: STATE_COLOR }} />
                          <span className="text-sm font-medium text-stone-700">State average</span>
                        </div>
                      </td>
                      {subjects.map((s) => (
                        <td key={s} className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{formatPct(stateBySubject[s])}</td>
                      ))}
                      <td className="px-3 sm:px-5 py-3.5 text-center text-sm font-semibold text-stone-700 whitespace-nowrap">{isNaN(stateAverage) ? 'N/A' : formatPct(stateAverage)}</td>
                      <td className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-400">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
