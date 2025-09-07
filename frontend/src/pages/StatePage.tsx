import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { PSSAResult, KeystoneResult } from '@shared/types';

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
        return performanceApi.getPSSAResults({
          subject: selectedSubject,
          level: 'state',
          yearFrom: 2015,
          yearTo: 2024
        });
      } else {
        return performanceApi.getKeystoneResults({
          subject: selectedSubject,
          level: 'state',
          yearFrom: 2015,
          yearTo: 2024
        });
      }
    },
  });

  const processDataForChart = () => {
    if (!trendData) return [];
    
    const dataByYear = trendData.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) {
        acc[year] = { year, proficiency: 0, count: 0 };
      }
      if (item.avgProficientOrAbove != null) {
        acc[year].proficiency += item.avgProficientOrAbove;
        acc[year].count += 1;
      }
      return acc;
    }, {});

    return Object.values(dataByYear)
      .map((d: any) => ({
        year: d.year,
        proficiency: d.count > 0 ? (d.proficiency / d.count).toFixed(1) : 0
      }))
      .sort((a: any, b: any) => a.year - b.year);
  };

  const processSubjectData = () => {
    if (!stateData) return [];
    
    const subjectData = stateData.reduce((acc: any, item: any) => {
      const subject = item.subject;
      if (!acc[subject]) {
        acc[subject] = { subject, totalProficiency: 0, count: 0 };
      }
      if (item.avgProficientOrAbove != null) {
        acc[subject].totalProficiency += item.avgProficientOrAbove;
        acc[subject].count += 1;
      }
      return acc;
    }, {});

    return Object.values(subjectData)
      .map((d: any) => ({
        subject: d.subject,
        proficiency: d.count > 0 ? parseFloat((d.totalProficiency / d.count).toFixed(1)) : 0
      }))
      .sort((a: any, b: any) => b.proficiency - a.proficiency);
  };

  const processProficiencyDistribution = () => {
    if (!stateData) return [];
    
    const ranges = [
      { name: 'Advanced (80-100%)', min: 80, max: 100, count: 0, color: '#10b981' },
      { name: 'Proficient (60-79%)', min: 60, max: 79, count: 0, color: '#3b82f6' },
      { name: 'Basic (40-59%)', min: 40, max: 59, count: 0, color: '#f59e0b' },
      { name: 'Below Basic (<40%)', min: 0, max: 39, count: 0, color: '#ef4444' }
    ];

    stateData.forEach((item: any) => {
      if (item.avgProficientOrAbove != null) {
        const prof = item.avgProficientOrAbove;
        ranges.forEach(range => {
          if (prof >= range.min && prof <= range.max) {
            range.count++;
          }
        });
      }
    });

    return ranges.filter(r => r.count > 0);
  };

  const chartData = processDataForChart();
  const subjectData = processSubjectData();
  const distributionData = processProficiencyDistribution();

  const years = Array.from({ length: 10 }, (_, i) => 2023 - i);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pennsylvania State Performance</h1>
        <p className="mt-2 text-gray-600">
          Statewide academic performance trends and analysis
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Exam Type:</label>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value as 'pssa' | 'keystone')}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Subject:</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {examType === 'pssa' ? (
              <>
                <option value="Mathematics">Mathematics</option>
                <option value="English Language Arts">English Language Arts</option>
                <option value="Science">Science</option>
              </>
            ) : (
              <>
                <option value="Algebra I">Algebra I</option>
                <option value="Biology">Biology</option>
                <option value="Literature">Literature</option>
              </>
            )}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-48 bg-gray-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedSubject} Proficiency Trends (2015-2024)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis 
                    domain={[0, 100]}
                    label={{ value: '% Proficient', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="proficiency" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Subject Performance Comparison ({selectedYear})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" angle={-45} textAnchor="end" height={80} />
                  <YAxis 
                    domain={[0, 100]}
                    label={{ value: '% Proficient', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Bar dataKey="proficiency" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Proficiency Distribution ({selectedYear})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Key Statistics ({selectedYear})
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Total Assessments</span>
                  <span className="text-lg font-semibold">{stateData?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Average Proficiency</span>
                  <span className="text-lg font-semibold text-primary-600">
                    {stateData && stateData.length > 0 ? 
                      (stateData.reduce((sum: number, d: any) => 
                        sum + (d.avgProficientOrAbove || 0), 0) / 
                        stateData.filter((d: any) => d.avgProficientOrAbove != null).length
                      ).toFixed(1) : '0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Highest Subject</span>
                  <span className="text-lg font-semibold">
                    {subjectData[0]?.subject || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Lowest Subject</span>
                  <span className="text-lg font-semibold">
                    {subjectData[subjectData.length - 1]?.subject || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}