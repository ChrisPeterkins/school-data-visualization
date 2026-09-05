import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { schoolApi } from '../services/api';

/** Nearest schools of the same level and similar size, with a one-click comparison. */
export default function SimilarSchools({ schoolId, schoolName }: { schoolId: number; schoolName: string }) {
  const { data: similar } = useQuery({
    queryKey: ['similar', schoolId],
    queryFn: () => schoolApi.getSimilar(String(schoolId), 4),
    staleTime: 60 * 60 * 1000,
  });
  if (!similar || similar.length === 0) return null;
  const compareHref = `/compare?schools=${[schoolId, ...similar.map((s) => s.id)].join(',')}`;

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Similar schools</h2>
          <p className="text-xs text-stone-400">Same level, nearest and closest in size to {schoolName}</p>
        </div>
        <Link to={compareHref} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-navy-700 text-white hover:bg-navy-600 transition-colors">
          <ArrowsRightLeftIcon className="w-4 h-4" />
          Compare these
        </Link>
      </div>
      <ul className="divide-y divide-stone-100">
        {similar.map((s) => (
          <li key={s.id}>
            <Link to={`/schools/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-navy-700">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{s.name}</div>
                <div className="text-xs text-stone-500 truncate">{s.districtName}{s.city ? ` · ${s.city}` : ''}</div>
              </div>
              <div className="text-xs text-stone-500 text-right whitespace-nowrap">
                {s.distanceKm != null ? `${s.distanceKm} km` : s.countyName}
                {s.enrollment ? <div>{s.enrollment.toLocaleString()} students</div> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
