import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AccessibleChart from './AccessibleChart';
import FilterSelect from './FilterSelect';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { tooltipStyle } from '../lib/chartUtils';

interface Row { year: number; grade?: number | null; subject: string; percentProficientOrAbove: number | null }

const COHORT_COLORS = ['#1b2a4a', '#2d4a6f', '#4a6d8c', '#7a9bb5', '#27ab83', '#d4aa3c', '#c53030', '#a82828', '#199473', '#997321'];

/**
 * Follow a class through the grades: the students who were grade 3 in one
 * year are (mostly) grade 4 the next. Each line is one cohort, x is the
 * grade, so a rising line means the class gained ground as it moved up.
 */
export default function CohortChart({ rows, entityName }: { rows: Row[]; entityName: string }) {
  const smUp = useIsSmUp();
  const subjects = [...new Set(rows.filter((r) => r.grade && r.grade > 0).map((r) => r.subject))].sort();
  const [subject, setSubject] = useState(subjects[0] ?? 'Mathematics');
  if (subjects.length === 0) return null;

  // cohort key = year - grade (constant as a class advances one grade per year)
  const byCohort: Record<number, Record<number, number>> = {};
  for (const r of rows) {
    if (r.subject !== subject || !r.grade || r.grade <= 0 || r.percentProficientOrAbove == null) continue;
    const key = r.year - r.grade;
    byCohort[key] = byCohort[key] ?? {};
    byCohort[key][r.grade] = r.percentProficientOrAbove;
  }
  const grades = [...new Set(rows.filter((r) => r.subject === subject && r.grade && r.grade > 0).map((r) => r.grade!))].sort((a, b) => a - b);
  const cohorts = Object.entries(byCohort)
    .map(([k, g]) => ({ key: Number(k), points: g, count: Object.keys(g).length }))
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.key - a.key)
    .slice(0, 8);
  if (cohorts.length === 0) return null;

  const label = (c: { key: number; points: Record<number, number> }) => {
    const first = Math.min(...Object.keys(c.points).map(Number));
    return `Grade ${first} in ${c.key + first}`;
  };
  const data = grades.map((g) => {
    const row: any = { grade: `Grade ${g}` };
    cohorts.forEach((c) => { if (c.points[g] != null) row[label(c)] = c.points[g]; });
    return row;
  });

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-base font-semibold text-stone-900">Following each class through the grades</h3>
          <p className="text-xs text-stone-400">Each line is one cohort as it moves up a grade each year; a rising line means the class gained ground. 2020 had no tests, so lines skip a grade there.</p>
        </div>
        <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fluid={false}>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </FilterSelect>
      </div>
      <AccessibleChart label={`${entityName}: ${subject} proficiency by cohort and grade`} rows={data}>
        <ResponsiveContainer width="100%" height={smUp ? 320 : 260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#78716c' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {cohorts.map((c, i) => (
              <Line key={c.key} type="monotone" dataKey={label(c)} connectNulls stroke={COHORT_COLORS[i % COHORT_COLORS.length]} strokeWidth={i === 0 ? 3 : 2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  );
}
