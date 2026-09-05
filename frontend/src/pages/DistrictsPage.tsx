import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { districtApi } from '../services/api';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import Pagination from '../components/Pagination';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function DistrictsPage() {
  const [search, setSearch] = useUrlState<string>('q', '', parseString);
  const [page, setPage] = useUrlState<number>('page', 1, parseNumber);
  const [draft, setDraft] = useState(search);
  useDocumentTitle(search ? `Districts matching "${search}"` : 'Districts', 'Browse Pennsylvania school districts, charters, and career and technical centers.');

  const { data: districtsData, isLoading } = useQuery({
    queryKey: ['districts', { search, page }],
    queryFn: () => districtApi.getDistricts({ search, page, limit: 25 }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Pennsylvania School Districts</h1>
        <p className="mt-1 text-sm text-stone-500">
          Browse {districtsData?.meta?.total?.toLocaleString() || '...'} districts, charters, and career and technical centers
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by district or county"
            aria-label="Search districts"
            className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
          />
        </div>
        <button type="submit" className="px-5 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors">
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="card-surface p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="card-surface overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {districtsData?.data.map((district: any) => (
                <li key={district.id}>
                  <Link
                    to={`/districts/${district.id}`}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-stone-900">{district.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-stone-500">
                        <span>{district.countyName} County</span>
                        {district.schoolCount > 0 && <span>{district.schoolCount} {district.schoolCount === 1 ? 'school' : 'schools'}</span>}
                        {district.totalEnrollment ? <span>{district.totalEnrollment.toLocaleString()} enrolled</span> : null}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
              {districtsData?.data.length === 0 && (
                <li className="px-5 py-12 text-center text-sm text-stone-400">No districts match that search</li>
              )}
            </ul>
          </div>
          {districtsData?.meta && districtsData.meta.totalPages > 1 && (
            <Pagination currentPage={districtsData.meta.page} totalPages={districtsData.meta.totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
