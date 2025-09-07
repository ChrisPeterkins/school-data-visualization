import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function ComparePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [year, setYear] = useState(2024);

  const { data: searchResults } = useQuery({
    queryKey: ['school-search', searchTerm],
    queryFn: () => schoolApi.getSchools({ search: searchTerm, limit: 50 }),
    enabled: searchTerm.length >= 2,
  });

  const { data: performanceData } = useQuery({
    queryKey: ['compare-performance', selectedSchools.map(s => s.schoolId), year],
    queryFn: async () => {
      const results = await Promise.all(
        selectedSchools.map(school =>
          performanceApi.getPSSAResults({
            schoolId: school.schoolId,
            year,
            level: 'school'
          }).then(data => ({ school, data }))
        )
      );
      return results;
    },
    enabled: selectedSchools.length > 0,
  });

  const addSchool = (school: any) => {
    if (selectedSchools.length < 5 && !selectedSchools.find(s => s.schoolId === school.schoolId)) {
      setSelectedSchools([...selectedSchools, school]);
      setSearchTerm('');
      setShowSearch(false);
    }
  };

  const removeSchool = (schoolId: string) => {
    setSelectedSchools(selectedSchools.filter(s => s.schoolId !== schoolId));
  };

  const processComparisonData = () => {
    if (!performanceData) return { barData: [], radarData: [] };

    const subjects = ['Mathematics', 'English Language Arts', 'Science'];
    
    const barData = subjects.map(subject => {
      const subjectData: any = { subject };
      
      performanceData.forEach(({ school, data }) => {
        const subjectResults = data.filter((d: any) => d.subject === subject);
        if (subjectResults.length > 0) {
          const avg = subjectResults.reduce((sum: number, d: any) => 
            sum + (d.proficientOrAbovePercent || 0), 0) / subjectResults.length;
          subjectData[school.name] = parseFloat(avg.toFixed(1));
        }
      });
      
      return subjectData;
    });

    const radarData = selectedSchools.map(school => {
      const schoolPerf = performanceData.find(p => p.school.schoolId === school.schoolId);
      if (!schoolPerf) return null;

      const metrics: any = { school: school.name };
      subjects.forEach(subject => {
        const subjectResults = schoolPerf.data.filter((d: any) => d.subject === subject);
        if (subjectResults.length > 0) {
          const avg = subjectResults.reduce((sum: number, d: any) => 
            sum + (d.proficientOrAbovePercent || 0), 0) / subjectResults.length;
          metrics[subject] = parseFloat(avg.toFixed(1));
        }
      });
      return metrics;
    }).filter(Boolean);

    return { barData, radarData };
  };

  const { barData, radarData } = processComparisonData();
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compare Schools</h1>
        <p className="mt-2 text-gray-600">
          Compare academic performance across multiple schools (up to 5)
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            >
              {[2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016, 2015].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowSearch(true)}
            disabled={selectedSchools.length >= 5}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add School ({selectedSchools.length}/5)
          </button>
        </div>

        {showSearch && (
          <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for a school..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {searchResults && searchResults.data.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-md divide-y">
                {searchResults.data.map((school: any) => (
                  <li key={school.schoolId}>
                    <button
                      onClick={() => addSchool(school)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
                      disabled={selectedSchools.find(s => s.schoolId === school.schoolId)}
                    >
                      <div className="font-medium">{school.name}</div>
                      <div className="text-sm text-gray-500">{school.districtId}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {selectedSchools.map((school, index) => (
            <div
              key={school.schoolId}
              className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-300 rounded-full"
              style={{ borderColor: colors[index] }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-sm font-medium">{school.name}</span>
              <button
                onClick={() => removeSchool(school.schoolId)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedSchools.length > 0 && performanceData && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Subject Performance Comparison ({year})
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis 
                  domain={[0, 100]}
                  label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                {selectedSchools.map((school, index) => (
                  <Bar
                    key={school.schoolId}
                    dataKey={school.name}
                    fill={colors[index]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {radarData.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Performance Profile ({year})
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData[0] ? Object.keys(radarData[0])
                  .filter(k => k !== 'school')
                  .map(subject => {
                    const point: any = { subject };
                    radarData.forEach((d: any) => {
                      point[d.school] = d[subject] || 0;
                    });
                    return point;
                  }) : []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  {selectedSchools.map((school, index) => (
                    <Radar
                      key={school.schoolId}
                      name={school.name}
                      dataKey={school.name}
                      stroke={colors[index]}
                      fill={colors[index]}
                      fillOpacity={0.3}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Summary Statistics ({year})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900">School</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-900">Math</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-900">ELA</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-900">Science</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-900">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedSchools.map((school, index) => {
                    const schoolData = barData.reduce((acc: any, subject: any) => {
                      acc[subject.subject] = subject[school.name] || 0;
                      return acc;
                    }, {});
                    const avg = Object.values(schoolData).reduce((sum: number, val: any) => sum + val, 0) / 
                               Object.values(schoolData).filter((v: any) => v > 0).length;
                    
                    return (
                      <tr key={school.schoolId}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: colors[index] }}
                            />
                            {school.name}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-gray-600">
                          {schoolData['Mathematics']?.toFixed(1) || 'N/A'}%
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-gray-600">
                          {schoolData['English Language Arts']?.toFixed(1) || 'N/A'}%
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-gray-600">
                          {schoolData['Science']?.toFixed(1) || 'N/A'}%
                        </td>
                        <td className="px-4 py-2 text-center text-sm font-medium text-primary-600">
                          {isNaN(avg) ? 'N/A' : `${avg.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedSchools.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            Select up to 5 schools to compare their academic performance
          </p>
        </div>
      )}
    </div>
  );
}