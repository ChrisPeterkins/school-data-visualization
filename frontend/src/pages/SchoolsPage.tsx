import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import api, { schoolApi } from '../services/api';
import SearchBar from '../components/SearchBar';
import EnhancedSchoolTable from '../components/EnhancedSchoolTable';
import Pagination from '../components/Pagination';

export default function SchoolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
  const countyName = searchParams.get('county') || '';
  const districtName = searchParams.get('district') || '';
  const schoolType = searchParams.get('type') || '';

  const [searchQuery, setSearchQuery] = useState(search);
  const [filters, setFilters] = useState({
    counties: [] as Array<{ id: number; name: string; code: string }>,
    schoolTypes: [] as string[]
  });

  useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => {
      const { data } = await api.get('/api/schools/filters');
      setFilters(data);
      return data;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['schools', { page, search, sortBy, sortOrder, countyName, districtName, schoolType }],
    queryFn: () => schoolApi.getSchools({
      page, search, limit: 20, sortBy, sortOrder, countyName, districtName, schoolType
    }),
  });

  const handleSearch = (query: string) => {
    setSearchParams({ search: query, page: '1', sortBy, sortOrder });
  };

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSearchParams({ ...Object.fromEntries(searchParams), sortBy: field, sortOrder: order, page: '1' });
  };

  const handleFilterChange = (filterType: string, value: string) => {
    const newParams: any = { ...Object.fromEntries(searchParams), page: '1' };
    if (value) { newParams[filterType] = value; } else { delete newParams[filterType]; }
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ ...Object.fromEntries(searchParams), page: newPage.toString() });
  };

  const clearAllFilters = () => {
    setSearchParams({ page: '1', sortBy: 'name', sortOrder: 'asc' });
    setSearchQuery('');
  };

  const hasActiveFilters = countyName || districtName || schoolType || search;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Pennsylvania Schools</h1>
            <p className="mt-1 text-sm text-stone-500">
              Browse and search {data?.meta?.total?.toLocaleString() || '...'} public schools across 67 counties
            </p>
          </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="Search schools, districts, or counties..."
          />

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[10rem] sm:flex-none">
              <label className="block text-xs font-medium text-stone-500 mb-1">County</label>
              <select
                value={countyName}
                onChange={(e) => handleFilterChange('county', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
              >
                <option value="">All Counties</option>
                {filters.counties.map(county => (
                  <option key={county.id} value={county.name}>{county.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[10rem] sm:flex-none">
              <label className="block text-xs font-medium text-stone-500 mb-1">School Type</label>
              <select
                value={schoolType}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
              >
                <option value="">All Types</option>
                {filters.schoolTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-brick-600 hover:text-brick-700 rounded-lg hover:bg-brick-50 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="card-surface p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-stone-500">Loading schools...</p>
          </div>
        )}

        {error && (
          <div className="card-surface border-brick-200 bg-brick-50 p-4">
            <p className="text-sm text-brick-700">Error loading schools. Please try again later.</p>
          </div>
        )}

        {data && (
          <>
            <EnhancedSchoolTable
              schools={data.data}
              onSort={handleSort}
              currentSort={{ field: sortBy, order: sortOrder }}
            />
            {data.meta && (
              <Pagination
                currentPage={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
