import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { schoolApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { formatPct } from '../lib/chartUtils';
import { useT } from '../i18n';

const color = (p: number | null) => (p == null ? '#a8a29e' : p >= 70 ? '#1e3a5f' : p >= 55 ? '#3b6491' : p >= 40 ? '#8fa8c6' : p >= 25 ? '#d8b04a' : '#b45309');

/** Small map of a county's schools, colored by the latest PSSA Math proficiency. */
export default function CountyMapInset({ countyId }: { countyId: number }) {
  const t = useT();
  const navigate = useNavigate();
  const { latest } = useAvailableYears();
  const { data: points = [] } = useQuery({
    queryKey: ['map', latest, 'pssa', 'Mathematics', 'All Students'],
    queryFn: () => schoolApi.getMapPoints({ year: latest!, exam: 'pssa', subject: 'Mathematics' }),
    enabled: latest != null,
    staleTime: 60 * 60 * 1000,
  });
  const mine = useMemo(() => points.filter((p) => p.countyId === countyId && p.lat && p.lng), [points, countyId]);
  const bounds = useMemo(() => {
    if (!mine.length) return null;
    const lats = mine.map((p) => p.lat), lngs = mine.map((p) => p.lng);
    return [[Math.min(...lats) - 0.02, Math.min(...lngs) - 0.02], [Math.max(...lats) + 0.02, Math.max(...lngs) + 0.02]] as [[number, number], [number, number]];
  }, [mine]);
  if (!bounds || latest == null) return null;
  return (
    <section className="card-surface overflow-hidden" aria-labelledby="county-map-heading">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <h2 id="county-map-heading" className="text-base font-semibold text-stone-900">{t('county.map')}</h2>
          <p className="text-xs text-stone-500">{t('county.mapSub', { year: latest })}</p>
        </div>
        <Link to={`/map?county=${countyId}&year=${latest}`} className="text-sm font-medium text-navy-600 hover:text-navy-800">{t('county.openMap')} →</Link>
      </div>
      <div className="h-72 sm:h-80" role="img" aria-label={t('county.map')}>
        <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-full w-full" attributionControl={false}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {mine.map((p) => (
            <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={Math.max(4, Math.min(11, Math.sqrt(p.enrollment ?? 200) / 4))} pathOptions={{ color: '#fff', weight: 1, fillColor: color(p.proficiency), fillOpacity: 0.85 }} eventHandlers={{ click: () => navigate(`/schools/${p.id}`) }}>
              <Tooltip direction="top" offset={[0, -6]}><span className="text-xs"><strong>{p.name}</strong><br />{p.type ?? ''}{p.proficiency != null ? ` · Math ${formatPct(p.proficiency)}` : ''}</span></Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
