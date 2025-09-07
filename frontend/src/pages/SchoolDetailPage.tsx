import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import PerformanceChart from '../components/PerformanceChart';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  
  const { data: school, isLoading: schoolLoading, error: schoolError } = useQuery({
    queryKey: ['school', id],
    queryFn: () => schoolApi.getSchool(id!),
    enabled: !!id,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', id],
    queryFn: () => performanceApi.getTrends(id!),
    enabled: !!id,
  });

  if (schoolLoading || trendsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading school details...</p>
        </div>
      </div>
    );
  }

  if (schoolError || !school) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">School not found.</p>
          <Link to="/schools" className="mt-2 text-sm text-primary-600 hover:text-primary-800">
            ← Back to schools list
          </Link>
        </div>
      </div>
    );
  }

  // Extract PSSA and Keystone data if available
  const pssaResults = school.pssaResults || [];
  const keystoneResults = school.keystoneResults || [];

  // Get unique years from both PSSA and Keystone data
  const pssaYears = [...new Set(pssaResults.map((r: any) => r.year))].sort((a, b) => b - a);
  const keystoneYears = [...new Set(keystoneResults.map((r: any) => r.year))].sort((a, b) => b - a);
  const allYears = [...new Set([...pssaYears, ...keystoneYears])].sort((a, b) => b - a);

  // Filter data by selected year
  const selectedPssa = pssaResults.filter((r: any) => r.year === selectedYear);
  const selectedKeystone = keystoneResults.filter((r: any) => r.year === selectedYear);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Link to="/schools" className="text-gray-500 hover:text-gray-700">Schools</Link>
          </li>
          <li className="text-gray-500">/</li>
          <li>
            <span className="text-gray-500">{school.countyName}</span>
          </li>
          <li className="text-gray-500">/</li>
          <li>
            <span className="text-gray-500">{school.districtName}</span>
          </li>
          <li className="text-gray-500">/</li>
          <li className="text-gray-900 font-medium">{school.name}</li>
        </ol>
      </nav>

      {/* School Info Card */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">School #{school.schoolNumber}</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">County</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{school.countyName}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">District</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {school.districtName}
                <span className="ml-2 text-xs text-gray-500">(AUN: {school.districtAun})</span>
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">School Type</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{school.type || 'N/A'}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {school.address && (
                  <>
                    {school.address}<br />
                    {school.city}, PA {school.zipCode}
                  </>
                )}
                {!school.address && `${school.city || 'N/A'}, PA ${school.zipCode || ''}`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Year Selector */}
      {allYears.length > 0 && (
        <div className="mt-6 bg-white shadow sm:rounded-lg p-4">
          <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Year
          </label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            {allYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* PSSA Results */}
      {selectedPssa.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            PSSA Results ({selectedYear})
          </h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students Tested</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Advanced</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Proficient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Basic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Below Basic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Proficient+</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedPssa.map((result: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.grade}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.numberScored || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentAdvanced != null ? `${result.percentAdvanced.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentProficient != null ? `${result.percentProficient.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentBasic != null ? `${result.percentBasic.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentBelowBasic != null ? `${result.percentBelowBasic.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${result.percentProficientOrAbove >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.percentProficientOrAbove != null ? `${result.percentProficientOrAbove.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Keystone Results */}
      {selectedKeystone.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Keystone Exam Results ({selectedYear})
          </h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students Tested</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Advanced</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Proficient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Basic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Below Basic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Proficient+</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedKeystone.map((result: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.numberScored || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentAdvanced != null ? `${result.percentAdvanced.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentProficient != null ? `${result.percentProficient.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentBasic != null ? `${result.percentBasic.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.percentBelowBasic != null ? `${result.percentBelowBasic.toFixed(1)}%` : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${result.percentProficientOrAbove >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.percentProficientOrAbove != null ? `${result.percentProficientOrAbove.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Trends Chart (if available) */}
      {trends && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Historical Performance Trends</h2>
          <PerformanceChart data={trends} />
        </div>
      )}
    </div>
  );
}