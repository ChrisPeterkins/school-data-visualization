import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import { motion } from 'framer-motion';
import { GlobeAmericasIcon } from '@heroicons/react/24/outline';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
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
  const [selectedYear, setSelectedYear] = useState(2023);
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [examType, setExamType] = useState<'pssa' | 'keystone'>('pssa');

  const { data: statePerformance, isLoading } = useQuery({
    queryKey: ['state-performance', selectedYear],
    queryFn: () => performanceApi.getStatePerformance(selectedYear),
  });

  const stateData = examType === 'pssa' ? statePerformance?.pssa : statePerformance?.keystone;

  const { data: trendData } = useQuery({
    queryKey: ['state-trends', examType, selectedSubject],
    queryFn: async () => {
      if (examType === 'pssa') {
        return performanceApi.getPSSAResults({ subject: selectedSubject, level: 'state', yearFrom: 2015, yearTo: 2024 });
      } else {
        return performanceApi.getKeystoneResults({ subject: selectedSubject, level: 'state', yearFrom: 2015, yearTo: 2024 });
      }
    },
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
      .map((d: any) => ({ year: d.year, proficiency: d.count > 0 ? (d.proficiency / d.count).toFixed(1) : 0 }))
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

  const processProficiencyDistribution = () => {
    if (!stateData) return [];
    const ranges = [
      { name: 'Advanced (80-100%)', min: 80, max: 100, count: 0, color: CHART_COLORS.civic },
      { name: 'Proficient (60-79%)', min: 60, max: 79, count: 0, color: CHART_COLORS.navy },
      { name: 'Basic (40-59%)', min: 40, max: 59, count: 0, color: CHART_COLORS.gold },
      { name: 'Below Basic (<40%)', min: 0, max: 39, count: 0, color: CHART_COLORS.brick },
    ];
    stateData.forEach((item: any) => {
      if (item.avgProficientOrAbove != null) {
        const prof = item.avgProficientOrAbove;
        ranges.forEach(range => { if (prof >= range.min && prof <= range.max) range.count++; });
      }
    });
    return ranges.filter(r => r.count > 0);
  };

  const chartData = processDataForChart();
  const subjectData = processSubjectData();
  const distributionData = processProficiencyDistribution();
  const years = [2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016, 2015];

  const FilterSelect = ({ label, value, onChange, children }: any) => (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-stone-500">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
      >
        {children}
      </select>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start gap-4 mb-8">
          <div className="p-2.5 rounded-xl bg-gold-100">
            <GlobeAmericasIcon className="w-6 h-6 text-gold-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">State Performance</h1>
            <p className="mt-1 text-sm text-stone-500">Statewide academic performance trends and analysis</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <FilterSelect label="Exam" value={examType} onChange={(e: any) => setExamType(e.target.value)}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label="Year" value={selectedYear} onChange={(e: any) => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Subject" value={selectedSubject} onChange={(e: any) => setSelectedSubject(e.target.value)}>
            {(examType === 'pssa'
              ? ['Mathematics', 'English Language Arts', 'Science']
              : ['Algebra I', 'Biology', 'Literature']
            ).map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card-philly p-6 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-3/4 mb-4" />
                <div className="h-48 bg-stone-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trends Chart */}
            <div className="card-philly p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">
                {selectedSubject} Proficiency Trends
              </h2>
              <ResponsiveContainer width="100%" height={300}>
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
            <div className="card-philly p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">
                Subject Comparison ({selectedYear})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
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

            {/* Distribution */}
            <div className="card-philly p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">
                Proficiency Distribution ({selectedYear})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={distributionData} cx="50%" cy="50%" labelLine={false}
                    label={(entry) => `${entry.name.split(' ')[0]}: ${entry.count}`}
                    outerRadius={90} innerRadius={40} dataKey="count" stroke="none">
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Key Stats */}
            <div className="card-philly p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Key Statistics ({selectedYear})</h2>
              <div className="space-y-4">
                {[
                  { label: 'Total Assessments', value: stateData?.length || 0 },
                  { label: 'Average Proficiency', value: (() => {
                    if (!stateData) return 'N/A';
                    const valid = stateData.filter((d: any) => d.avgProficientOrAbove != null);
                    if (valid.length === 0) return 'N/A';
                    return `${(valid.reduce((sum: number, d: any) => sum + d.avgProficientOrAbove, 0) / valid.length).toFixed(1)}%`;
                  })(), highlight: true },
                  { label: 'Highest Subject', value: subjectData[0]?.subject || 'N/A' },
                  { label: 'Lowest Subject', value: subjectData[subjectData.length - 1]?.subject || 'N/A' },
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
      </motion.div>
    </div>
  );
}
