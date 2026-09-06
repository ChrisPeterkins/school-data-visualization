import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import DataNotes from '../components/DataNotes';
import GapsPanel from '../components/GapsPanel';
import AccessibleChart from '../components/AccessibleChart';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { fillYearGaps, standardsChangeLine, covidGapArea } from '../lib/chartUtils';
import { useT } from '../i18n';
import IndicatorsPanel from '../components/IndicatorsPanel';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const CHART_COLORS = {
  navy: '#2d4a6f',
  civic: '#27ab83',
  gold: '#d4aa3c',
  brick: '#c53030',
};

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  borderRadius: '0.5rem',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

export default function StatePage() {
  const t = useT();
  const availableYears = useAvailableYears();
  const { latest, earliest } = availableYears;
  const smUp = useIsSmUp();
  const chartHeight = smUp ? 300 : 260;
  // null = latest year in the database; becomes a number once the user picks one.
  const [yearChoice, setYearChoice] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const selectedYear = yearChoice ?? latest;
  const [examType, setExamType] = useUrlState<'pssa' | 'keystone'>('exam', 'pssa', (r) => (r === 'pssa' || r === 'keystone' ? r : null));
  const years = yearsForExam(availableYears, examType);
  const subjectOptions = examType === 'pssa' ? ['Mathematics', 'English Language Arts', 'Science'] : ['Algebra I', 'Biology', 'Literature'];
  const [subjectParam, setSelectedSubject] = useUrlState<string>('subject', subjectOptions[0], parseString);
  const selectedSubject = subjectOptions.includes(subjectParam) ? subjectParam : subjectOptions[0];

  // Student-weighted statewide series for the trend line (one total row per year).
  const { data: summary } = useQuery({
    queryKey: ['summary', examType, 'state', selectedSubject],
    queryFn: () => performanceApi.getSummary({ exam: examType, level: 'state', subject: selectedSubject }),
  });
  const trendSeries = summary?.series ?? [];
  const trendYears = trendSeries.map((d) => d.year);
  useDocumentTitle(`Statewide ${selectedSubject} results${selectedYear ? `, ${selectedYear}` : ''}`, 'Pennsylvania statewide PSSA and Keystone proficiency, performance levels by grade, and achievement gaps.');

  const { data: statePerformance, isLoading } = useQuery({
    queryKey: ['state-performance', selectedYear],
    queryFn: () => performanceApi.getStatePerformance(selectedYear!),
    enabled: selectedYear != null,
  });

  const stateData = examType === 'pssa' ? statePerformance?.pssa : statePerformance?.keystone;

  const { data: trendData } = useQuery({
    queryKey: ['state-trends', examType, selectedSubject, earliest, latest],
    queryFn: async () => {
      const range = { yearFrom: earliest!, yearTo: latest! };
      if (examType === 'pssa') {
        return performanceApi.getPSSAResults({ subject: selectedSubject, level: 'state', ...range });
      } else {
        return performanceApi.getKeystoneResults({ subject: selectedSubject, level: 'state', ...range });
      }
    },
    enabled: earliest != null && latest != null,
  });

  const processSubjectData = () => {
    if (!stateData) return [];
    const subjectData = stateData.reduce((acc: any, item: any) => {
      const subject = item.subject;
      if (!acc[subject]) acc[subject] = { subject, totalProficiency: 0, count: 0 };
      if (item.avgProficientOrAbove != null) {
        acc[subject].totalProficiency += item.avgProficientOrAbove;
        acc[subject].count += 1;
      }
      return acc;
    }, {});
    return Object.values(subjectData)
      .map((d: any) => ({ subject: d.subject, proficiency: d.count > 0 ? parseFloat((d.totalProficiency / d.count).toFixed(1)) : 0 }))
      .sort((a: any, b: any) => b.proficiency - a.proficiency);
  };

  // Performance levels by grade for the selected subject and year, from the
  // same state-level rows that feed the trend line. Grade 0 is PDE's "Total".
  const gradeLabel = (g: number | null | undefined) => (g == null || g === 0 ? 'All' : `Gr ${g}`);
  const gradeOrder = (g: number | null | undefined) => (g == null || g === 0 ? 99 : g);
  const levelsByGrade = (trendData ?? [])
    .filter((r: any) => r.year === selectedYear && r.advancedPercent != null)
    .sort((a: any, b: any) => gradeOrder(a.grade) - gradeOrder(b.grade))
    .map((r: any) => ({
      grade: gradeLabel(r.grade),
      Advanced: r.advancedPercent,
      Proficient: r.proficientPercent,
      Basic: r.basicPercent,
      'Below Basic': r.belowBasicPercent,
    }));

  const testsScored = (() => {
    if (!stateData) return null;
    const rows = examType === 'pssa' ? stateData.filter((d: any) => d.grade === 0) : stateData;
    const n = rows.reduce((sum: number, d: any) => sum + (d.totalStudents || 0), 0);
    return n || null;
  })();

  const chartData = fillYearGaps(trendSeries.map((d) => ({ year: d.year, proficiency: d.proficiency })));
  const subjectData = processSubjectData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('pages.state.title')}</h1>
            <p className="mt-1 text-sm text-stone-500">{t('pages.state.sub')}</p>
          </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mb-8">
          <FilterSelect label={t('common.exam')} value={examType} onChange={(e) => setExamType(e.target.value as 'pssa' | 'keystone')}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label={t('common.year')} value={selectedYear ?? ''} onChange={(e) => setYearChoice(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label={t('common.subject')} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
        </div>

        <div className="mb-6">
          <DataNotes subject={selectedSubject} exam={examType} years={trendYears} latestAvailable={latest} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card-surface p-6 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-3/4 mb-4" />
                <div className="h-48 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trends Chart */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-1">
                {selectedSubject} proficient or above, statewide
              </h2>
              <p className="text-xs text-stone-500 mb-4">{t('state.allGrades')}</p>
              <AccessibleChart label={`${selectedSubject} proficient or above statewide, by year`} rows={trendSeries.map((d) => ({ year: d.year, proficiency: d.proficiency }))} columns={[{ key: 'year', label: 'Year' }, { key: 'proficiency', label: '% proficient or above' }]}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Proficient or above']} />
                  {covidGapArea(trendYears)}
                  {examType === 'pssa' ? standardsChangeLine(trendYears) : null}
                  <Line type="monotone" dataKey="proficiency" connectNulls={false} stroke={CHART_COLORS.navy} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.navy }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
              </AccessibleChart>
            </div>

            {/* Subject Comparison */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">
                Subject Comparison ({selectedYear})
              </h2>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="subject" angle={-20} textAnchor="end" height={70} tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }}
                    label={{ value: '% Proficient', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="proficiency" fill={CHART_COLORS.navy} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance levels by grade */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-1">
                {selectedSubject} Performance Levels by Grade ({selectedYear})
              </h2>
              <p className="text-xs text-stone-500 mb-4">{t('state.levels')}</p>
              <AccessibleChart label={`${selectedSubject} performance levels by grade, ${selectedYear}`} rows={levelsByGrade}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={levelsByGrade}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#78716c' }} />
                  {/* Rounded level shares can sum to 100.1, so clip rather than stretch the axis. */}
                  <YAxis domain={[0, 100]} allowDataOverflow ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Advanced" stackId="levels" fill="#243b5c" />
                  <Bar dataKey="Proficient" stackId="levels" fill="#4a6d8c" />
                  <Bar dataKey="Basic" stackId="levels" fill="#a8c3d8" />
                  <Bar dataKey="Below Basic" stackId="levels" fill="#d6d3d1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </AccessibleChart>
            </div>

            {/* Key Stats */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">{t('state.keyStats', { year: selectedYear ?? '' })}</h2>
              <div className="space-y-4">
                {[
                  { label: 'Tests scored', value: testsScored ? testsScored.toLocaleString() : '—' },
                  { label: 'Proficient or above, all subjects', value: (() => {
                    // Weight each subject's all-grades total by its students tested.
                    if (!stateData) return '—';
                    const totals = stateData.filter((d: any) => d.avgProficientOrAbove != null && (examType === 'keystone' || d.grade === 0) && d.totalStudents > 0);
                    const tested = totals.reduce((s: number, d: any) => s + d.totalStudents, 0);
                    if (!tested) return '—';
                    return `${(totals.reduce((s: number, d: any) => s + d.avgProficientOrAbove * d.totalStudents, 0) / tested).toFixed(1)}%`;
                  })(), highlight: true },
                  { label: 'Highest Subject', value: subjectData[0]?.subject || '—' },
                  { label: 'Lowest Subject', value: subjectData[subjectData.length - 1]?.subject || '—' },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-stone-100 last:border-0">
                    <span className="text-sm text-stone-500">{stat.label}</span>
                    <span className={`text-lg font-semibold ${stat.highlight ? 'text-navy-600' : 'text-stone-900'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <IndicatorsPanel entity="state" />
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">{t('state.gaps')}</h2>
        <GapsPanel level="state" year={selectedYear ?? undefined} />
      </div>
    </div>
  );
}
