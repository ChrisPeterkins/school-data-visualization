import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { districtApi, performanceApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRightIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

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

  const calculateAveragePerformance = (data: any[]) => {
    if (!data || data.length === 0) return null;
    const validScores = data.filter(d => d.proficientOrAbovePercent != null);
    if (validScores.length === 0) return null;
    return (validScores.reduce((sum, d) => sum + d.proficientOrAbovePercent, 0) / validScores.length).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-2.5 rounded-xl bg-civic-100">
            <BuildingOffice2Icon className="w-6 h-6 text-civic-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Pennsylvania School Districts</h1>
            <p className="mt-1 text-sm text-stone-500">
              Browse and analyze performance data for {districtsData?.meta?.total || '...'} school districts
            </p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search districts by name..."
              className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
            />
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* District List */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="card-philly p-8 text-center">
                <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="card-philly overflow-hidden">
                <ul className="divide-y divide-stone-100">
                  {districtsData?.data.map((district: any) => (
                    <li key={district.id}>
                      <button
                        onClick={() => setSelectedDistrict(district.id.toString())}
                        className={`w-full px-5 py-4 text-left transition-colors ${
                          selectedDistrict === district.id.toString()
                            ? 'bg-navy-50 border-l-2 border-l-navy-500'
                            : 'hover:bg-stone-50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-stone-900">{district.name}</h3>
                            <div className="mt-1 flex items-center gap-4 text-xs text-stone-500">
                              <span>{district.countyName} County</span>
                              {district.schoolCount > 0 && <span>{district.schoolCount} schools</span>}
                              {district.totalEnrollment && <span>{district.totalEnrollment.toLocaleString()} enrolled</span>}
                            </div>
                          </div>
                          <ChevronRightIcon className="w-4 h-4 text-stone-300" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                {districtsData?.meta && districtsData.meta.totalPages > 1 && (
                  <div className="border-t border-stone-100 px-5 py-3 flex items-center justify-between">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-sm text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-stone-500">Page {page} of {districtsData.meta.totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(districtsData.meta!.totalPages, page + 1))}
                      disabled={page === districtsData.meta.totalPages}
                      className="px-3 py-1.5 text-sm text-stone-600 rounded-lg hover:bg-stone-100 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedDistrict ? (
              <motion.div
                key={selectedDistrict}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="card-philly p-6 sticky top-4"
              >
                <h2 className="text-base font-semibold text-stone-900 mb-4">District Performance (2024)</h2>
                {districtPerformance ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-stone-500">Average Proficiency</span>
                      <span className="text-xl font-bold text-navy-600">
                        {calculateAveragePerformance(districtPerformance)}%
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">Based on {districtPerformance.length} test results</p>
                    <button
                      onClick={() => {
                        const district = districtsData?.data.find((d: any) => d.id.toString() === selectedDistrict);
                        if (district) navigate(`/districts/${district.id}`);
                      }}
                      className="w-full mt-2 px-4 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors"
                    >
                      View District Details
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-stone-400">Loading...</div>
                )}
              </motion.div>
            ) : (
              <div className="card-philly p-6 text-center">
                <BuildingOffice2Icon className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-400">Select a district to view performance data</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
