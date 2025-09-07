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
import type { SchoolPerformanceTrends } from '@shared/types';

interface PerformanceChartProps {
  data: SchoolPerformanceTrends;
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  // Transform PSSA data for chart
  const pssaByYear = data.pssaTrends.reduce((acc, item) => {
    const key = `${item.year}`;
    if (!acc[key]) {
      acc[key] = { year: item.year };
    }
    acc[key][`${item.subject}_${item.grade}`] = item.proficientOrAbove;
    return acc;
  }, {} as Record<string, any>);

  const pssaChartData = Object.values(pssaByYear).sort((a, b) => a.year - b.year);

  // Transform Keystone data for chart
  const keystoneByYear = data.keystoneTrends.reduce((acc, item) => {
    const key = `${item.year}`;
    if (!acc[key]) {
      acc[key] = { year: item.year };
    }
    acc[key][item.subject] = item.proficientOrAbove;
    return acc;
  }, {} as Record<string, any>);

  const keystoneChartData = Object.values(keystoneByYear).sort((a, b) => a.year - b.year);

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];

  return (
    <div className="space-y-8">
      {pssaChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">PSSA Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pssaChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis 
                label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
              />
              <Tooltip />
              <Legend />
              {Object.keys(pssaChartData[0] || {})
                .filter(key => key !== 'year')
                .map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={key.replace(/_/g, ' - Grade ')}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {keystoneChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Keystone Exam Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={keystoneChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis 
                label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
              />
              <Tooltip />
              <Legend />
              {Object.keys(keystoneChartData[0] || {})
                .filter(key => key !== 'year')
                .map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={key}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {pssaChartData.length === 0 && keystoneChartData.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No performance data available for this school.</p>
        </div>
      )}
    </div>
  );
}