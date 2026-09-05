import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import FilterSelect from '../components/FilterSelect';
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
  const { years, latest, earliest } = useAvailableYears();
  const smUp = useIsSmUp();
  const chartHeight = smUp ? 300 : 260;
  // null = latest year in the database; becomes a number once the user picks one.
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const selectedYear = yearChoice ?? latest;
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [examType, setExamType] = useState<'pssa' | 'keystone'>('pssa');

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

  const processDataForChart = () => {
    if (!trendData) return [];
    const dataByYear = trendData.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) acc[year] = { year, proficiency: 0, count: 0 };
      const profValue = item.proficientOrAbovePercent ?? item.avgProficientOrAbove;
      if (profValue != null) {
        acc[year].proficiency += profValue;
        acc[year].count += 1;
      }
      return acc;
    }, {});
    return Object.values(dataByYear)
      .filter((d: any) => d.count > 0)
      .map((d: any) => ({ year: d.year, proficiency: parseFloat((d.proficiency / d.count).toFixed(1)) }))
      .sort((a: any, b: any) => a.year - b.year);
  };

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

  const chartData = processDataForChart();
  const subjectData = processSubjectData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">State Performance</h1>
            <p className="mt-1 text-sm text-stone-500">Statewide academic performance trends and analysis</p>
          </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mb-8">
          <FilterSelect label="Exam" value={examType} onChange={(e) => setExamType(e.target.value as 'pssa' | 'keystone')}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label="Year" value={selectedYear ?? ''} onChange={(e) => setYearChoice(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Subject" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            {(examType === 'pssa'
              ? ['Mathematics', 'English Language Arts', 'Science']
              : ['Algebra I', 'Biology', 'Literature']
            ).map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
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
              <h2 className="text-base font-semibold text-stone-900 mb-4">
                {selectedSubject} Proficiency Trends
              </h2>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }}
                    label={{ value: '% Proficient', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="proficiency" stroke={CHART_COLORS.navy} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.navy }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
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
              <p className="text-xs text-stone-400 mb-4">Share of students at each level, statewide</p>
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
            </div>

            {/* Key Stats */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Key Statistics ({selectedYear})</h2>
              <div className="space-y-4">
                {[
                  { label: 'Tests scored', value: testsScored ? testsScored.toLocaleString() : '—' },
                  { label: 'Average Proficiency', value: (() => {
                    if (!stateData) return '—';
                    const valid = stateData.filter((d: any) => d.avgProficientOrAbove != null);
                    if (valid.length === 0) return '—';
                    return `${(valid.reduce((sum: number, d: any) => sum + d.avgProficientOrAbove, 0) / valid.length).toFixed(1)}%`;
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
    </div>
  );
}
