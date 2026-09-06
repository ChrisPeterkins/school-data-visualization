import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPinIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { schoolApi } from '../services/api';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatPct } from '../lib/chartUtils';
import FilterSelect from '../components/FilterSelect';
import { useT } from '../i18n';

/** Distance-sorted list of schools around the visitor (or any point in the URL). */
export default function NearbyPage() {
  const t = useT();
  const [lat, setLat] = useUrlState<number | null>('lat', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [lng, setLng] = useUrlState<number | null>('lng', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [type, setType] = useUrlState<string>('type', '', parseString);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  useDocumentTitle(t('near.title'), 'Pennsylvania public schools nearest to you, with their latest PSSA and Keystone results.');

  const locate = () => {
    if (!navigator.geolocation) { setGeoError(t('near.noGeo')); return; }
    setLocating(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(Math.round(pos.coords.latitude * 10000) / 10000); setLng(Math.round(pos.coords.longitude * 10000) / 10000); setLocating(false); },
      () => { setGeoError(t('near.denied')); setLocating(false); },
      { timeout: 10000 },
    );
  };
  useEffect(() => { if (lat == null || lng == null) locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['nearby', lat, lng, type],
    queryFn: () => schoolApi.getNearby({ lat: lat!, lng: lng!, limit: 25, ...(type ? { type } : {}) }),
    enabled: lat != null && lng != null,
    staleTime: 10 * 60 * 1000,
  });
  const { data: filterOptions } = useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => (await fetch('/paschools/api/schools/filters')).json() as Promise<{ schoolTypes: string[] }>,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('near.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('near.sub')}</p>
      </div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <button type="button" onClick={locate} disabled={locating} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-60">
          <MapPinIcon className="w-4 h-4" />{locating ? t('near.locating') : t('near.useLocation')}
        </button>
        <FilterSelect label={t('common.schoolType')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('common.allTypes')}</option>
          {filterOptions?.schoolTypes.map((x) => <option key={x} value={x}>{x}</option>)}
        </FilterSelect>
        {lat != null && lng != null && <Link to={`/map?view=${lat},${lng},12`} className="text-sm font-medium text-navy-600 hover:text-navy-800 sm:ml-auto">{t('county.openMap')} →</Link>}
      </div>
      {geoError && <p className="mb-4 text-sm text-brick-600">{geoError}</p>}
      {lat == null && !geoError && <p className="text-sm text-stone-500">{t('near.waiting')}</p>}
      {isLoading && <div className="card-surface p-8 text-center"><div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" /></div>}
      {data && (
        <div className="card-surface overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {data.schools.map((s) => {
              const hs = s.math == null && s.ela == null;
              return (
                <li key={s.id}>
                  <Link to={`/schools/${s.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-stone-50">
                    <div className="w-14 flex-shrink-0 text-right"><span className="text-sm font-semibold text-navy-800 tabular-nums">{s.km < 10 ? s.km.toFixed(1) : Math.round(s.km)}</span><span className="text-[10px] text-stone-500"> km</span></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-stone-900 truncate">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">{[s.type, s.districtName, s.city].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="hidden sm:flex gap-4 text-right">
                      {(hs ? [['Alg I', s.algebra], ['Lit', s.literature]] : [['Math', s.math], ['ELA', s.ela]]).map(([label, v]) => (
                        <div key={String(label)} className="w-14"><div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div><div className="text-sm font-semibold tabular-nums text-stone-900">{formatPct(v as number | null)}</div></div>
                      ))}
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="px-4 sm:px-5 py-2 text-xs text-stone-500 border-t border-stone-100">{t('near.note', { year: data.year ?? '' })}</p>
        </div>
      )}
    </div>
  );
}
