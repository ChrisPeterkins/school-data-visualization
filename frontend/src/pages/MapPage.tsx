import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { schoolApi } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import FilterSelect from '../components/FilterSelect';
import { formatPct } from '../lib/chartUtils';

type Exam = 'pssa' | 'keystone';
type Metric = 'proficiency' | 'growth';
const SUBJECTS: Record<Exam, string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};
const PA_CENTER: [number, number] = [40.9, -77.75];

// Sequential navy ramp for proficiency; diverging brick/gold/navy for growth.
const PROF_STOPS: Array<[number, string]> = [[20, '#e7e5e4'], [35, '#c9d6e3'], [50, '#a8c3d8'], [65, '#7a9bb5'], [80, '#4a6d8c'], [101, '#243b5c']];
function proficiencyColor(v: number | null) {
  if (v == null) return '#f5f5f4';
  return PROF_STOPS.find(([max]) => v < max)?.[1] ?? '#243b5c';
}
function growthColor(v: number | null) {
  if (v == null) return '#f5f5f4';
  if (v >= 2) return '#243b5c';
  if (v >= 1) return '#4a6d8c';
  if (v > -1) return '#a8a29e';
  if (v > -2) return '#d4aa3c';
  return '#c53030';
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
  const [metric, setMetric] = useUrlState<Metric>('metric', 'proficiency', (r) => (r === 'proficiency' || r === 'growth' ? r : null));
  const [type, setType] = useUrlState<string>('type', '', parseString);
  const [countyId, setCountyId] = useUrlState<number | ''>('county', '', parseNumber, (v) => (v === '' ? '' : String(v)));

  useDocumentTitle('School map', `Every Pennsylvania public school on a map, colored by ${metric === 'growth' ? 'PVAAS growth' : 'proficiency'}.`);

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

  const shown = useMemo(() => points.filter((p) =>
    (!type || p.type === type) && (countyId === '' || p.countyId === countyId)
  ), [points, type, countyId]);
  const withValue = shown.filter((p) => (metric === 'growth' ? p.growth : p.proficiency) != null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">School Map</h1>
        <p className="mt-1 text-sm text-stone-500">
          Every school with a location, colored by {metric === 'growth' ? 'PVAAS growth index' : 'share of students proficient or above'} in {subject}. Grey dots have no result for this selection.
        </p>
      </div>

      <div className="card-surface p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <FilterSelect label="Color by" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="proficiency">Proficiency</option>
            <option value="growth">Growth</option>
          </FilterSelect>
          <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label="Exam" value={exam} onChange={(e) => { setExam(e.target.value as Exam); setSubject(SUBJECTS[e.target.value as Exam][0]); }}>
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
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="h-[60vh] min-h-[22rem]">
          <MapContainer center={PA_CENTER} zoom={7} preferCanvas scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {shown.map((p) => {
              const value = metric === 'growth' ? p.growth : p.proficiency;
              const color = metric === 'growth' ? growthColor(p.growth) : proficiencyColor(p.proficiency);
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={value == null ? 2.5 : 4.5}
                  pathOptions={{ color: value == null ? '#d6d3d1' : '#1b2a4a', weight: 0.6, fillColor: color, fillOpacity: value == null ? 0.5 : 0.9 }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <div className="text-xs">
                      <div className="font-semibold">{p.name}</div>
                      <div>{p.districtName}{p.type ? ` · ${p.type}` : ''}</div>
                      <div>{subject}: {formatPct(p.proficiency)}{p.growth != null ? ` · growth ${p.growth.toFixed(1)}` : ''}</div>
                      <div className="text-stone-500">Click a dot below the map to open the school</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <div className="px-4 sm:px-6 py-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-stone-700">{metric === 'growth' ? 'Growth index' : '% proficient or above'}</span>
            {(metric === 'growth'
              ? [['Well below', '#c53030'], ['Below', '#d4aa3c'], ['Meets', '#a8a29e'], ['Above', '#4a6d8c'], ['Well above', '#243b5c']]
              : [['<20', '#e7e5e4'], ['20-35', '#c9d6e3'], ['35-50', '#a8c3d8'], ['50-65', '#7a9bb5'], ['65-80', '#4a6d8c'], ['80+', '#243b5c']]
            ).map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />{label}</span>
            ))}
          </div>
          <span>{isLoading ? 'Loading…' : `${withValue.length.toLocaleString()} of ${shown.length.toLocaleString()} schools have a result`}</span>
        </div>
      </div>

      {shown.length > 0 && (
        <div className="card-surface mt-4 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900">Schools shown</h2>
            <p className="text-xs text-stone-400">Sorted by {metric}; open any school for its full results</p>
          </div>
          <ul className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
            {withValue
              .slice()
              .sort((a, b) => ((metric === 'growth' ? b.growth : b.proficiency) ?? -999) - ((metric === 'growth' ? a.growth : a.proficiency) ?? -999))
              .slice(0, 200)
              .map((p) => (
                <li key={p.id}>
                  <Link to={`/schools/${p.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 hover:bg-stone-50">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{p.name}</div>
                      <div className="text-xs text-stone-500 truncate">{p.districtName}</div>
                    </div>
                    <div className="text-sm tabular-nums text-stone-700 whitespace-nowrap">
                      {metric === 'growth' ? p.growth?.toFixed(1) : formatPct(p.proficiency)}
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
