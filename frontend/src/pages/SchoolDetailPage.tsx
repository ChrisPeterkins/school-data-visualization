import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import PerformanceChart from '../components/PerformanceChart';
import {
  ChevronRightIcon,
  MapPinIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  // null = "latest year this school has data for"; set once the user picks a year.
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm text-stone-500">Loading school details...</p>
      </div>
    );
  }

  if (schoolError || !school) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-surface border-brick-200 bg-brick-50 p-6">
          <p className="text-brick-700 font-medium">School not found.</p>
          <Link to="/schools" className="mt-2 inline-block text-sm text-navy-600 hover:text-navy-800">
            &larr; Back to schools list
          </Link>
        </div>
      </div>
    );
  }

  const pssaResults = school.pssaResults || [];
  const keystoneResults = school.keystoneResults || [];
  const pssaYears = [...new Set(pssaResults.map((r: any) => r.year as number))].sort((a, b) => b - a);
  const keystoneYears = [...new Set(keystoneResults.map((r: any) => r.year as number))].sort((a, b) => b - a);
  const allYears: number[] = [...new Set([...pssaYears, ...keystoneYears])].sort((a, b) => b - a);
  const activeYear = selectedYear != null && allYears.includes(selectedYear) ? selectedYear : allYears[0];
  const selectedPssa = pssaResults.filter((r: any) => r.year === activeYear);
  const selectedKeystone = keystoneResults.filter((r: any) => r.year === activeYear);

  const getProficiencyColor = (value: number | null) => {
    if (value == null) return 'text-stone-400';
    if (value >= 70) return 'text-civic-700 font-semibold';
    if (value >= 50) return 'text-gold-700 font-semibold';
    return 'text-brick-600 font-semibold';
  };

  const ResultsTable = ({ results, showGrade }: { results: any[]; showGrade: boolean }) => (
    <div className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            {/* The four level breakdowns only show from md; phones get Grade / Subject / Tested / Prof+ */}
            <tr className="bg-stone-50/80 border-b border-stone-200">
              {showGrade && <th className="px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Grade</th>}
              <th className="px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Subject</th>
              <th className="px-3 sm:px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider">Tested</th>
              <th className="hidden md:table-cell px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">% Advanced</th>
              <th className="hidden md:table-cell px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">% Proficient</th>
              <th className="hidden md:table-cell px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">% Basic</th>
              <th className="hidden md:table-cell px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">% Below Basic</th>
              <th className="px-3 sm:px-5 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">% Prof.+</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {results.map((result: any, idx: number) => (
              <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                {showGrade && <td className="px-3 sm:px-5 py-3 text-sm text-stone-700">{result.grade}</td>}
                <td className="px-3 sm:px-5 py-3 text-sm font-medium text-stone-900">{result.subject}</td>
                <td className="px-3 sm:px-5 py-3 text-sm text-stone-600 text-right">{result.numberScored || 'N/A'}</td>
                <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{result.percentAdvanced != null ? `${result.percentAdvanced.toFixed(1)}%` : 'N/A'}</td>
                <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{result.percentProficient != null ? `${result.percentProficient.toFixed(1)}%` : 'N/A'}</td>
                <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{result.percentBasic != null ? `${result.percentBasic.toFixed(1)}%` : 'N/A'}</td>
                <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{result.percentBelowBasic != null ? `${result.percentBelowBasic.toFixed(1)}%` : 'N/A'}</td>
                <td className={`px-3 sm:px-5 py-3 text-sm text-right ${getProficiencyColor(result.percentProficientOrAbove)}`}>
                  {result.percentProficientOrAbove != null ? `${result.percentProficientOrAbove.toFixed(1)}%` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-400 mb-6 min-w-0" aria-label="Breadcrumb">
          <Link to="/schools" className="hover:text-navy-600 transition-colors">Schools</Link>
          <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{school.countyName}</span>
          <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{school.districtName}</span>
          <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-stone-700 font-medium break-words">{school.name}</span>
        </nav>

        {/* School Header Card */}
        <div className="card-surface p-4 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 break-words">{school.name}</h1>
              <p className="text-sm text-stone-400 mt-0.5">School #{school.schoolNumber}</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <BuildingOffice2Icon className="w-4 h-4 text-stone-400" />
                  <span className="text-stone-600">
                    {school.districtName}
                    <span className="text-stone-400 ml-1 text-xs">(AUN: {school.districtAun})</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPinIcon className="w-4 h-4 text-stone-400" />
                  <span className="text-stone-600">
                    {school.address ? `${school.address}, ${school.city}, PA ${school.zipCode}` : `${school.city || 'N/A'}, PA ${school.zipCode || ''}`}
                  </span>
                </div>
                {school.type && (
                  <div>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-navy-100 text-navy-700">
                      {school.type}
                    </span>
                    <span className="text-sm text-stone-500 ml-2">{school.countyName} County</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Year Selector */}
        {allYears.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-stone-600">Assessment Year</span>
              <div className="flex flex-wrap gap-1.5">
                {allYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    aria-pressed={activeYear === year}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeYear === year
                        ? 'bg-navy-700 text-white'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PSSA Results */}
        {selectedPssa.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
              PSSA Results
              <span className="text-sm font-normal text-stone-400">({activeYear})</span>
            </h2>
            <ResultsTable results={selectedPssa} showGrade={true} />
          </div>
        )}

        {/* Keystone Results */}
        {selectedKeystone.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
              Keystone Exam Results
              <span className="text-sm font-normal text-stone-400">({activeYear})</span>
            </h2>
            <ResultsTable results={selectedKeystone} showGrade={false} />
          </div>
        )}

        {/* Trends */}
        {trends && (
          <div>
            <h2 className="text-lg font-bold text-stone-900 mb-3">Historical Performance Trends</h2>
            <PerformanceChart data={trends} />
          </div>
        )}
      </div>
    </div>
  );
}
