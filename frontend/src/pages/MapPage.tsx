import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { MagnifyingGlassIcon, MapPinIcon, XMarkIcon, AdjustmentsHorizontalIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { schoolApi, districtApi, performanceApi, type MapPoint, type DistrictMapValue } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import FilterSelect from '../components/FilterSelect';
import ClusterLayer from '../components/map/ClusterLayer';
import { formatPct, growthBand, fillYearGaps, tooltipStyle } from '../lib/chartUtils';

type Exam = 'pssa' | 'keystone';
type Metric = 'proficiency' | 'growth' | 'quadrant';
const SUBJECTS: Record<Exam, string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};
const PA_CENTER: [number, number] = [40.9, -77.75];
const PA_ZOOM = 7;
const NO_RESULT = '#f5f5f4';

// Sequential navy ramp for proficiency; diverging brick/gold/grey/navy for growth.
const PROF_STOPS: Array<[number, string, string]> = [
  [20, '#e7e5e4', '<20'], [35, '#c9d6e3', '20-35'], [50, '#a8c3d8', '35-50'], [65, '#7a9bb5', '50-65'], [80, '#4a6d8c', '65-80'], [101, '#243b5c', '80+'],
];
const GROWTH_STOPS: Array<[number, string, string]> = [
  [-2, '#c53030', 'Well below'], [-1, '#d4aa3c', 'Below'], [1, '#a8a29e', 'Meets'], [2, '#4a6d8c', 'Above'], [99, '#243b5c', 'Well above'],
];
const QUADRANTS: Array<[string, string]> = [
  ['#243b5c', 'High achievement, high growth'], ['#27ab83', 'Low achievement, high growth'],
  ['#a8c3d8', 'Growth near the state standard'], ['#d4aa3c', 'High achievement, low growth'], ['#c53030', 'Low achievement, low growth'],
];
const proficiencyColor = (v: number | null) => (v == null ? NO_RESULT : PROF_STOPS.find(([max]) => v < max)?.[1] ?? '#243b5c');
const growthColor = (v: number | null) => (v == null ? NO_RESULT : GROWTH_STOPS.find(([max]) => v < max)?.[1] ?? '#243b5c');
function quadrantColor(prof: number | null, growth: number | null, stateAvg: number | null) {
  if (prof == null || growth == null) return NO_RESULT;
  const high = stateAvg != null ? prof >= stateAvg : prof >= 50;
  if (growth >= 1) return high ? QUADRANTS[0][0] : QUADRANTS[1][0];
  if (growth <= -1) return high ? QUADRANTS[3][0] : QUADRANTS[4][0];
  return QUADRANTS[2][0];
}
/** Dot radius from enrollment: 3px for a tiny school up to 10px for the largest. */
const radiusFor = (p: MapPoint) => Math.max(3, Math.min(10, 3 + 4.5 * Math.sqrt((p.enrollment ?? 300) / 1000)));

/** Keeps the URL's `view` param in sync with the map, and applies it on load. */
function ViewSync({ view, onChange }: { view: string; onChange: (v: string) => void }) {
  const map = useMap();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const [lat, lng, z] = view.split(',').map(Number);
    if ([lat, lng, z].every(Number.isFinite)) map.setView([lat, lng], z);
  }, [map, view]);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onChange(`${c.lat.toFixed(4)},${c.lng.toFixed(4)},${map.getZoom()}`);
    },
  });
  return null;
}

/** Fits the map to a set of points when the target key changes (county pick, search hit). */
function FitTo({ target, points }: { target: string; points: MapPoint[] }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!target || target === last.current) return;
    last.current = target;
    if (target === 'state') { map.flyTo(PA_CENTER, PA_ZOOM); return; }
    if (target.startsWith('point:')) {
      const [, lat, lng] = target.split(':');
      map.flyTo([Number(lat), Number(lng)], 13, { duration: 0.8 });
      return;
    }
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.flyToBounds(bounds, { padding: [24, 24], maxZoom: 12, duration: 0.8 });
  }, [target, points, map]);
  return null;
}

/** Only draw district boundaries when zoomed out enough for them to read. */
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

export default function MapPage() {
  const availableYears = useAvailableYears();
  const { latest } = availableYears;
  const [yearParam, setYear] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const year = yearParam ?? latest;
  const [exam, setExam] = useUrlState<Exam>('exam', 'pssa', (r) => (r === 'pssa' || r === 'keystone' ? r : null));
  const years = yearsForExam(availableYears, exam);
  const [subjectParam, setSubject] = useUrlState<string>('subject', SUBJECTS[exam][0], parseString);
  const subject = SUBJECTS[exam].includes(subjectParam) ? subjectParam : SUBJECTS[exam][0];
  const [metric, setMetric] = useUrlState<Metric>('metric', 'proficiency', (r) => (['proficiency', 'growth', 'quadrant'].includes(r) ? (r as Metric) : null));
  const [type, setType] = useUrlState<string>('type', '', parseString);
  const [countyId, setCountyId] = useUrlState<number | ''>('county', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [showEmpty, setShowEmpty] = useUrlState<boolean>('empty', false, (r) => r === '1', (v) => (v ? '1' : ''));
  const [boundaries, setBoundaries] = useUrlState<boolean>('districts', true, (r) => r !== '0', (v) => (v ? '' : '0'));
  const [view, setView] = useUrlState<string>('view', '', parseString);
  const [selectedId, setSelectedId] = useUrlState<number | null>('s', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [fitTarget, setFitTarget] = useState('');
  const [zoom, setZoom] = useState(PA_ZOOM);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useDocumentTitle('School map', `Every Pennsylvania public school on a map, colored by ${metric === 'growth' ? 'PVAAS growth' : metric === 'quadrant' ? 'growth and achievement' : 'proficiency'}.`);

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['map', year, exam, subject],
    queryFn: () => schoolApi.getMapPoints({ year: year!, exam, subject }),
    enabled: year != null,
    staleTime: 60 * 60 * 1000,
  });
  const { data: filterOptions } = useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => (await fetch('/paschools/api/schools/filters')).json() as Promise<{ counties: Array<{ id: number; name: string }>; schoolTypes: string[] }>,
    staleTime: 30 * 60 * 1000,
  });
  const { data: statePerformance } = useQuery({
    queryKey: ['state-performance', year],
    queryFn: () => performanceApi.getStatePerformance(year!),
    enabled: year != null && metric === 'quadrant',
  });
  const stateAvg: number | null = useMemo(() => {
    if (!statePerformance) return null;
    const rows = exam === 'pssa' ? (statePerformance.pssa ?? []).filter((r: any) => r.grade === 0) : (statePerformance.keystone ?? []);
    return rows.find((r: any) => r.subject === subject)?.avgProficientOrAbove ?? null;
  }, [statePerformance, exam, subject]);
  const { data: districtValues = [] } = useQuery({
    queryKey: ['district-map-values', year, exam, subject],
    queryFn: () => districtApi.getMapValues({ year: year!, exam, subject }),
    enabled: year != null && boundaries,
    staleTime: 60 * 60 * 1000,
  });
  const { data: geojson } = useQuery({
    queryKey: ['pa-districts-geojson'],
    queryFn: async () => (await fetch('/paschools/assets/pa-districts-2023.geojson')).json(),
    enabled: boundaries,
    staleTime: Infinity,
  });
  const { data: searchResults } = useQuery({
    queryKey: ['school-search', searchTerm],
    queryFn: () => schoolApi.getSchools({ search: searchTerm, limit: 8 }),
    enabled: searchTerm.trim().length >= 2,
  });
  const { data: selected } = useQuery({
    queryKey: ['school', String(selectedId)],
    queryFn: () => schoolApi.getSchool(String(selectedId)),
    enabled: selectedId != null,
    staleTime: 60 * 60 * 1000,
  });

  // Filtering and styling inputs for the cluster layer (memoised so markers are not rebuilt on every render).
  const valueOf = useCallback((p: MapPoint) => (metric === 'growth' ? p.growth : metric === 'quadrant' ? (p.growth == null || p.proficiency == null ? null : p.proficiency) : p.proficiency), [metric]);
  const colorOf = useCallback((p: MapPoint) => (
    metric === 'growth' ? growthColor(p.growth) : metric === 'quadrant' ? quadrantColor(p.proficiency, p.growth, stateAvg) : proficiencyColor(p.proficiency)
  ), [metric, stateAvg]);
  const clusterColorOf = useCallback((mean: number | null) => (metric === 'growth' ? growthColor(mean) : mean == null ? '#a8a29e' : proficiencyColor(mean)), [metric]);
  const shown = useMemo(() => points.filter((p) =>
    (!type || p.type === type) && (countyId === '' || p.countyId === countyId) && (showEmpty || valueOf(p) != null)
  ), [points, type, countyId, showEmpty, valueOf]);
  const withValue = useMemo(() => shown.filter((p) => valueOf(p) != null), [shown, valueOf]);
  const sorted = useMemo(() => withValue.slice().sort((a, b) => (valueOf(b) ?? -999) - (valueOf(a) ?? -999)), [withValue, valueOf]);

  // County pick zooms to the county's schools; clearing it returns to the state view.
  useEffect(() => { setFitTarget(countyId === '' ? (fitTarget ? 'state' : '') : `county:${countyId}`); }, [countyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueByNces = useMemo(() => {
    const m = new Map<string, DistrictMapValue>();
    districtValues.forEach((d) => { if (d.ncesId) m.set(d.ncesId, d); });
    return m;
  }, [districtValues]);
  const boundaryStyle = useCallback((feature: any) => {
    const d = valueByNces.get(feature?.properties?.geoid);
    const v = metric === 'growth' ? d?.growth ?? null : d?.proficiency ?? null;
    return {
      color: '#1b2a4a', weight: 0.6, opacity: 0.5,
      fillColor: v == null ? '#f5f5f4' : metric === 'growth' ? growthColor(v) : proficiencyColor(v),
      fillOpacity: v == null ? 0.15 : 0.35,
    };
  }, [valueByNces, metric]);
  const onEachDistrict = useCallback((feature: any, layer: L.Layer) => {
    const d = valueByNces.get(feature?.properties?.geoid);
    const label = `${feature?.properties?.name ?? 'District'}${d ? ` · ${formatPct(d.proficiency)} proficient${d.growth != null ? `, growth ${d.growth.toFixed(1)}` : ''}` : ''}`;
    layer.bindTooltip(label, { sticky: true });
    if (d) layer.on('click', () => { window.location.assign(`/paschools/districts/${d.id}`); });
  }, [valueByNces]);
  const showBoundaries = boundaries && !!geojson && zoom <= 11;

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => setFitTarget(`point:${pos.coords.latitude}:${pos.coords.longitude}`));
  };
  const pickSearchResult = (s: any) => {
    setSearchTerm('');
    setSelectedId(s.id);
    const p = points.find((x) => x.id === s.id);
    const lat = s.latitude ?? p?.lat, lng = s.longitude ?? p?.lng;
    if (lat != null && lng != null) setFitTarget(`point:${lat}:${lng}`);
  };

  // Selected school: headline figures for the year and a sparkline for the subject.
  const sel: any = selected;
  const selRows: any[] = sel ? (exam === 'pssa' ? sel.pssaResults : sel.keystoneResults) ?? [] : [];
  const selFor = (subj: string) => selRows.find((r) => r.year === year && r.subject === subj && (exam === 'keystone' || r.grade === 0));
  const spark = fillYearGaps(
    selRows.filter((r) => r.subject === subject && (exam === 'keystone' || r.grade === 0) && r.percentProficientOrAbove != null)
      .map((r) => ({ year: r.year, v: r.percentProficientOrAbove })).sort((a, b) => a.year - b.year),
  );

  // Windowed list so thousands of rows stay cheap.
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const ROW = 48, VISIBLE = 9;
  const start = Math.max(0, Math.floor(scrollTop / ROW) - 3);
  const end = Math.min(sorted.length, start + VISIBLE + 6);

  const filters = (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
      <FilterSelect label="Color by" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
        <option value="proficiency">Proficiency</option>
        <option value="growth">Growth</option>
        <option value="quadrant">Growth vs. achievement</option>
      </FilterSelect>
      <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </FilterSelect>
      <FilterSelect label="Exam" value={exam} onChange={(e) => { const v = e.target.value as Exam; setExam(v); setSubject(SUBJECTS[v][0]); setType(v === 'keystone' ? 'High' : ''); }}>
        <option value="pssa">PSSA</option>
        <option value="keystone">Keystone</option>
      </FilterSelect>
      <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {SUBJECTS[exam].map((s) => <option key={s} value={s}>{s}</option>)}
      </FilterSelect>
      <FilterSelect label="School type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All types</option>
        {filterOptions?.schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </FilterSelect>
      <FilterSelect label="County" value={countyId} onChange={(e) => setCountyId(e.target.value ? Number(e.target.value) : '')}>
        <option value="">All counties</option>
        {filterOptions?.counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </FilterSelect>
      <label className="inline-flex items-center gap-2 text-sm text-stone-600 sm:self-end sm:pb-2 cursor-pointer select-none">
        <input type="checkbox" checked={boundaries} onChange={(e) => setBoundaries(e.target.checked)} className="rounded border-stone-300 text-navy-600" />
        District boundaries
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-stone-600 sm:self-end sm:pb-2 cursor-pointer select-none">
        <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="rounded border-stone-300 text-navy-600" />
        Show schools without a result
      </label>
    </div>
  );

  const legend = metric === 'quadrant'
    ? QUADRANTS.map(([color, label]) => [label, color] as const)
    : metric === 'growth' ? GROWTH_STOPS.map(([, color, label]) => [label, color] as const) : PROF_STOPS.map(([, color, label]) => [label, color] as const);

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8">
      <div className="px-4 sm:px-0 pt-6 sm:pt-0 mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">School Map</h1>
        <p className="mt-1 text-sm text-stone-500">
          {subject}, {year}. Dots are schools sized by enrollment; shaded areas are districts. Zoom in to separate clusters, click a school for details.
        </p>
      </div>

      {/* Desktop: filters above the map. Phone: a sheet opened from a floating button. */}
      <div className="hidden sm:block card-surface p-4 mb-4">{filters}</div>

      <div className="relative card-surface sm:overflow-hidden rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <div className="absolute z-[1000] top-3 left-3 right-3 sm:left-14 sm:right-auto sm:w-80 flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find a school"
              aria-label="Find a school on the map"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white/95 text-sm shadow focus:outline-none focus:ring-2 focus:ring-navy-500/30"
            />
            {searchResults && searchTerm.trim().length >= 2 && searchResults.data.length > 0 && (
              <ul className="absolute mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg divide-y divide-stone-100 max-h-72 overflow-auto" role="listbox">
                {searchResults.data.map((s: any) => (
                  <li key={s.id}>
                    <button onClick={() => pickSearchResult(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50">
                      <div className="font-medium text-stone-900 truncate">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">{s.districtName}{s.type ? ` · ${s.type}` : ''}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={locateMe} title="Zoom to my location" aria-label="Zoom to my location" className="px-2.5 rounded-lg border border-stone-200 bg-white/95 text-stone-600 shadow hover:text-navy-700">
            <MapPinIcon className="w-5 h-5" />
          </button>
          <button onClick={() => setFiltersOpen(true)} aria-label="Filters" className="sm:hidden px-2.5 rounded-lg border border-stone-200 bg-white/95 text-stone-600 shadow">
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="h-[calc(100vh-9.5rem)] sm:h-[62vh] sm:min-h-[24rem]">
          <MapContainer center={PA_CENTER} zoom={PA_ZOOM} preferCanvas scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ViewSync view={view} onChange={setView} />
            <FitTo target={fitTarget} points={fitTarget.startsWith('county:') ? points.filter((p) => p.countyId === countyId) : points} />
            <ZoomWatcher onZoom={setZoom} />
            {showBoundaries && (
              <GeoJSON key={`${metric}-${year}-${exam}-${subject}-${districtValues.length}`} data={geojson} style={boundaryStyle} onEachFeature={onEachDistrict} />
            )}
            <ClusterLayer
              points={shown}
              valueOf={valueOf}
              colorOf={colorOf}
              clusterColorOf={clusterColorOf}
              radiusOf={radiusFor}
              selectedId={selectedId}
              highlightedId={highlightedId}
              onSelect={setSelectedId}
            />
          </MapContainer>
        </div>

        {/* Selected school panel: over the map on desktop, below it on phones. */}
        {selectedId != null && (
          <div className="sm:absolute sm:z-[1000] sm:top-16 sm:right-3 sm:w-80 bg-white sm:rounded-xl sm:shadow-lg border-t sm:border border-stone-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-900 leading-snug">{sel?.name ?? 'Loading…'}</div>
                {sel && <div className="text-xs text-stone-500 truncate">{sel.districtName}{sel.type ? ` · ${sel.type}` : ''}{sel.enrollment ? ` · ${sel.enrollment.toLocaleString()} students` : ''}</div>}
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close" className="text-stone-400 hover:text-stone-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            {sel && (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {SUBJECTS[exam].map((subj) => {
                    const r = selFor(subj);
                    return (
                      <div key={subj} className={subj === subject ? 'rounded-md bg-stone-50 p-1.5 -m-1.5' : ''}>
                        <dt className="text-stone-500 truncate">{subj === 'English Language Arts' ? 'ELA' : subj}</dt>
                        <dd className="text-base font-semibold text-navy-800 tabular-nums">{formatPct(r?.percentProficientOrAbove)}</dd>
                        {r?.growthScore != null && <dd className={`text-[11px] ${growthBand(r.growthScore).className}`}>growth {r.growthScore.toFixed(1)}</dd>}
                      </div>
                    );
                  })}
                </dl>
                {spark.length > 1 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-stone-500 mb-1">{subject} proficient or above, {spark[0].year}-{spark[spark.length - 1].year}</div>
                    <ResponsiveContainer width="100%" height={64}>
                      <LineChart data={spark} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="year" hide />
                        <YAxis domain={[0, 100]} hide />
                        <ChartTooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Proficient']} labelFormatter={(l) => String(l)} />
                        <Line type="monotone" dataKey="v" stroke="#2d4a6f" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/schools/${sel.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-700 text-white hover:bg-navy-600">
                    Open school <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  </Link>
                  <Link to={`/districts/${sel.districtId}`} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50">District</Link>
                </div>
              </>
            )}
          </div>
        )}

        <div className="px-4 sm:px-6 py-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-stone-700">{metric === 'growth' ? 'Growth index' : metric === 'quadrant' ? `Vs. state average${stateAvg != null ? ` (${formatPct(stateAvg)})` : ''}` : '% proficient or above'}</span>
            {legend.map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />{label}</span>
            ))}
            <span className="inline-flex items-center gap-1 pl-2 border-l border-stone-200"><span className="w-2 h-2 rounded-full bg-stone-400 inline-block" /><span className="w-3.5 h-3.5 rounded-full bg-stone-400 inline-block" /> size = enrollment</span>
          </div>
          <span>{isLoading ? 'Loading…' : `${withValue.length.toLocaleString()} schools with a result${showEmpty ? ` of ${shown.length.toLocaleString()} shown` : ''}`}</span>
        </div>
      </div>

      {/* Phone filter sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[1100] sm:hidden" role="dialog" aria-modal="true" aria-label="Map filters">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-stone-900">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="text-stone-400"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            {filters}
            <button onClick={() => setFiltersOpen(false)} className="mt-4 w-full py-2.5 rounded-lg bg-navy-700 text-white text-sm font-medium">Show {withValue.length.toLocaleString()} schools</button>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <section className="card-surface mt-4 mx-4 sm:mx-0 overflow-hidden" aria-label={`Schools on the map, ${sorted.length} with a ${metric} value, sorted highest first`}>
          <div className="px-4 sm:px-6 py-3 border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900">Schools shown ({sorted.length.toLocaleString()})</h2>
            <p className="text-xs text-stone-400">Sorted by {metric === 'quadrant' ? 'proficiency' : metric}; hover or focus a row to find it on the map</p>
          </div>
          <div ref={listRef} className="overflow-y-auto" style={{ height: ROW * VISIBLE }} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
            <ul style={{ height: sorted.length * ROW, position: 'relative' }}>
              {sorted.slice(start, end).map((p, i) => {
                const v = valueOf(p);
                return (
                  <li key={p.id} style={{ position: 'absolute', top: (start + i) * ROW, left: 0, right: 0, height: ROW }}>
                    <Link
                      to={`/schools/${p.id}`}
                      onMouseEnter={() => setHighlightedId(p.id)}
                      onMouseLeave={() => setHighlightedId(null)}
                      onFocus={() => setHighlightedId(p.id)}
                      onBlur={() => setHighlightedId(null)}
                      className={`flex items-center justify-between gap-3 px-4 sm:px-6 h-full border-b border-stone-100 hover:bg-stone-50 ${p.id === selectedId ? 'bg-gold-50/60' : ''}`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorOf(p) }} aria-hidden />
                        <span className="text-sm font-medium text-stone-900 truncate">{p.name}</span>
                      </div>
                      <span className="text-sm tabular-nums text-stone-700 whitespace-nowrap">
                        {metric === 'growth' ? v?.toFixed(1) : formatPct(v)}{metric !== 'growth' && p.growth != null ? <span className="text-xs text-stone-400"> · g {p.growth.toFixed(1)}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
