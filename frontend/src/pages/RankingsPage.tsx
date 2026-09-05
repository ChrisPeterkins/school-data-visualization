import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import { CHART_COLORS, tooltipStyle, growthBand } from '../lib/chartUtils';

type Exam = 'pssa' | 'keystone';
const PSSA_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science'];
const KEYSTONE_SUBJECTS = ['Algebra I', 'Biology', 'Literature'];

export default function RankingsPage() {
  const { years, latest } = useAvailableYears();
  const smUp = useIsSmUp();

  const [yearParam, setYearParam] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const year = yearParam ?? latest;
  const [examType, setExamType] = useUrlState<Exam>('exam', 'pssa', (r) => (r === 'pssa' || r === 'keystone' ? r : null));
  const [subject, setSubject] = useUrlState<string>('subject', '', parseString);
  const [grade, setGrade] = useUrlState<number | ''>('grade', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [schoolType, setSchoolType] = useUrlState<string>('type', '', parseString);
  const [countyId, setCountyId] = useUrlState<number | ''>('county', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [limit, setLimit] = useUrlState<number>('limit', 10, parseNumber);
  const [minTested, setMinTested] = useUrlState<number>('min', 40, parseNumber);

  const { data: filterOptions } = useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => {
      const response = await fetch('/paschools/api/schools/filters');
      return response.json() as Promise<{ counties: Array<{ id: number; name: string; code: string }>; schoolTypes: string[] }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const commonParams = {
    examType,
    subject: subject || undefined,
    grade: grade || undefined,
    countyId: countyId || undefined,
    schoolType: schoolType || undefined,
    minTested,
  };

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings', year, commonParams, limit],
    queryFn: () => performanceApi.getRankings({ year: year!, ...commonParams, limit }),
    enabled: year != null,
  });

  const { data: growthData } = useQuery({
    queryKey: ['growth-achievement', year, commonParams],
    queryFn: () => performanceApi.getGrowthAchievement({ year: year!, ...commonParams }),
    enabled: year != null,
  });

  const subjects = examType === 'pssa' ? PSSA_SUBJECTS : KEYSTONE_SUBJECTS;

  // The category axis eats fixed width; phones get a narrower axis and shorter labels.
  const axisWidth = smUp ? 210 : 120;
  const nameMax = smUp ? 28 : 17;
  const shorten = (name: string) => (name.length > nameMax ? name.slice(0, nameMax - 2) + '...' : name);

  const chartData = rankings
    ? [
        ...rankings.top.map((s) => ({ name: shorten(s.schoolName), fullName: s.schoolName, value: s.avgProficiency, isTop: true })),
        ...rankings.bottom.slice().reverse().map((s) => ({ name: shorten(s.schoolName), fullName: s.schoolName, value: s.avgProficiency, isTop: false })),
      ]
    : [];
  const chartHeight = Math.max(400, chartData.length * 36 + 80);

  const points = growthData?.points ?? [];
  const quadrant = (p: { proficiency: number; growth: number }) => {
    const highAch = rankings?.stateAverage != null ? p.proficiency >= rankings.stateAverage : p.proficiency >= 50;
    if (p.growth >= 1) return highAch ? CHART_COLORS.navyDark : CHART_COLORS.teal;
    if (p.growth <= -1) return highAch ? CHART_COLORS.gold : CHART_COLORS.brick;
    return CHART_COLORS.navyLight;
  };

  const SchoolCard = ({ school, variant }: { school: NonNullable<typeof rankings>['top'][0]; variant: 'top' | 'bottom' }) => {
    const isTop = variant === 'top';
    const band = growthBand(school.avgGrowth);
    return (
      <div className="card-surface p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-stone-100 text-stone-700 tabular-nums">
            {school.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link to={`/schools/${school.schoolId}`} className="text-sm font-semibold text-stone-900 hover:text-navy-600 transition-colors truncate">
                {school.schoolName}
              </Link>
              <Link to={`/schools/${school.schoolId}`} className="flex-shrink-0 text-stone-400 hover:text-navy-500" aria-label={`Open ${school.schoolName}`}>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-stone-500 truncate">{school.districtName} &middot; {school.countyName}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${isTop ? 'bg-navy-600' : 'bg-navy-300'}`} style={{ width: `${school.avgProficiency}%` }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-stone-900">{school.avgProficiency}%</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
              <span className="flex items-center gap-1">
                <UserGroupIcon className="w-3 h-3" />
                {school.totalTested?.toLocaleString() ?? '—'} tested
              </span>
              {school.avgGrowth != null && (
                <span className={band.className} title="PVAAS growth index">growth {school.avgGrowth.toFixed(1)} · {band.label}</span>
              )}
              {school.schoolType && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600">{school.schoolType}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">School Rankings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Share of students proficient or above, weighted by students tested. Schools below the minimum tested are left out.
        </p>
      </div>

      <div className="card-surface p-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYearParam(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Exam" value={examType} onChange={(e) => { setExamType(e.target.value as Exam); setSubject(''); setGrade(''); }}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          {examType === 'pssa' && (
            <FilterSelect label="Grade" value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All Grades</option>
              {[3, 4, 5, 6, 7, 8].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </FilterSelect>
          )}
          <FilterSelect label="School Type" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
            <option value="">All Types</option>
            {filterOptions?.schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSelect label="County" value={countyId} onChange={(e) => setCountyId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All Counties</option>
            {filterOptions?.counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Min. tested" value={minTested} onChange={(e) => setMinTested(Number(e.target.value))}>
            {[20, 40, 100, 250].map((n) => <option key={n} value={n}>{n} students</option>)}
          </FilterSelect>
          <FilterSelect label="Show" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[5, 10, 15, 25].map((n) => <option key={n} value={n}>Top/Bottom {n}</option>)}
          </FilterSelect>
        </div>
      </div>

      {isLoading && (
        <div className="card-surface p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          <p className="mt-3 text-sm text-stone-500">Loading rankings...</p>
        </div>
      )}

      {rankings && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">Highest</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">{rankings.top[0]?.avgProficiency ?? 'N/A'}%</p>
              <p className="text-sm text-stone-700 mt-0.5 truncate">{rankings.top[0]?.schoolName || 'N/A'}</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">State average</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">{rankings.stateAverage != null ? `${rankings.stateAverage}%` : 'N/A'}</p>
              <p className="text-sm text-stone-700 mt-0.5">All students, same subject and grade</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">Lowest</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">{rankings.bottom[0]?.avgProficiency ?? 'N/A'}%</p>
              <p className="text-sm text-stone-700 mt-0.5 truncate">{rankings.bottom[0]?.schoolName || 'N/A'}</p>
            </div>
          </div>

          <div className="card-surface p-4 sm:p-6 mb-8">
            <h2 className="text-base font-semibold text-stone-900 mb-1">Proficiency Rankings</h2>
            <p className="text-xs text-stone-400 mb-4">
              Highest {rankings.top.length} and lowest {rankings.bottom.length} schools by % proficient or above
            </p>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart layout="vertical" data={chartData} margin={{ left: smUp ? 10 : 0, right: smUp ? 30 : 16, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={axisWidth} tick={{ fontSize: smUp ? 11 : 10, fill: '#57534e' }} />
                {rankings.stateAverage != null && (
                  <ReferenceLine x={rankings.stateAverage} stroke={CHART_COLORS.gold} strokeWidth={2} strokeDasharray="6 3"
                    label={{ value: `State Avg: ${rankings.stateAverage}%`, position: 'top', fill: CHART_COLORS.gold, fontSize: 11, fontWeight: 600 }} />
                )}
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Proficiency']}
                  labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => <Cell key={index} fill={entry.isTop ? CHART_COLORS.navy : CHART_COLORS.navyLight} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {points.length > 0 && (
            <div className="card-surface p-4 sm:p-6 mb-8">
              <h2 className="text-base font-semibold text-stone-900 mb-1">Growth vs. achievement</h2>
              <p className="text-xs text-stone-400 mb-4">
                Every school matching the filters ({points.length.toLocaleString()}). Right is higher proficiency; up is more PVAAS growth than the state standard.
                Schools low on achievement but high on growth (teal) are catching up; high achievement with low growth (gold) is coasting.
              </p>
              <ResponsiveContainer width="100%" height={smUp ? 420 : 320}>
                <ScatterChart margin={{ top: 10, right: smUp ? 30 : 12, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" dataKey="proficiency" domain={[0, 100]} name="Proficient or above" tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `${v}%`}
                    label={{ value: '% proficient or above', position: 'insideBottom', offset: -12, fill: '#78716c', fontSize: 11 }} />
                  <YAxis type="number" dataKey="growth" name="Growth index" tick={{ fontSize: 11, fill: '#78716c' }} width={smUp ? 48 : 36}
                    label={smUp ? { value: 'PVAAS growth index', angle: -90, position: 'insideLeft', fill: '#78716c', fontSize: 11 } : undefined} />
                  <ZAxis type="number" dataKey="tested" range={[20, 160]} name="Tested" />
                  <ReferenceLine y={0} stroke="#a8a29e" />
                  {rankings.stateAverage != null && <ReferenceLine x={rankings.stateAverage} stroke={CHART_COLORS.gold} strokeDasharray="6 3" />}
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      const p: any = payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div style={tooltipStyle} className="p-2">
                          <div className="font-medium text-stone-900">{p.schoolName}</div>
                          <div className="text-stone-500">{p.districtName}</div>
                          <div className="mt-1">{p.proficiency}% proficient · growth {p.growth} · {p.tested.toLocaleString()} tested</div>
                        </div>
                      );
                    }} />
                  <Scatter data={points} fillOpacity={0.7}>
                    {points.map((p, i) => <Cell key={i} fill={quadrant(p)} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-4">Highest proficiency</h2>
              <div className="space-y-3">
                {rankings.top.map((school) => <SchoolCard key={school.schoolId} school={school} variant="top" />)}
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-4">Lowest proficiency</h2>
              <div className="space-y-3">
                {rankings.bottom.map((school) => <SchoolCard key={school.schoolId} school={school} variant="bottom" />)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
