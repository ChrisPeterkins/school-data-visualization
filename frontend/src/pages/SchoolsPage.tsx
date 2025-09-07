import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { schoolApi } from '../services/api';
import SearchBar from '../components/SearchBar';
import SchoolTable from '../components/SchoolTable';
import Pagination from '../components/Pagination';

export default function SchoolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(search);

  const { data, isLoading, error } = useQuery({
    queryKey: ['schools', { page, search }],
    queryFn: () => schoolApi.getSchools({ page, search, limit: 20 }),
  });

  const handleSearch = (query: string) => {
    setSearchParams({ search: query, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ ...Object.fromEntries(searchParams), page: newPage.toString() });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Schools</h1>
          <p className="mt-2 text-sm text-gray-700">
            Browse and search Pennsylvania public schools
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Search schools by name..."
        />
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
            <SchoolTable schools={data.data} />
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