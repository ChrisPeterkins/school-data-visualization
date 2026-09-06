import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { districtApi } from '../services/api';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import ExportCsvButton from '../components/ExportCsvButton';
import Pagination from '../components/Pagination';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useT } from '../i18n';
import SpendingScatter from '../components/SpendingScatter';

export default function DistrictsPage() {
  const t = useT();
  const [search, setSearch] = useUrlState<string>('q', '', parseString);
  const [page, setPage] = useUrlState<number>('page', 1, parseNumber);
  const [countyId, setCountyId] = useUrlState<number | ''>('county', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [type, setType] = useUrlState<string>('type', '', parseString);
  const [minEnrollment, setMinEnrollment] = useUrlState<number>('min', 0, parseNumber, (v) => (v ? String(v) : ''));
  const [sortBy, setSortBy] = useUrlState<string>('sort', 'name', parseString);
  const [draft, setDraft] = useState(search);
  const { data: filterOptions } = useQuery({
    queryKey: ['district-filters'],
    queryFn: async () => (await fetch('/paschools/api/schools/filters')).json() as Promise<{ counties: Array<{ id: number; name: string }>; schoolTypes: string[] }>,
    staleTime: 30 * 60 * 1000,
  });
  const DISTRICT_TYPES = ['Public', 'Charter', 'Cyber Charter', 'CTC'];
  useDocumentTitle(search ? `Districts matching "${search}"` : 'Districts', 'Browse Pennsylvania school districts, charters, and career and technical centers.');

  const { data: districtsData, isLoading } = useQuery({
    queryKey: ['districts', { search, page, countyId, type, minEnrollment, sortBy }],
    queryFn: () => districtApi.getDistricts({
      search, page, limit: 25,
      ...(countyId ? { countyId } : {}), ...(type ? { type } : {}), ...(minEnrollment ? { minEnrollment } : {}),
      sortBy: sortBy as any, sortOrder: sortBy === 'name' || sortBy === 'countyName' ? 'asc' : 'desc',
    } as any),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('pages.districts.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {t('pages.districts.sub', { n: districtsData?.meta?.total?.toLocaleString() || '...' })}
        </p>
      </div>

      <div className="mb-8">
        <SpendingScatter />
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
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

      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
        <FilterSelect label={t('common.county')} value={countyId} onChange={(e) => { setCountyId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
          <option value="">{t('common.allCounties')}</option>
          {filterOptions?.counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect label={t('districts.type')} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">{t('common.allTypes')}</option>
          {DISTRICT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </FilterSelect>
        <FilterSelect label={t('districts.minEnrollment')} value={minEnrollment} onChange={(e) => { setMinEnrollment(Number(e.target.value)); setPage(1); }}>
          <option value={0}>{t('districts.any')}</option>
          {[500, 1000, 2500, 5000, 10000].map((n) => <option key={n} value={n}>{n.toLocaleString()}+</option>)}
        </FilterSelect>
        <FilterSelect label={t('districts.sort')} value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
          <option value="name">{t('districts.sortName')}</option>
          <option value="enrollment">{t('districts.sortEnrollment')}</option>
          <option value="proficiency">{t('districts.sortProficiency')}</option>
          <option value="schoolCount">{t('districts.sortSchools')}</option>
        </FilterSelect>
        {districtsData?.data?.length ? (
          <ExportCsvButton filename="districts" rows={districtsData.data.map((d: any) => ({ district: d.name, type: d.districtType, county: d.countyName, schools: d.schoolCount, enrollment: d.totalEnrollment, [`proficiency_${d.proficiencyYear}`]: d.proficiency }))} className="sm:ml-auto sm:self-end" />
        ) : null}
      </div>

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
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-stone-900">{district.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-stone-500">
                        <span>{district.countyName} County</span>
                        {district.districtType && district.districtType !== 'Public' && <span>{district.districtType}</span>}
                        {district.schoolCount > 0 && <span>{district.schoolCount} {district.schoolCount === 1 ? 'school' : 'schools'}</span>}
                        {district.totalEnrollment ? <span>{district.totalEnrollment.toLocaleString()} enrolled</span> : null}
                      </div>
                    </div>
                    {district.proficiency != null && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-navy-900 tabular-nums">{district.proficiency}%</div>
                        <div className="text-[10px] uppercase tracking-wide text-stone-500">{t('districts.mathEla', { year: district.proficiencyYear })}</div>
                      </div>
                    )}
                    <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
              {districtsData?.data.length === 0 && (
                <li className="px-5 py-12 text-center text-sm text-stone-500">No districts match that search</li>
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
