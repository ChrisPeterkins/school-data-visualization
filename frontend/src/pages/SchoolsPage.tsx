import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { schoolApi } from '../services/api';
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

  // Fetch filter options
  useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => {
      const response = await fetch('/api/schools/filters');
      const data = await response.json();
      setFilters(data);
      return data;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['schools', { page, search, sortBy, sortOrder, countyName, districtName, schoolType }],
    queryFn: () => schoolApi.getSchools({ 
      page, 
      search, 
      limit: 20,
      sortBy,
      sortOrder,
      countyName,
      districtName,
      schoolType
    }),
  });

  const handleSearch = (query: string) => {
    setSearchParams({ 
      search: query, 
      page: '1',
      sortBy,
      sortOrder
    });
  };

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSearchParams({ 
      ...Object.fromEntries(searchParams),
      sortBy: field,
      sortOrder: order,
      page: '1'
    });
  };

  const handleFilterChange = (filterType: string, value: string) => {
    const newParams: any = {
      ...Object.fromEntries(searchParams),
      page: '1'
    };
    
    if (value) {
      newParams[filterType] = value;
    } else {
      delete newParams[filterType];
    }
    
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ 
      ...Object.fromEntries(searchParams), 
      page: newPage.toString() 
    });
  };

  const clearAllFilters = () => {
    setSearchParams({
      page: '1',
      sortBy: 'name',
      sortOrder: 'asc'
    });
    setSearchQuery('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Pennsylvania Schools</h1>
          <p className="mt-2 text-sm text-gray-700">
            Browse and search {data?.meta?.total || 0} Pennsylvania public schools across 67 counties
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mt-6 space-y-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Search schools, districts, or counties..."
        />
        
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">County</label>
            <select
              value={countyName}
              onChange={(e) => handleFilterChange('county', e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">All Counties</option>
              {filters.counties.map(county => (
                <option key={county.id} value={county.name}>
                  {county.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">School Type</label>
            <select
              value={schoolType}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">All Types</option>
              {filters.schoolTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {(countyName || districtName || schoolType || search) && (
            <div className="flex items-end">
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading schools...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error loading schools. Please try again later.</p>
        </div>
      )}

      {data && (
        <>
          <div className="mt-8">
            <EnhancedSchoolTable 
              schools={data.data} 
              onSort={handleSort}
              currentSort={{ field: sortBy, order: sortOrder }}
            />
          </div>
          
          {data.meta && (
            <div className="mt-6">
              <Pagination
                currentPage={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}