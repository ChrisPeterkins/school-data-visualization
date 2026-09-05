import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
} from 'recharts';
import { MagnifyingGlassIcon, XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { schoolApi, districtApi, performanceApi } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseNumberList, parseString } from '../hooks/useUrlState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import FilterSelect from '../components/FilterSelect';
import ExportCsvButton from '../components/ExportCsvButton';
import TrendCard from '../components/TrendCard';
import AccessibleChart from '../components/AccessibleChart';
import { tooltipStyle, formatPct, growthBand, CHART_COLORS, fillYearGaps } from '../lib/chartUtils';
import { SUBJECTS, SUBJECT_SHORT as SHORT, GROUPS as ALL_GROUPS, groupLabel as labelFor, isExam, type Exam, type Entity } from '../lib/constants';

const COMPARE_COLORS = ['#2d4a6f', '#27ab83', '#c53030', '#4a6d8c', '#199473'];
const STATE_COLOR = CHART_COLORS.gold;
type View = 'snapshot' | 'trend';
// Groups PDE reports for nearly every entity; the rarer ones are usually suppressed.
const GROUPS = ALL_GROUPS.filter((g) => !['Historically Underperforming', 'American Indian/Alaskan Native (not Hispanic)', 'Native Hawaiian or other Pacific Islander (not Hispanic)'].includes(g));

export default function ComparePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const availableYears = useAvailableYears();
  const { latest } = availableYears;
  const smUp = useIsSmUp();

  const [entity, setEntityParam] = useUrlState<Entity>('entity', 'school', (r) => (r === 'school' || r === 'district' ? r : null));
  const [ids, setIds] = useUrlState<number[]>(entity === 'school' ? 'schools' : 'districts', [], parseNumberList, (v) => v.join(','));
  const [yearParam, setYearParam] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [examParam, setExamParam] = useUrlState<Exam | null>('exam', null, (r) => (isExam(r) ? r : null), (v) => v ?? '');
  const [groupParam, setGroup] = useUrlState<string>('group', 'All Students', parseString);
  const group = GROUPS.includes(groupParam) ? groupParam : 'All Students';
  const year = yearParam ?? latest;
  const [view, setView] = useUrlState<View>('view', 'snapshot', (r) => (r === 'snapshot' || r === 'trend' ? r : null));
  const [trendSubjectParam, setTrendSubject] = useUrlState<string>('subject', '', parseString);

  const { data: searchResults } = useQuery({
    queryKey: ['compare-search', entity, searchTerm],
    queryFn: async () => (entity === 'school'
      ? (await schoolApi.getSchools({ search: searchTerm, limit: 50 })).data
      : (await districtApi.getDistricts({ search: searchTerm, limit: 50 })).data) as any[],
    enabled: searchTerm.length >= 2,
  });

  // Exam: the URL if set, otherwise whichever the first entity has for this year (high schools only have Keystone).
  const probe = useQuery({
    queryKey: ['figures-probe', entity, ids[0], year],
    queryFn: async () => {
      const [p, k] = await Promise.all([
        performanceApi.getFigures({ entity, ids: [ids[0]], year: year!, exam: 'pssa' }),
        performanceApi.getFigures({ entity, ids: [ids[0]], year: year!, exam: 'keystone' }),
      ]);
      return { pssa: Object.keys(p[0]?.subjects ?? {}).length > 0, keystone: Object.keys(k[0]?.subjects ?? {}).length > 0 };
    },
    enabled: ids.length > 0 && year != null && examParam == null,
    staleTime: 60 * 60 * 1000,
  });
  const exam: Exam = examParam ?? (probe.data && !probe.data.pssa && probe.data.keystone ? 'keystone' : 'pssa');
  const subjects = SUBJECTS[exam];
  const years = yearsForExam(availableYears, exam);

  const { data: figures = [], isLoading } = useQuery({
    queryKey: ['figures', entity, ids, year, exam, group],
    queryFn: () => performanceApi.getFigures({ entity, ids, year: year!, exam, group }),
    enabled: ids.length > 0 && year != null,
    staleTime: 60 * 60 * 1000,
  });

  const { data: stateGaps } = useQuery({
    queryKey: ['gaps-state-all', exam, year],
    queryFn: async () => Promise.all(subjects.map((s) => performanceApi.getGaps({ exam, level: 'state', subject: s, year: year! }))),
    enabled: year != null,
    staleTime: 60 * 60 * 1000,
  });
  const stateBySubject: Record<string, number> = {};
  stateGaps?.forEach((g, i) => {
    const row = g.groups.find((x) => x.group === group);
    if (row?.proficiency != null) stateBySubject[subjects[i]] = row.proficiency;
  });

  useDocumentTitle(figures.length ? `Compare: ${figures.map((f) => f.name).join(' vs ')}` : `Compare ${entity}s`, 'Side-by-side PSSA and Keystone results, by student group, against the state average.');

  const setEntity = (e: Entity) => { setEntityParam(e); setSearchTerm(''); };
  const add = (item: any) => {
    if (ids.length < 5 && !ids.includes(item.id)) { setIds([...ids, item.id]); setSearchTerm(''); setShowSearch(false); }
  };
  const remove = (id: number) => setIds(ids.filter((x) => x !== id));

  const barData = subjects.map((subject) => {
    const row: any = { subject: SHORT[subject] };
    figures.forEach((f) => { const v = f.subjects[subject]?.proficiency; if (v != null) row[f.name] = v; });
    return row;
  });
  const dotSeries = figures.map((f) => ({
    name: f.name,
    data: subjects.filter((s) => f.subjects[s]?.proficiency != null).map((s) => ({ subject: SHORT[s], value: f.subjects[s].proficiency })),
  }));
  const stateSeries = subjects.filter((s) => stateBySubject[s] != null).map((s) => ({ subject: SHORT[s], value: stateBySubject[s] }));
  const stateAverage = stateSeries.length ? stateSeries.reduce((s, d) => s + d.value, 0) / stateSeries.length : NaN;
  const noData = figures.length > 0 && figures.every((f) => Object.keys(f.subjects).length === 0);
  const groupLabel = labelFor(group);

  // Over-time view: one weighted series per entity for a subject and group.
  const trendSubject = subjects.includes(trendSubjectParam) ? trendSubjectParam : subjects[0];
  const trendQueries = useQueries({
    queries: figures.map((f) => ({
      queryKey: ['summary', exam, entity, f.id, trendSubject, group],
      queryFn: () => performanceApi.getSummary({ exam, level: entity, subject: trendSubject, ...(entity === 'school' ? { schoolId: f.id } : { districtId: f.id }), ...(group !== 'All Students' ? { demographicGroup: group } as any : {}) }),
      enabled: view === 'trend',
      staleTime: 60 * 60 * 1000,
    })),
  });
  const trendByYear: Record<number, any> = {};
  trendQueries.forEach((q, i) => (q.data?.series ?? []).forEach((p) => {
    trendByYear[p.year] = trendByYear[p.year] ?? { year: p.year };
    trendByYear[p.year][figures[i].name] = p.proficiency;
  }));
  const trendRows = fillYearGaps(Object.values(trendByYear).sort((a, b) => a.year - b.year));
  const trendYears = Object.keys(trendByYear).map(Number);
  const trendColors = Object.fromEntries(figures.map((f, i) => [f.name, COMPARE_COLORS[i]]));
  const meanGrowth = (f: typeof figures[number]) => {
    const g = subjects.map((s) => f.subjects[s]?.growth).filter((v): v is number => v != null);
    return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Compare</h1>
        <p className="mt-1 text-sm text-stone-500">Up to 5 schools or districts against each other and the state, for any student group</p>
      </div>

      <div className="card-surface p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3 sm:gap-4 mb-4">
          <div className="inline-flex rounded-lg border border-stone-200 text-sm font-medium overflow-hidden self-end" role="group" aria-label="Compare schools or districts">
            {(['school', 'district'] as Entity[]).map((e) => (
              <button key={e} onClick={() => setEntity(e)} aria-pressed={entity === e} className={`px-3 py-2 ${entity === e ? 'bg-navy-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'} ${e === 'district' ? 'border-l border-stone-200' : ''}`}>
                {e === 'school' ? 'Schools' : 'Districts'}
              </button>
            ))}
          </div>
          <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYearParam(Number(e.target.value))} fluid={false}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Exam" value={exam} onChange={(e) => setExamParam(e.target.value as Exam)} fluid={false}>
            <option value="pssa">PSSA (grades 3-8)</option>
            <option value="keystone">Keystone (high school)</option>
          </FilterSelect>
          <FilterSelect label="Student group" value={group} onChange={(e) => setGroup(e.target.value)} fluid={false}>
            {GROUPS.map((g) => <option key={g} value={g}>{labelFor(g)}</option>)}
          </FilterSelect>
          <div className="inline-flex rounded-lg border border-stone-200 text-sm font-medium overflow-hidden self-end" role="group" aria-label="View">
            <button onClick={() => setView('snapshot')} aria-pressed={view === 'snapshot'} className={`px-3 py-2 ${view === 'snapshot' ? 'bg-navy-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>{year} snapshot</button>
            <button onClick={() => setView('trend')} aria-pressed={view === 'trend'} className={`px-3 py-2 border-l border-stone-200 ${view === 'trend' ? 'bg-navy-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>Over time</button>
          </div>
          {view === 'trend' && (
            <FilterSelect label="Subject" value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)} fluid={false}>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </FilterSelect>
          )}
          <button
            onClick={() => setShowSearch(true)}
            disabled={ids.length >= 5}
            className="px-4 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Add {entity} ({ids.length}/5)
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
                  placeholder={`Search for a ${entity}...`}
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  autoFocus
                />
              </div>
              {searchResults && searchResults.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                  {searchResults.map((item: any) => (
                    <li key={item.id}>
                      <button onClick={() => add(item)} disabled={ids.includes(item.id)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 disabled:opacity-40 transition-colors">
                        <div className="font-medium text-stone-900">{item.name}</div>
                        <div className="text-xs text-stone-500">{entity === 'school' ? `${item.districtName}${item.type ? ` · ${item.type}` : ''}` : `${item.countyName} County`}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {figures.map((f, index) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full" style={{ borderColor: COMPARE_COLORS[index] }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[index] }} />
              <span className="text-sm font-medium text-stone-700">{f.name}</span>
              <button onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`} className="text-stone-400 hover:text-stone-600 transition-colors">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {ids.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <ArrowsRightLeftIcon className="w-10 h-10 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500">Add up to 5 {entity}s to compare their results</p>
        </div>
      ) : isLoading ? (
        <div className="card-surface p-12 text-center text-sm text-stone-400">Loading…</div>
      ) : noData ? (
        <div className="card-surface p-8 text-center text-sm text-stone-500">
          None of the selected {entity}s have {exam === 'pssa' ? 'PSSA' : 'Keystone'} results for {groupLabel} in {year}.
          {exam === 'pssa' ? ' High schools report Keystone exams; switch the exam above.' : ''} Groups under 11 students are suppressed by PDE.
        </div>
      ) : view === 'trend' ? (
        trendRows.length > 1 ? (
          <TrendCard
            title={`${trendSubject} proficient or above, ${labelFor(group)}`}
            subtitle={`Each line is one ${entity}, all grades, weighted by students tested`}
            data={trendRows}
            series={figures.map((f) => f.name)}
            years={trendYears}
            exam={exam}
            colors={trendColors}
            height={smUp ? 400 : 300}
          />
        ) : (
          <div className="card-surface p-12 text-center text-sm text-stone-400">{trendQueries.some((q) => q.isLoading) ? 'Loading…' : `No ${trendSubject} results for ${labelFor(group)} over time.`}</div>
        )
      ) : figures.length > 0 && (
        <div className="space-y-6">
          <div className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-1">Proficient or above by subject ({year})</h2>
            <p className="text-xs text-stone-400 mb-4">{groupLabel}, all grades</p>
            <AccessibleChart label={`Proficient or above by subject, ${groupLabel}, ${year}`} rows={barData}>
            <ResponsiveContainer width="100%" height={smUp ? 400 : 300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#78716c' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {figures.map((f, index) => <Bar key={f.id} dataKey={f.name} fill={COMPARE_COLORS[index]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
            </AccessibleChart>
          </div>

          <div className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-1">Against the state ({year})</h2>
            <p className="text-xs text-stone-400 mb-4">Each dot is one {entity}'s % proficient or above for {groupLabel}; the gold diamond is the statewide figure for the same group</p>
            <ResponsiveContainer width="100%" height={smUp ? 260 : 220}>
              <ScatterChart margin={{ top: 10, right: smUp ? 30 : 16, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis type="number" dataKey="value" domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="subject" allowDuplicatedCategory={false} width={smUp ? 80 : 64} tick={{ fontSize: 12, fill: '#57534e' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Proficient or above']} cursor={{ strokeDasharray: '3 3' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {dotSeries.map((series, index) => <Scatter key={series.name} name={series.name} data={series.data} fill={COMPARE_COLORS[index]} />)}
                {stateSeries.length > 0 && <Scatter name="State" data={stateSeries} fill={STATE_COLOR} shape="diamond" />}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="card-surface overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Summary ({year})</h2>
                <p className="text-xs text-stone-400 mt-0.5">{groupLabel} proficient or above per subject; growth is the PVAAS index for all students</p>
              </div>
              <ExportCsvButton
                filename={`compare-${entity}s-${group}-${year}`}
                rows={figures.map((f) => ({ name: f.name, parent: f.parent, ...Object.fromEntries(subjects.map((s) => [s, f.subjects[s]?.proficiency ?? null])), growth: meanGrowth(f) }))}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200">
                    <th className="px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">{entity === 'school' ? 'School' : 'District'}</th>
                    {subjects.map((s) => <th key={s} className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">{SHORT[s]}</th>)}
                    <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Average</th>
                    <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {figures.map((f, index) => {
                    const vals = subjects.map((s) => f.subjects[s]?.proficiency).filter((v): v is number => v != null);
                    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
                    const growth = meanGrowth(f);
                    const band = growthBand(growth);
                    return (
                      <tr key={f.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-stone-900">{f.name}</div>
                              <div className="text-xs text-stone-500 truncate">{f.parent}{f.enrollment ? ` · ${f.enrollment.toLocaleString()} students` : ''}</div>
                            </div>
                          </div>
                        </td>
                        {subjects.map((s) => (
                          <td key={s} className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap" title={f.subjects[s]?.tested ? `${f.subjects[s].tested} tested` : undefined}>{formatPct(f.subjects[s]?.proficiency)}</td>
                        ))}
                        <td className="px-3 sm:px-5 py-3.5 text-center text-sm font-semibold text-navy-600 whitespace-nowrap">{isNaN(avg) ? 'N/A' : formatPct(avg)}</td>
                        <td className={`px-3 sm:px-5 py-3.5 text-center text-sm whitespace-nowrap ${band.className}`}>{growth == null ? '—' : `${growth.toFixed(1)} · ${band.label}`}</td>
                      </tr>
                    );
                  })}
                  {stateSeries.length > 0 && (
                    <tr className="bg-stone-50/80">
                      <td className="px-3 sm:px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: STATE_COLOR }} />
                          <span className="text-sm font-medium text-stone-700">State, {groupLabel}</span>
                        </div>
                      </td>
                      {subjects.map((s) => <td key={s} className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{formatPct(stateBySubject[s])}</td>)}
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
