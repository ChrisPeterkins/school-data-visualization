import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { districtApi, performanceApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function DistrictsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const { data: districtsData, isLoading } = useQuery({
    queryKey: ['districts', { search, page }],
    queryFn: () => districtApi.getDistricts({ search, page, limit: 20 }),
  });

  const { data: districtPerformance } = useQuery({
    queryKey: ['district-performance', selectedDistrict],
    queryFn: () => performanceApi.getPSSAResults({ 
      districtId: parseInt(selectedDistrict!), 
      year: 2024,
      level: 'district' 
    }),
    enabled: !!selectedDistrict,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDistrictClick = (districtId: string) => {
    setSelectedDistrict(districtId);
  };

  const calculateAveragePerformance = (data: any[]) => {
    if (!data || data.length === 0) return null;
    const validScores = data.filter(d => d.percentProficientOrAbove != null);
    if (validScores.length === 0) return null;
    const avg = validScores.reduce((sum, d) => sum + d.percentProficientOrAbove, 0) / validScores.length;
    return avg.toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pennsylvania School Districts</h1>
        <p className="mt-2 text-gray-600">
          Browse and analyze performance data for {districtsData?.meta?.total || 0} school districts
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search districts by name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {districtsData?.data.map((district: any) => (
                  <li key={district.id}>
                    <button
                      onClick={() => handleDistrictClick(district.id.toString())}
                      className={`w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left ${
                        selectedDistrict === district.id.toString() ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {district.name}
                          </h3>
                          <div className="mt-1 text-sm text-gray-500">
                            {district.countyName} County
                            {district.schoolCount > 0 && (
                              <span className="ml-4">Schools: {district.schoolCount}</span>
                            )}
                            {district.totalEnrollment && (
                              <span className="ml-4">Enrollment: {district.totalEnrollment.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {districtsData?.meta && districtsData.meta.totalPages > 1 && (
                <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {page} of {districtsData.meta.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(districtsData.meta.totalPages, page + 1))}
                    disabled={page === districtsData.meta.totalPages}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedDistrict && (
            <div className="bg-white shadow rounded-lg p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                District Performance (2024)
              </h2>
              {districtPerformance ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Proficiency</span>
                    <span className="text-lg font-medium text-primary-600">
                      {calculateAveragePerformance(districtPerformance)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Based on {districtPerformance.length} test results
                  </div>
                  <button
                    onClick={() => {
                      const district = districtsData?.data.find((d: any) => d.id.toString() === selectedDistrict);
                      if (district) {
                        navigate(`/districts/${district.id}`);
                      }
                    }}
                    className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    View District Details
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Loading performance data...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}