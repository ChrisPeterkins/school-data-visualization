import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { SchoolPerformanceTrends } from '@shared';

interface PerformanceChartProps {
  data: SchoolPerformanceTrends;
}

// Philly-themed chart colors
const chartColors = [
  '#2d4a6f', // navy-500
  '#27ab83', // civic-500
  '#d4aa3c', // gold-400
  '#c53030', // brick-500
  '#4a6d8c', // navy-400
  '#199473', // civic-600
];

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const pssaByYear = data.pssaTrends.reduce((acc: Record<string, { year: number; [key: string]: number }>, item) => {
    const key = `${item.year}`;
    if (!acc[key]) {
      acc[key] = { year: item.year };
    }
    if (item.proficientOrAbove != null) {
      acc[key][`${item.subject}_${item.grade}`] = item.proficientOrAbove;
    }
    return acc;
  }, {} as Record<string, any>);

  const pssaChartData = Object.values(pssaByYear).sort((a, b) => (a.year as number) - (b.year as number));

  const keystoneByYear = data.keystoneTrends.reduce((acc: Record<string, { year: number; [key: string]: number }>, item) => {
    const key = `${item.year}`;
    if (!acc[key]) {
      acc[key] = { year: item.year };
    }
    if (item.proficientOrAbove != null) {
      acc[key][item.subject] = item.proficientOrAbove;
    }
    return acc;
  }, {} as Record<string, any>);

  const keystoneChartData = Object.values(keystoneByYear).sort((a, b) => (a.year as number) - (b.year as number));

  const ChartCard = ({ title, chartData }: { title: string; chartData: any[] }) => (
    <div className="card-surface p-6">
      <h3 className="text-base font-semibold text-stone-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#78716c' }} />
          <YAxis
            label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }}
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: '#78716c' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e7e5e4',
              borderRadius: '0.5rem',
              fontSize: '13px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          {Object.keys(chartData[0] || {})
            .filter(key => key !== 'year')
            .map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                name={key.replace(/_/g, ' - Grade ')}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-6">
      {pssaChartData.length > 0 && <ChartCard title="PSSA Performance Trends" chartData={pssaChartData} />}
      {keystoneChartData.length > 0 && <ChartCard title="Keystone Exam Performance Trends" chartData={keystoneChartData} />}
      {pssaChartData.length === 0 && keystoneChartData.length === 0 && (
        <div className="card-surface p-8 text-center">
          <p className="text-stone-400">No performance data available for this school.</p>
        </div>
      )}
    </div>
  );
}
