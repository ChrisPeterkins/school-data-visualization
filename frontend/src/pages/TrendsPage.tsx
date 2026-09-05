import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import FilterSelect from '../components/FilterSelect';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid';

const COLORS = {
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

export default function TrendsPage() {
  const [level, setLevel] = useState<'state' | 'district' | 'school'>('state');
  const [examType, setExamType] = useState<'pssa' | 'keystone'>('pssa');
  const [subject, setSubject] = useState('Mathematics');
  const [grade, setGrade] = useState<number | null>(null);
  const availableYears = useAvailableYears();
  const { earliest, latest } = availableYears;
  const yearRange = formatYearRange(availableYears);
  const smUp = useIsSmUp();
  const bigChartHeight = smUp ? 400 : 300;

  const { data: trendsData, isLoading } = useQuery({
    queryKey: ['trends-analysis', level, examType, subject, grade, earliest, latest],
    queryFn: async () => {
      const params: any = { level, subject, yearFrom: earliest, yearTo: latest };
      if (examType === 'pssa' && grade) params.grade = grade;
      return examType === 'pssa'
        ? performanceApi.getPSSAResults(params)
        : performanceApi.getKeystoneResults(params);
    },
    enabled: earliest != null && latest != null,
  });

  const processYearlyTrends = () => {
    if (!trendsData) return [];
    const yearlyData = trendsData.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) acc[year] = {
        year,
        totalProficiency: 0, count: 0,
        advancedSum: 0, advancedCount: 0,
        proficientSum: 0, proficientCount: 0,
        basicSum: 0, basicCount: 0,
        belowBasicSum: 0, belowBasicCount: 0,
      };
      if (item.proficientOrAbovePercent != null) {
        acc[year].totalProficiency += item.proficientOrAbovePercent;
        acc[year].count += 1;
      }
      if (item.advancedPercent != null) { acc[year].advancedSum += item.advancedPercent; acc[year].advancedCount += 1; }
      if (item.proficientPercent != null) { acc[year].proficientSum += item.proficientPercent; acc[year].proficientCount += 1; }
      if (item.basicPercent != null) { acc[year].basicSum += item.basicPercent; acc[year].basicCount += 1; }
      if (item.belowBasicPercent != null) { acc[year].belowBasicSum += item.belowBasicPercent; acc[year].belowBasicCount += 1; }
      return acc;
    }, {});
    return Object.values(yearlyData)
      .map((d: any) => ({
        year: d.year,
        proficiency: d.count > 0 ? parseFloat((d.totalProficiency / d.count).toFixed(1)) : null,
        advanced: d.advancedCount > 0 ? parseFloat((d.advancedSum / d.advancedCount).toFixed(1)) : null,
        proficient: d.proficientCount > 0 ? parseFloat((d.proficientSum / d.proficientCount).toFixed(1)) : null,
        basic: d.basicCount > 0 ? parseFloat((d.basicSum / d.basicCount).toFixed(1)) : null,
        belowBasic: d.belowBasicCount > 0 ? parseFloat((d.belowBasicSum / d.belowBasicCount).toFixed(1)) : null,
        count: d.count
      }))
      .sort((a: any, b: any) => a.year - b.year);
  };

  const calculateGrowth = (data: any[]) => {
    if (data.length < 2) return { value: '0', trend: 'neutral' as const };
    const recent = data[data.length - 1].proficiency;
    const previous = data[data.length - 2].proficiency;
    const change = recent - previous;
    return {
      value: Math.abs(change).toFixed(1),
      trend: (change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral'
    };
  };

  const yearlyTrends = processYearlyTrends();
  const growth = calculateGrowth(yearlyTrends);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Performance Trends</h1>
            <p className="mt-1 text-sm text-stone-500">
              Analyze academic performance trends{earliest && latest ? ` from ${earliest} to ${latest}` : ''}
            </p>
          </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 mb-8">
          <FilterSelect label="Level" value={level} onChange={(e) => setLevel(e.target.value as 'state' | 'district' | 'school')}>
            <option value="state">State</option>
            <option value="district">District</option>
            <option value="school">School</option>
          </FilterSelect>
          <FilterSelect label="Exam" value={examType} onChange={(e) => { const v = e.target.value as 'pssa' | 'keystone'; setExamType(v); setGrade(null); setSubject(v === 'pssa' ? 'Mathematics' : 'Algebra I'); }}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {(examType === 'pssa' ? ['Mathematics', 'English Language Arts', 'Science'] : ['Algebra I', 'Biology', 'Literature']).map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          {examType === 'pssa' && (
            <FilterSelect label="Grade" value={grade || ''} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Grades</option>
              {[3, 4, 5, 6, 7, 8].map(g => <option key={g} value={g}>Grade {g}</option>)}
            </FilterSelect>
          )}
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
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">Latest proficiency</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{yearlyTrends[yearlyTrends.length - 1]?.proficiency ?? 'N/A'}%</p>
                <p className={`mt-2 inline-flex items-center gap-1 text-sm ${growth.trend === 'up' ? 'text-civic-700' : growth.trend === 'down' ? 'text-brick-600' : 'text-stone-500'}`}>
                  {growth.trend === 'up' ? <ArrowUpIcon className="h-3.5 w-3.5" /> :
                   growth.trend === 'down' ? <ArrowDownIcon className="h-3.5 w-3.5" /> :
                   <MinusIcon className="h-3.5 w-3.5" />}
                  {growth.value} pts from the previous year
                </p>
              </div>

              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">{yearRange ? `Average, ${yearRange}` : 'Average, all years'}</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">
                  {yearlyTrends.length > 0 ? (yearlyTrends.filter(d => d.proficiency != null).reduce((sum, d) => sum + (d.proficiency ?? 0), 0) / (yearlyTrends.filter(d => d.proficiency != null).length || 1)).toFixed(1) : 'N/A'}%
                </p>
                <p className="mt-2 text-sm text-stone-500">Mean of yearly proficiency rates</p>
              </div>

              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">Result rows</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{(trendsData?.length || 0).toLocaleString()}</p>
                <p className="mt-2 text-sm text-stone-500">Assessment records behind these charts</p>
              </div>
            </div>

            {/* Main Trend Line */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Proficiency Rate{yearRange ? ` (${yearRange})` : ''}</h2>
              <ResponsiveContainer width="100%" height={bigChartHeight}>
                <LineChart data={yearlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }}
                    label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="proficiency" stroke={COLORS.navy} strokeWidth={3} dot={{ r: 5, fill: COLORS.navy }} activeDot={{ r: 7 }} name="Overall Proficiency" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stacked Area */}
            {yearlyTrends.some(d => d.advanced != null && d.advanced > 0) && (
              <div className="card-surface p-4 sm:p-6">
                <h2 className="text-base font-semibold text-stone-900 mb-4">Performance Level Distribution</h2>
                <ResponsiveContainer width="100%" height={bigChartHeight}>
                  <AreaChart data={yearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }}
                      label={{ value: 'Percentage', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="advanced" stackId="1" stroke={COLORS.civic} fill={COLORS.civic} fillOpacity={0.8} name="Advanced" />
                    <Area type="monotone" dataKey="proficient" stackId="1" stroke={COLORS.navy} fill={COLORS.navy} fillOpacity={0.8} name="Proficient" />
                    <Area type="monotone" dataKey="basic" stackId="1" stroke={COLORS.gold} fill={COLORS.gold} fillOpacity={0.8} name="Basic" />
                    <Area type="monotone" dataKey="belowBasic" stackId="1" stroke={COLORS.brick} fill={COLORS.brick} fillOpacity={0.8} name="Below Basic" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* YoY Change */}
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Year-over-Year Change</h2>
              <ResponsiveContainer width="100%" height={smUp ? 300 : 260}>
                <BarChart data={yearlyTrends.slice(1).map((d, i) => ({
                  year: d.year,
                  change: (d.proficiency != null && yearlyTrends[i].proficiency != null)
                    ? parseFloat((d.proficiency - yearlyTrends[i].proficiency).toFixed(1))
                    : null,
                })).filter(d => d.change != null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[-20, 20]} tick={{ fontSize: 12, fill: '#78716c' }}
                    label={{ value: 'Change (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="change" name="YoY Change" radius={[4, 4, 0, 0]}>
                    {yearlyTrends.slice(1)
                      .filter((d, i) => d.proficiency != null && yearlyTrends[i].proficiency != null)
                      .map((d, i) => {
                      const change = (d.proficiency ?? 0) - (yearlyTrends[i].proficiency ?? 0);
                      return <Cell key={i} fill={change >= 0 ? COLORS.civic : COLORS.brick} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
