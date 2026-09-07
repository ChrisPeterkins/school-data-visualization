import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { districtApi } from '../services/api';
import { useT } from '../i18n';

/** Districts of the same type closest in size, low-income share, spending, and distance, with a one-click comparison. */
export default function PeerDistricts({ districtId, districtName }: { districtId: number; districtName: string }) {
  const t = useT();
  const { data } = useQuery({ queryKey: ['similar-districts', districtId], queryFn: () => districtApi.getSimilarDistricts(String(districtId), 4), staleTime: 60 * 60 * 1000 });
  const similar = data?.similar;
  if (!similar || similar.length === 0) return null;
  const compareHref = `/compare?entity=district&districts=${[districtId, ...similar.map((s) => s.id)].join(',')}`;
  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t('peer.title')}</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t('peer.sub')}{data?.lowIncome != null ? ` (${districtName}: ${data.lowIncome}% ${t('peer.lowIncome')}${data.perPupil ? `, $${Math.round(data.perPupil).toLocaleString()} ${t('peer.perPupil')}` : ''})` : ''}</p>
        </div>
        <Link to={compareHref} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-navy-700 text-white hover:bg-navy-600 transition-colors">
          <ArrowsRightLeftIcon className="w-4 h-4" />
          {t('peer.compare')}
        </Link>
      </div>
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        {similar.map((s) => (
          <li key={s.id}>
            <Link to={`/districts/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-navy-700 dark:hover:text-navy-100 dark:text-navy-200">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{s.name}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{s.countyName} {t('common.county')}{s.city ? ` · ${s.city}` : ''}</div>
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 text-right whitespace-nowrap tabular-nums">
                {s.enrollment ? <div>{s.enrollment.toLocaleString()} {t('common.students')}</div> : null}
                {s.lowIncome != null ? <div>{s.lowIncome}% {t('peer.lowIncome')}</div> : null}
                {s.perPupil ? <div>${Math.round(s.perPupil).toLocaleString()} {t('peer.perPupil')}</div> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
