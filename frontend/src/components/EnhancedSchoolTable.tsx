import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUpIcon, ChevronDownIcon, FunnelIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { School } from '@shared';
import { growthBand } from '../lib/chartUtils';

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
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (currentSort.field !== field) {
      return <span className="text-stone-300 ml-1">&#8597;</span>;
    }
    return currentSort.order === 'asc' ?
      <ChevronUpIcon className="h-3.5 w-3.5 ml-1 text-gold-600" /> :
      <ChevronDownIcon className="h-3.5 w-3.5 ml-1 text-gold-600" />;
  };

  const getSchoolTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'elementary': return 'bg-navy-100 text-navy-700';
      case 'middle': return 'bg-civic-100 text-civic-800';
      case 'high': return 'bg-gold-100 text-gold-800';
      case 'charter': return 'bg-brick-100 text-brick-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters
                ? 'bg-navy-50 border-navy-200 text-navy-700'
                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Column Filters
          </button>
          {Object.values(columnFilters).some(v => v) && (
            <button
              onClick={() => setColumnFilters({})}
              className="text-sm text-brick-600 hover:text-brick-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
        <span className="text-sm text-stone-500">
          {filteredSchools.length} of {schools.length} schools
        </span>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200">
                {[
                  { field: 'name', label: 'School Name', visibility: '' },
                  { field: 'districtName', label: 'District', visibility: 'hidden md:table-cell' },
                  { field: 'countyName', label: 'County', visibility: 'hidden md:table-cell' },
                  { field: 'type', label: 'Type', visibility: 'hidden sm:table-cell' },
                  { field: 'enrollment', label: 'Students', visibility: 'hidden lg:table-cell text-right' },
                  { field: 'proficiency', label: 'Math prof.', visibility: 'text-right' },
                  { field: 'growth', label: 'Growth', visibility: 'hidden sm:table-cell text-right' },
                ].map(col => (
                  <th key={col.field} className={`px-3 sm:px-5 py-3 text-left ${col.visibility}`}>
                    <button
                      onClick={() => handleSort(col.field)}
                      className="inline-flex items-center text-xs font-semibold text-stone-500 uppercase tracking-wider hover:text-stone-700"
                    >
                      {col.label}
                      <SortIcon field={col.field} />
                    </button>
                  </th>
                ))}
                <th className="hidden lg:table-cell px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">City</th>
                <th className="px-3 sm:px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>

              {showFilters && (
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  {[
                    { field: 'name', visibility: '' },
                    { field: 'districtName', visibility: 'hidden md:table-cell' },
                    { field: 'countyName', visibility: 'hidden md:table-cell' },
                    { field: 'type', visibility: 'hidden sm:table-cell' },
                    { field: 'enrollment', visibility: 'hidden lg:table-cell' },
                    { field: 'proficiency', visibility: '' },
                    { field: 'growth', visibility: 'hidden sm:table-cell' },
                    { field: 'city', visibility: 'hidden lg:table-cell' },
                  ].map(({ field, visibility }) => (
                    <th key={field} className={`px-3 sm:px-5 py-2 ${visibility}`}>
                      <input
                        type="text"
                        value={columnFilters[field] || ''}
                        onChange={(e) => handleFilterChange(field, e.target.value)}
                        placeholder="Filter..."
                        className="w-full px-2.5 py-1.5 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-navy-500/30"
                      />
                    </th>
                  ))}
                  <th className="px-3 sm:px-5 py-2" />
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 sm:px-5 py-12 text-center text-stone-400">
                    No schools found matching your filters
                  </td>
                </tr>
              ) : (
                filteredSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-3 sm:px-5 py-3.5">
                      <div className="text-sm font-medium text-stone-900">{school.name}</div>
                      {/* On phones the district/county columns are hidden, so fold them in here. */}
                      <div className="text-xs text-stone-500 md:hidden">
                        {school.districtName}{school.countyName ? ` · ${school.countyName} County` : ''}
                      </div>
                      <div className="text-xs text-stone-400">#{school.schoolNumber}</div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-5 py-3.5">
                      <div className="text-sm text-stone-700">{school.districtName}</div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-5 py-3.5">
                      <div className="text-sm text-stone-700">{school.countyName}</div>
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getSchoolTypeBadge(school.type || '')}`}>
                        {school.type || 'N/A'}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-5 py-3.5 text-sm text-stone-600 text-right tabular-nums">{(school as any).enrollment ? (school as any).enrollment.toLocaleString() : '—'}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-sm text-right tabular-nums font-medium text-navy-800">{(school as any).proficiency != null ? `${(school as any).proficiency.toFixed(1)}%` : '—'}</td>
                    <td className={`hidden sm:table-cell px-3 sm:px-5 py-3.5 text-sm text-right tabular-nums ${growthBand((school as any).growth).className}`}>{(school as any).growth != null ? (school as any).growth.toFixed(1) : '—'}</td>
                    <td className="hidden lg:table-cell px-3 sm:px-5 py-3.5 text-sm text-stone-500">{school.city || 'N/A'}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/schools/${school.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-navy-600 hover:text-navy-800 transition-colors"
                      >
                        View
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSchools.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-sm text-stone-500">
          <span><strong className="text-stone-700">{new Set(filteredSchools.map(s => s.countyName)).size}</strong> counties</span>
          <span><strong className="text-stone-700">{new Set(filteredSchools.map(s => s.districtId)).size}</strong> districts</span>
          <span><strong className="text-stone-700">{filteredSchools.length}</strong> schools</span>
        </div>
      )}
    </div>
  );
}
