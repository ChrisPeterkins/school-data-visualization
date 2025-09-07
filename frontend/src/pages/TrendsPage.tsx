import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid';

export default function TrendsPage() {
  const [level, setLevel] = useState<'state' | 'district' | 'school'>('state');
  const [examType, setExamType] = useState<'pssa' | 'keystone'>('pssa');
  const [subject, setSubject] = useState('Mathematics');
  const [grade, setGrade] = useState<number | null>(null);

  const { data: trendsData, isLoading } = useQuery({
    queryKey: ['trends-analysis', level, examType, subject, grade],
    queryFn: async () => {
      const params: any = {
        level,
        subject,
        yearFrom: 2015,
        yearTo: 2024
      };
      
      if (examType === 'pssa' && grade) {
        params.grade = grade;
      }

      if (examType === 'pssa') {
        return performanceApi.getPSSAResults(params);
      } else {
        return performanceApi.getKeystoneResults(params);
      }
    },
  });

  const processYearlyTrends = () => {
    if (!trendsData) return [];

    const yearlyData = trendsData.reduce((acc: any, item: any) => {
      const year = item.year;
      if (!acc[year]) {
        acc[year] = {
          year,
          totalProficiency: 0,
          count: 0,
          advanced: 0,
          proficient: 0,
          basic: 0,
          belowBasic: 0
        };
      }
      
      if (item.proficientOrAbovePercent != null) {
        acc[year].totalProficiency += item.proficientOrAbovePercent;
        acc[year].count += 1;
        
        const prof = item.proficientOrAbovePercent;
        if (prof >= 80) acc[year].advanced++;
        else if (prof >= 60) acc[year].proficient++;
        else if (prof >= 40) acc[year].basic++;
        else acc[year].belowBasic++;
      }

      if (item.advancedPercent != null) {
        acc[year].advancedAvg = (acc[year].advancedAvg || 0) + item.advancedPercent;
      }
      if (item.proficientPercent != null) {
        acc[year].proficientAvg = (acc[year].proficientAvg || 0) + item.proficientPercent;
      }
      if (item.basicPercent != null) {
        acc[year].basicAvg = (acc[year].basicAvg || 0) + item.basicPercent;
      }
      if (item.belowBasicPercent != null) {
        acc[year].belowBasicAvg = (acc[year].belowBasicAvg || 0) + item.belowBasicPercent;
      }
      
      return acc;
    }, {});

    return Object.values(yearlyData)
      .map((d: any) => ({
        year: d.year,
        proficiency: d.count > 0 ? parseFloat((d.totalProficiency / d.count).toFixed(1)) : 0,
        advanced: d.advancedAvg ? parseFloat((d.advancedAvg / d.count).toFixed(1)) : 0,
        proficient: d.proficientAvg ? parseFloat((d.proficientAvg / d.count).toFixed(1)) : 0,
        basic: d.basicAvg ? parseFloat((d.basicAvg / d.count).toFixed(1)) : 0,
        belowBasic: d.belowBasicAvg ? parseFloat((d.belowBasicAvg / d.count).toFixed(1)) : 0,
        count: d.count
      }))
      .sort((a: any, b: any) => a.year - b.year);
  };

  const calculateGrowth = (data: any[]) => {
    if (data.length < 2) return { value: 0, trend: 'neutral' };
    
    const recent = data[data.length - 1].proficiency;
    const previous = data[data.length - 2].proficiency;
    const change = recent - previous;
    
    return {
      value: Math.abs(change).toFixed(1),
      trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral'
    };
  };

  const yearlyTrends = processYearlyTrends();
  const growth = calculateGrowth(yearlyTrends);

  const getGradeOptions = () => {
    if (examType === 'keystone') return [];
    return [3, 4, 5, 6, 7, 8];
  };

  const getSubjectOptions = () => {
    if (examType === 'pssa') {
      return ['Mathematics', 'English Language Arts', 'Science'];
    } else {
      return ['Algebra I', 'Biology', 'Literature'];
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Performance Trends Analysis</h1>
        <p className="mt-2 text-gray-600">
          Analyze academic performance trends from 2015 to 2024
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Level:</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          >
            <option value="state">State</option>
            <option value="district">District</option>
            <option value="school">School</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Exam:</label>
          <select
            value={examType}
            onChange={(e) => {
              setExamType(e.target.value as any);
              setGrade(null);
              setSubject(e.target.value === 'pssa' ? 'Mathematics' : 'Algebra I');
            }}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          >
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Subject:</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          >
            {getSubjectOptions().map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {examType === 'pssa' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Grade:</label>
            <select
              value={grade || ''}
              onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Grades</option>
              {getGradeOptions().map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Proficiency</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {yearlyTrends[yearlyTrends.length - 1]?.proficiency || 0}%
                  </p>
                </div>
                <div className={`p-2 rounded-full ${
                  growth.trend === 'up' ? 'bg-green-100' :
                  growth.trend === 'down' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {growth.trend === 'up' ? <ArrowUpIcon className="h-6 w-6 text-green-600" /> :
                   growth.trend === 'down' ? <ArrowDownIcon className="h-6 w-6 text-red-600" /> :
                   <MinusIcon className="h-6 w-6 text-gray-600" />}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {growth.trend === 'up' ? '+' : growth.trend === 'down' ? '-' : ''}{growth.value}% from last year
              </p>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-600">10-Year Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {yearlyTrends.length > 0 ? 
                    (yearlyTrends.reduce((sum: number, d: any) => sum + d.proficiency, 0) / yearlyTrends.length).toFixed(1) : 0}%
                </p>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Average proficiency rate
              </p>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Points</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trendsData?.length || 0}
                </p>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Total assessments analyzed
              </p>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Proficiency Rate Trends (2015-2024)
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={yearlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis 
                  domain={[0, 100]}
                  label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="proficiency" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Overall Proficiency"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {yearlyTrends.some((d: any) => d.advanced > 0) && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Performance Level Distribution
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={yearlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis 
                    domain={[0, 100]}
                    label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="advanced" stackId="1" stroke="#10b981" fill="#10b981" name="Advanced" />
                  <Area type="monotone" dataKey="proficient" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Proficient" />
                  <Area type="monotone" dataKey="basic" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Basic" />
                  <Area type="monotone" dataKey="belowBasic" stackId="1" stroke="#ef4444" fill="#ef4444" name="Below Basic" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Year-over-Year Change
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearlyTrends.slice(1).map((d: any, i: number) => ({
                year: d.year,
                change: d.proficiency - yearlyTrends[i].proficiency,
                fill: d.proficiency - yearlyTrends[i].proficiency >= 0 ? '#10b981' : '#ef4444'
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis 
                  domain={[-20, 20]}
                  label={{ value: 'Change (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Bar 
                  dataKey="change" 
                  fill="#3b82f6"
                  name="YoY Change"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}