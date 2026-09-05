import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { SchoolPerformanceTrends } from '@shared';
import { fillYearGaps, standardsChangeLine, tooltipStyle } from '../lib/chartUtils';

interface PerformanceChartProps {
  data: SchoolPerformanceTrends;
}

const chartColors = ['#2d4a6f', '#27ab83', '#d4aa3c', '#c53030', '#4a6d8c', '#199473', '#7a9bb5', '#65d6ad'];

/**
 * A school's proficiency over time. PSSA defaults to one line per subject
 * (the all-grades total) with a toggle for every grade, which is the busier
 * view; Keystone is always one line per subject.
 */
function seriesKeys(rows: any[]): string[] {
  const keys = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => k !== 'year' && keys.add(k)));
  return [...keys].sort();
}

function ChartCard({ title, chartData, years, exam, action }: { title: string; chartData: any[]; years: number[]; exam: 'pssa' | 'keystone'; action?: React.ReactNode }) {
  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        {action}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {exam === 'pssa' ? standardsChangeLine(years) : null}
          {seriesKeys(chartData).map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              connectNulls={false}
              stroke={chartColors[index % chartColors.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const pssa = data.pssaTrends as any[];
  const hasTotals = pssa.some((r) => r.grade === 0 && r.proficientOrAbove != null);
  const [byGrade, setByGrade] = useState(!hasTotals);
  const showTotals = hasTotals && !byGrade;

  const pssaRows = pssa.filter((r) => r.proficientOrAbove != null && (showTotals ? r.grade === 0 : r.grade !== 0));
  const pssaByYear: Record<number, any> = {};
  for (const r of pssaRows) {
    const key = showTotals ? r.subject : `${r.subject} · Grade ${r.grade}`;
    pssaByYear[r.year] = pssaByYear[r.year] ?? { year: r.year };
    pssaByYear[r.year][key] = r.proficientOrAbove;
  }
  const pssaData = fillYearGaps(Object.values(pssaByYear).sort((a, b) => a.year - b.year));
  const pssaYears = Object.keys(pssaByYear).map(Number);

  const keystoneByYear: Record<number, any> = {};
  for (const r of data.keystoneTrends as any[]) {
    if (r.proficientOrAbove == null) continue;
    keystoneByYear[r.year] = keystoneByYear[r.year] ?? { year: r.year };
    keystoneByYear[r.year][r.subject] = r.proficientOrAbove;
  }
  const keystoneData = fillYearGaps(Object.values(keystoneByYear).sort((a, b) => a.year - b.year));


  return (
    <div className="space-y-6">
      {pssaData.length > 0 && (
        <ChartCard
          title="PSSA proficient or above"
          chartData={pssaData}
          years={pssaYears}
          exam="pssa"
          action={hasTotals ? (
            <div className="inline-flex rounded-lg border border-stone-200 text-xs font-medium overflow-hidden" role="group" aria-label="PSSA chart detail">
              <button onClick={() => setByGrade(false)} aria-pressed={!byGrade} className={`px-3 py-1.5 ${!byGrade ? 'bg-navy-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>All grades</button>
              <button onClick={() => setByGrade(true)} aria-pressed={byGrade} className={`px-3 py-1.5 border-l border-stone-200 ${byGrade ? 'bg-navy-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}>By grade</button>
            </div>
          ) : undefined}
        />
      )}
      {keystoneData.length > 0 && <ChartCard title="Keystone proficient or above" chartData={keystoneData} years={Object.keys(keystoneByYear).map(Number)} exam="keystone" />}
      {pssaData.length === 0 && keystoneData.length === 0 && (
        <div className="card-surface p-8 text-center">
          <p className="text-stone-400">No performance data available for this school.</p>
        </div>
      )}
    </div>
  );
}
