import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AccessibleChart from './AccessibleChart';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { SUBJECT_COLORS } from '../lib/constants';
import { standardsChangeLine, covidGapArea, tooltipStyle } from '../lib/chartUtils';

interface TrendCardProps {
  title: string;
  subtitle?: string;
  /** Gap-filled rows: { year, [seriesName]: value } */
  data: any[];
  series: string[];
  /** Years that actually have data (no placeholders). */
  years: number[];
  exam: 'pssa' | 'keystone';
  colors?: Record<string, string>;
  height?: number;
}

/** One "proficient or above over time" line chart, shared by the entity pages. */
export default function TrendCard({ title, subtitle = 'All grades, weighted by students tested', data, series, years, exam, colors = SUBJECT_COLORS, height }: TrendCardProps) {
  const smUp = useIsSmUp();
  if (data.length < 2) return null;
  const rows = data.filter((r) => Object.keys(r).length > 1);
  return (
    <div className="card-surface p-4 sm:p-6">
      <h3 className="text-base font-semibold text-stone-900 mb-1">{title}</h3>
      <p className="text-xs text-stone-400 mb-4">{subtitle}</p>
      <AccessibleChart label={`${title}, ${years[0]} to ${years[years.length - 1]}`} rows={rows} columns={[{ key: 'year', label: 'Year' }, ...series.map((s) => ({ key: s, label: `${s} % proficient or above` }))]}>
        <ResponsiveContainer width="100%" height={height ?? (smUp ? 300 : 240)}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {covidGapArea(years)}
            {exam === 'pssa' ? standardsChangeLine(years) : null}
            {series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} connectNulls={false} stroke={colors[s] ?? ['#2d4a6f', '#27ab83', '#c53030', '#d4aa3c', '#4a6d8c'][i % 5]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </div>
  );
}
