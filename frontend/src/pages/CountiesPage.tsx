import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { countyApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useT } from '../i18n';

export default function CountiesPage() {
  const t = useT();
  useDocumentTitle('Counties', "Pennsylvania's 67 counties with district and school counts.");
  const { data: counties = [], isLoading } = useQuery({ queryKey: ['counties'], queryFn: countyApi.getCounties, staleTime: 60 * 60 * 1000 });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('pages.counties.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('pages.counties.sub')}</p>
      </div>
      {isLoading ? (
        <div className="card-surface p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <ul className="divide-y divide-stone-100 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:divide-y-0">
            {counties.map((c) => (
              <li key={c.id} className="sm:border-b sm:border-stone-100">
                <Link to={`/counties/${c.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-stone-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900">{c.name}</div>
                    <div className="text-xs text-stone-500">
                      {c.districtCount} {c.districtCount === 1 ? 'district' : 'districts'} · {c.schoolCount} schools
                      {c.enrollment ? ` · ${c.enrollment.toLocaleString()} students` : ''}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
