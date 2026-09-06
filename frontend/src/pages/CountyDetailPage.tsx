import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { countyApi, performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import GapsPanel from '../components/GapsPanel';
import DataNotes from '../components/DataNotes';
import CountyMapInset from '../components/CountyMapInset';
import TrendCard from '../components/TrendCard';
import { fillYearGaps, formatPct } from '../lib/chartUtils';

export default function CountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { latest } = useAvailableYears();

  const { data: county, isLoading, error } = useQuery({ queryKey: ['county', id], queryFn: () => countyApi.getCounty(id!), enabled: !!id });
  const countyId = county?.id;
  useDocumentTitle(county ? `${county.name} County` : null, county ? `PSSA and Keystone results, trends, and achievement gaps for ${county.name} County, Pennsylvania.` : null);

  const trend = (exam: 'pssa' | 'keystone', subject: string) => ({
    queryKey: ['summary', exam, 'district', 'county', countyId, subject],
    queryFn: () => performanceApi.getSummary({ exam, level: 'district', subject, countyId }),
    enabled: !!countyId,
  });
  const pssaMath = useQuery(trend('pssa', 'Mathematics'));
  const pssaEla = useQuery(trend('pssa', 'English Language Arts'));
  const pssaSci = useQuery(trend('pssa', 'Science'));
  const keyAlg = useQuery(trend('keystone', 'Algebra I'));
  const keyBio = useQuery(trend('keystone', 'Biology'));
  const keyLit = useQuery(trend('keystone', 'Literature'));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !county) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-surface border-brick-200 bg-brick-50 p-6">
          <p className="text-brick-700 font-medium">County not found.</p>
          <Link to="/counties" className="mt-2 inline-block text-sm text-navy-600 hover:text-navy-800">&larr; Back to counties</Link>
        </div>
      </div>
    );
  }

  const merge = (queries: Array<{ data?: { series: any[] } }>, subjects: string[]) => {
    const byYear: Record<number, any> = {};
    queries.forEach((q, i) => (q.data?.series ?? []).forEach((p) => {
      byYear[p.year] = byYear[p.year] ?? { year: p.year };
      byYear[p.year][subjects[i]] = p.proficiency;
    }));
    return fillYearGaps(Object.values(byYear).sort((a: any, b: any) => a.year - b.year) as any[]);
  };
  const pssaTrend = merge([pssaMath, pssaEla, pssaSci], ['Mathematics', 'English Language Arts', 'Science']);
  const keystoneTrend = merge([keyAlg, keyBio, keyLit], ['Algebra I', 'Biology', 'Literature']);
  const pssaYears = pssaTrend.filter((r: any) => Object.keys(r).length > 1).map((r) => r.year);
  const latestMath = (pssaMath.data?.series ?? []).slice(-1)[0];
  const latestEla = (pssaEla.data?.series ?? []).slice(-1)[0];
  const enrollment = county.districts.reduce((s, d) => s + (d.enrollment ?? 0), 0);
  const schoolCount = county.districts.reduce((s, d) => s + d.schoolCount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-500 mb-6" aria-label="Breadcrumb">
        <Link to="/counties" className="hover:text-navy-600 transition-colors">Counties</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-stone-700 font-medium">{county.name} County</span>
      </nav>

      <div className="card-surface p-4 sm:p-6 mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900">{county.name} County</h1>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-stone-500">Districts</dt><dd className="text-lg font-semibold text-stone-900">{county.districts.length}</dd></div>
          <div><dt className="text-stone-500">Schools</dt><dd className="text-lg font-semibold text-stone-900">{schoolCount}</dd></div>
          <div><dt className="text-stone-500">Math proficient{latestMath ? `, ${latestMath.year}` : ''}</dt><dd className="text-lg font-semibold text-navy-700">{formatPct(latestMath?.proficiency)}</dd></div>
          <div><dt className="text-stone-500">ELA proficient{latestEla ? `, ${latestEla.year}` : ''}</dt><dd className="text-lg font-semibold text-navy-700">{formatPct(latestEla?.proficiency)}</dd></div>
        </dl>
        {enrollment > 0 && <p className="mt-3 text-sm text-stone-500">{enrollment.toLocaleString()} students enrolled across the county's districts</p>}
      </div>

      <div className="mb-8">
        <CountyMapInset countyId={Number(county.id)} />
      </div>

      <div className="mb-8 space-y-6">
        <h2 className="text-lg font-bold text-stone-900">Trends</h2>
        <DataNotes exam="pssa" years={pssaYears} latestAvailable={latest} subject={pssaSci.data?.series?.length ? 'Science' : undefined} />
        <TrendCard title="PSSA proficient or above" subtitle="All districts in the county, weighted by students tested" data={pssaTrend} series={['Mathematics', 'English Language Arts', 'Science']} years={pssaYears} exam="pssa" />
        <TrendCard title="Keystone proficient or above" subtitle="All districts in the county, weighted by students tested" data={keystoneTrend} series={['Algebra I', 'Biology', 'Literature']} years={keystoneTrend.filter((r: any) => Object.keys(r).length > 1).map((r) => r.year)} exam="keystone" />
      </div>

      <div className="mb-8 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Achievement gaps</h2>
        <GapsPanel level="district" countyId={county.id} />
      </div>

      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-3">Districts</h2>
        <div className="card-surface overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {county.districts.map((d) => (
              <li key={d.id}>
                <Link to={`/districts/${d.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-stone-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-900">{d.name}</div>
                    <div className="text-xs text-stone-500">{d.schoolCount} {d.schoolCount === 1 ? 'school' : 'schools'}{d.enrollment ? ` · ${d.enrollment.toLocaleString()} students` : ''}{d.city ? ` · ${d.city}` : ''}</div>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
