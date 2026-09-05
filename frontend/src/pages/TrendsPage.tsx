import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid';
import { performanceApi } from '../services/api';
import { useAvailableYears, formatYearRange, yearsForExam } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import DataNotes from '../components/DataNotes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  fillYearGaps, standardsChangeLine, covidGapArea, CHART_COLORS, tooltipStyle, formatPct,
} from '../lib/chartUtils';

const PSSA_SUBJECTS = ['Mathematics', 'English Language Arts', 'Science'];
const KEYSTONE_SUBJECTS = ['Algebra I', 'Biology', 'Literature'];
type Level = 'state' | 'district' | 'school';
type Exam = 'pssa' | 'keystone';

const LEVEL_NOUN: Record<Level, string> = { state: 'statewide', district: 'districts', school: 'schools' };

export default function TrendsPage() {
  const [level, setLevel] = useUrlState<Level>('level', 'state', (r) => (['state', 'district', 'school'].includes(r) ? (r as Level) : null));
  const [examType, setExamType] = useUrlState<Exam>('exam', 'pssa', (r) => (r === 'pssa' || r === 'keystone' ? r : null));
  const subjects = examType === 'pssa' ? PSSA_SUBJECTS : KEYSTONE_SUBJECTS;
  const [subjectParam, setSubject] = useUrlState<string>('subject', subjects[0], parseString);
  const subject = subjects.includes(subjectParam) ? subjectParam : subjects[0];
  const [grade, setGrade] = useUrlState<number | null>('grade', null, parseNumber, (v) => (v == null ? '' : String(v)));

  const availableYears = useAvailableYears();
  // Year range for the selected exam (the archived 2013-14 files are Keystone-only).
  const examYears = yearsForExam(availableYears, examType);
  const earliest = examYears.length ? examYears[examYears.length - 1] : availableYears.earliest;
  const latest = examYears.length ? examYears[0] : availableYears.latest;
  const yearRange = formatYearRange({ years: examYears, earliest, latest });
  const smUp = useIsSmUp();
  const bigChartHeight = smUp ? 400 : 300;
  useDocumentTitle(`${subject} trends, ${LEVEL_NOUN[level]}`, `How ${subject} proficiency has changed across Pennsylvania ${LEVEL_NOUN[level]} since ${earliest ?? 2015}.`);

  const { data, isLoading } = useQuery({
    queryKey: ['summary', examType, level, subject, grade, earliest, latest],
    queryFn: () => performanceApi.getSummary({
      exam: examType,
      level,
      subject,
      grade: examType === 'pssa' && grade ? grade : undefined,
      yearFrom: earliest!,
      yearTo: latest!,
    }),
    enabled: earliest != null && latest != null,
  });

  const series = data?.series ?? [];
  const chartData = fillYearGaps(series);
  const years = series.map((d) => d.year);
  const latestPoint = series[series.length - 1];
  const previousPoint = series[series.length - 2];
  const change = latestPoint?.proficiency != null && previousPoint?.proficiency != null
    ? latestPoint.proficiency - previousPoint.proficiency
    : null;
  const trend = change == null ? 'neutral' : change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral';

  const yoy = series.slice(1).map((d, i) => {
    const prev = series[i];
    const delta = d.proficiency != null && prev.proficiency != null ? parseFloat((d.proficiency - prev.proficiency).toFixed(1)) : null;
    return { label: d.year - prev.year > 1 ? `${prev.year}–${d.year}` : String(d.year), change: delta };
  }).filter((d) => d.change != null) as Array<{ label: string; change: number }>;
  const yoyMax = Math.max(5, ...yoy.map((d) => Math.abs(d.change)));

  const hasLevels = series.some((d) => d.advanced != null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Performance Trends</h1>
        <p className="mt-1 text-sm text-stone-500">
          Share of students proficient or above{earliest && latest ? `, ${earliest} to ${latest}` : ''}, weighted by students tested
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mb-8">
        <FilterSelect label="Level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
          <option value="state">State</option>
          <option value="district">District</option>
          <option value="school">School</option>
        </FilterSelect>
        <FilterSelect label="Exam" value={examType} onChange={(e) => { const v = e.target.value as Exam; setExamType(v); setGrade(null); setSubject(v === 'pssa' ? 'Mathematics' : 'Algebra I'); }}>
          <option value="pssa">PSSA</option>
          <option value="keystone">Keystone</option>
        </FilterSelect>
        <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
        {examType === 'pssa' && (
          <FilterSelect label="Grade" value={grade ?? ''} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
            <option value="">All grades</option>
            {[3, 4, 5, 6, 7, 8].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </FilterSelect>
        )}
      </div>

      {isLoading || series.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`card-surface p-6 ${isLoading ? 'animate-pulse' : ''}`}>
              <div className="h-4 bg-stone-200 rounded w-3/4 mb-4" />
              <div className="h-48 bg-stone-100 rounded flex items-center justify-center text-sm text-stone-400">
                {isLoading ? '' : 'No results for this selection'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">Proficient or above, {latestPoint.year}</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{formatPct(latestPoint.proficiency)}</p>
              <p className={`mt-2 inline-flex items-center gap-1 text-sm ${trend === 'up' ? 'text-teal-700' : trend === 'down' ? 'text-brick-600' : 'text-stone-500'}`}>
                {trend === 'up' ? <ArrowUpIcon className="h-3.5 w-3.5" /> : trend === 'down' ? <ArrowDownIcon className="h-3.5 w-3.5" /> : <MinusIcon className="h-3.5 w-3.5" />}
                {change == null ? 'No prior year' : `${Math.abs(change).toFixed(1)} pts vs ${previousPoint.year}`}
              </p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">Students tested, {latestPoint.year}</p>
              <p className="text-2xl font-bold text-stone-900 mt-1 tabular-nums">{latestPoint.tested.toLocaleString()}</p>
              <p className="mt-2 text-sm text-stone-500">
                {level === 'state' ? 'Statewide' : `Across ${latestPoint.entities.toLocaleString()} ${LEVEL_NOUN[level]}`}
              </p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">{yearRange ? `Average, ${yearRange}` : 'Average, all years'}</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">
                {formatPct(series.filter((d) => d.proficiency != null).reduce((s, d) => s + (d.proficiency ?? 0), 0) / (series.filter((d) => d.proficiency != null).length || 1))}
              </p>
              <p className="mt-2 text-sm text-stone-500">Mean of the yearly rates</p>
            </div>
          </div>

          <DataNotes subject={subject} exam={examType} years={years} latestAvailable={latest} />

          <div className="card-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Proficient or above{yearRange ? ` (${yearRange})` : ''}</h2>
            <ResponsiveContainer width="100%" height={bigChartHeight}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Proficient or above']} />
                {covidGapArea(years)}
                {standardsChangeLine(years)}
                <Line type="monotone" dataKey="proficiency" connectNulls={false} stroke={CHART_COLORS.navy} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.navy }} activeDot={{ r: 6 }} name="Proficient or above" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {hasLevels && (
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Performance levels</h2>
              <ResponsiveContainer width="100%" height={bigChartHeight}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {covidGapArea(years, '')}
                  {standardsChangeLine(years, '')}
                  <Area type="monotone" dataKey="advanced" stackId="1" stroke={CHART_COLORS.navyDark} fill={CHART_COLORS.navyDark} fillOpacity={0.9} name="Advanced" connectNulls={false} />
                  <Area type="monotone" dataKey="proficient" stackId="1" stroke={CHART_COLORS.navyMid} fill={CHART_COLORS.navyMid} fillOpacity={0.9} name="Proficient" connectNulls={false} />
                  <Area type="monotone" dataKey="basic" stackId="1" stroke={CHART_COLORS.navyLight} fill={CHART_COLORS.navyLight} fillOpacity={0.9} name="Basic" connectNulls={false} />
                  <Area type="monotone" dataKey="belowBasic" stackId="1" stroke={CHART_COLORS.stone} fill={CHART_COLORS.stone} fillOpacity={0.9} name="Below Basic" connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {yoy.length > 0 && (
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-1">Change from the previous results</h2>
              <p className="text-xs text-stone-400 mb-4">Percentage points. The 2019 to 2021 bar spans the year with no testing.</p>
              <ResponsiveContainer width="100%" height={smUp ? 300 : 260}>
                <BarChart data={yoy}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis domain={[-Math.ceil(yoyMax), Math.ceil(yoyMax)]} tick={{ fontSize: 12, fill: '#78716c' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v} pts`, 'Change']} />
                  <Bar dataKey="change" name="Change" radius={[3, 3, 0, 0]}>
                    {yoy.map((d, i) => <Cell key={i} fill={d.change >= 0 ? CHART_COLORS.navy : CHART_COLORS.navyLight} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
