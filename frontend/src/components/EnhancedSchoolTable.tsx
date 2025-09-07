import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUpIcon, ChevronDownIcon, FunnelIcon } from '@heroicons/react/24/outline';

interface School {
  id: number;
  schoolNumber: string;
  name: string;
  type: string;
  districtId: number;
  districtName: string;
  districtAun: string;
  countyId: number;
  countyName: string;
  countyCode: string;
  address?: string;
  city?: string;
  zipCode?: string;
}

interface EnhancedSchoolTableProps {
  schools: School[];
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  currentSort?: { field: string; order: 'asc' | 'desc' };
}

export default function EnhancedSchoolTable({ 
  schools, 
  onSort,
  currentSort = { field: 'name', order: 'asc' }
}: EnhancedSchoolTableProps) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Filter schools based on column filters
  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      return Object.entries(columnFilters).every(([key, value]) => {
        if (!value) return true;
        const schoolValue = String(school[key as keyof School] || '').toLowerCase();
        return schoolValue.includes(value.toLowerCase());
      });
    });
  }, [schools, columnFilters]);

  const handleSort = (field: string) => {
    if (onSort) {
      const newOrder = currentSort.field === field && currentSort.order === 'asc' ? 'desc' : 'asc';
      onSort(field, newOrder);
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const clearFilters = () => {
    setColumnFilters({});
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (currentSort.field !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return currentSort.order === 'asc' ? 
      <ChevronUpIcon className="h-4 w-4 inline" /> : 
      <ChevronDownIcon className="h-4 w-4 inline" />;
  };

  const getSchoolTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'elementary':
        return 'bg-blue-100 text-blue-800';
      case 'middle':
        return 'bg-purple-100 text-purple-800';
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'charter':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide' : 'Show'} Column Filters
          </button>
          {Object.values(columnFilters).some(v => v) && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              Clear all filters
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Showing {filteredSchools.length} of {schools.length} schools
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="group inline-flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  School Name
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('districtName')}
                  className="group inline-flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  District
                  <SortIcon field="districtName" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('countyName')}
                  className="group inline-flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  County
                  <SortIcon field="countyName" />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('type')}
                  className="group inline-flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  Type
                  <SortIcon field="type" />
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                City
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
            {/* Filter Row */}
            {showFilters && (
              <tr className="bg-gray-100">
                <th className="px-6 py-2">
                  <input
                    type="text"
                    value={columnFilters.name || ''}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    value={columnFilters.districtName || ''}
                    onChange={(e) => handleFilterChange('districtName', e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    value={columnFilters.countyName || ''}
                    onChange={(e) => handleFilterChange('countyName', e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    value={columnFilters.type || ''}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    value={columnFilters.city || ''}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    placeholder="Filter..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-2"></th>
              </tr>
            )}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No schools found matching your filters
                </td>
              </tr>
            ) : (
              filteredSchools.map((school) => (
                <tr key={school.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{school.name}</div>
                      <div className="text-xs text-gray-500">#{school.schoolNumber}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">{school.districtName}</div>
                      <div className="text-xs text-gray-500">AUN: {school.districtAun}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{school.countyName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSchoolTypeColor(school.type)}`}>
                      {school.type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {school.city || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/schools/${school.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      {filteredSchools.length > 0 && (
        <div className="bg-gray-50 px-6 py-3 rounded-lg">
          <div className="text-sm text-gray-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="font-medium">Counties:</span>{' '}
                {new Set(filteredSchools.map(s => s.countyName)).size}
              </div>
              <div>
                <span className="font-medium">Districts:</span>{' '}
                {new Set(filteredSchools.map(s => s.districtId)).size}
              </div>
              <div>
                <span className="font-medium">Schools:</span>{' '}
                {filteredSchools.length}
              </div>
              <div>
                <span className="font-medium">Types:</span>{' '}
                {new Set(filteredSchools.map(s => s.type).filter(Boolean)).size}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}