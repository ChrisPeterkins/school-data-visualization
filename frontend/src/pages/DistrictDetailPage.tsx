import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { districtApi, performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import ResultsTable from '../components/ResultsTable';
import DataNotes from '../components/DataNotes';
import TrendCard from '../components/TrendCard';
import CohortChart from '../components/CohortChart';
import PrintButton from '../components/PrintButton';
import GapsPanel from '../components/GapsPanel';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PercentileBadges from '../components/PercentileBadges';
import ExportCsvButton from '../components/ExportCsvButton';
import { fillYearGaps, formatPct } from '../lib/chartUtils';

export default function DistrictDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { latest } = useAvailableYears();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: district, isLoading, error } = useQuery({
    queryKey: ['district', id],
    queryFn: () => districtApi.getDistrict(id!),
    enabled: !!id,
  });

  const districtId = district ? Number(district.id) : undefined;
  const dName = (district as any)?.name as string | undefined;
  useDocumentTitle(dName ?? null, dName ? `PSSA and Keystone results, trends, and achievement gaps for ${dName}, Pennsylvania.` : null);
  const trendQuery = (exam: 'pssa' | 'keystone', subject: string) => ({
    queryKey: ['summary', exam, 'district', districtId, subject],
    queryFn: () => performanceApi.getSummary({ exam, level: 'district', subject, districtId }),
    enabled: !!districtId,
  });
  const pssaMath = useQuery(trendQuery('pssa', 'Mathematics'));
  const pssaEla = useQuery(trendQuery('pssa', 'English Language Arts'));
  const pssaSci = useQuery(trendQuery('pssa', 'Science'));
  const keyAlg = useQuery(trendQuery('keystone', 'Algebra I'));
  const keyBio = useQuery(trendQuery('keystone', 'Biology'));
  const keyLit = useQuery(trendQuery('keystone', 'Literature'));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm text-stone-500">Loading district...</p>
      </div>
    );
  }
  if (error || !district) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-surface border-brick-200 bg-brick-50 p-6">
          <p className="text-brick-700 font-medium">District not found.</p>
          <Link to="/districts" className="mt-2 inline-block text-sm text-navy-600 hover:text-navy-800">&larr; Back to districts</Link>
        </div>
      </div>
    );
  }

  const d: any = district;
  const pssaRows: any[] = d.pssaResults ?? [];
  const keystoneRows: any[] = d.keystoneResults ?? [];
  const allYears: number[] = [...new Set([...pssaRows, ...keystoneRows].map((r) => r.year as number))].sort((a, b) => b - a);
  const activeYear = selectedYear != null && allYears.includes(selectedYear) ? selectedYear : allYears[0];
  const pssaForYear = pssaRows.filter((r) => r.year === activeYear);
  const keystoneForYear = keystoneRows.filter((r) => r.year === activeYear);

  const mergeSeries = (queries: Array<{ data?: { series: any[] } }>, subjects: string[]) => {
    const byYear: Record<number, any> = {};
    queries.forEach((q, i) => (q.data?.series ?? []).forEach((p) => {
      byYear[p.year] = byYear[p.year] ?? { year: p.year };
      byYear[p.year][subjects[i]] = p.proficiency;
    }));
    return fillYearGaps(Object.values(byYear).sort((a: any, b: any) => a.year - b.year) as any[]);
  };
  const pssaTrend = mergeSeries([pssaMath, pssaEla, pssaSci], ['Mathematics', 'English Language Arts', 'Science']);
  const keystoneTrend = mergeSeries([keyAlg, keyBio, keyLit], ['Algebra I', 'Biology', 'Literature']);
  const pssaYears = pssaTrend.filter((r: any) => Object.keys(r).length > 1).map((r) => r.year);

  const headline = pssaForYear.find((r) => r.grade === 0 && r.subject === 'Mathematics');
  const headlineEla = pssaForYear.find((r) => r.grade === 0 && r.subject === 'English Language Arts');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-400 mb-6 min-w-0" aria-label="Breadcrumb">
        <Link to="/districts" className="hover:text-navy-600 transition-colors">Districts</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <Link to={`/counties/${d.countyId}`} className="hover:text-navy-600 transition-colors">{d.countyName} County</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-stone-700 font-medium break-words">{d.name}</span>
      </nav>

      <div className="card-surface p-4 sm:p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 break-words">{d.name}</h1>
          <PrintButton />
        </div>
        <p className="text-sm text-stone-400 mt-0.5">AUN {d.aun} · {d.countyName} County{d.city ? ` · ${d.city}` : ''}</p>
        <div className="mt-3">
          <PercentileBadges entity="district" id={Number(d.id)} year={activeYear} exam={pssaForYear.length ? 'pssa' : 'keystone'} subject={pssaForYear.length ? 'Mathematics' : 'Algebra I'} />
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-stone-500">Schools</dt>
            <dd className="text-lg font-semibold text-stone-900">{(d.schools ?? []).length}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Enrollment</dt>
            <dd className="text-lg font-semibold text-stone-900">{d.totalEnrollment ? d.totalEnrollment.toLocaleString() : '—'}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Math proficient{activeYear ? `, ${activeYear}` : ''}</dt>
            <dd className="text-lg font-semibold text-navy-700">{formatPct(headline?.percentProficientOrAbove)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">ELA proficient{activeYear ? `, ${activeYear}` : ''}</dt>
            <dd className="text-lg font-semibold text-navy-700">{formatPct(headlineEla?.percentProficientOrAbove)}</dd>
          </div>
        </dl>
      </div>

      {allYears.length > 0 && (
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-sm font-medium text-stone-600">Assessment Year</span>
          <div className="flex flex-wrap gap-1.5">
            {allYears.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                aria-pressed={activeYear === year}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeYear === year ? 'bg-navy-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {pssaForYear.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-stone-900">PSSA Results <span className="text-sm font-normal text-stone-400">({activeYear})</span></h2>
            <ExportCsvButton filename={`${d.name}-pssa-${activeYear}`} rows={pssaForYear} />
          </div>
          <ResultsTable results={pssaForYear} showGrade compact />
        </div>
      )}
      {keystoneForYear.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-stone-900 mb-3">Keystone Exam Results <span className="text-sm font-normal text-stone-400">({activeYear})</span></h2>
          <ResultsTable results={keystoneForYear} showGrade={false} compact />
        </div>
      )}

      <div className="mb-8 space-y-6">
        <h2 className="text-lg font-bold text-stone-900">Trends</h2>
        <DataNotes exam="pssa" years={pssaYears} latestAvailable={latest} subject={pssaSci.data?.series?.length ? 'Science' : undefined} />
        <TrendCard title="PSSA proficient or above" data={pssaTrend} series={['Mathematics', 'English Language Arts', 'Science']} years={pssaYears} exam="pssa" />
        <TrendCard title="Keystone proficient or above" data={keystoneTrend} series={['Algebra I', 'Biology', 'Literature']} years={keystoneTrend.filter((r: any) => Object.keys(r).length > 1).map((r) => r.year)} exam="keystone" />
        {pssaRows.some((r) => r.grade && r.grade > 0) && <CohortChart rows={pssaRows} entityName={d.name} />}
      </div>

      <div className="mb-8 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Achievement gaps</h2>
        <GapsPanel level="district" districtId={Number(d.id)} year={activeYear} exams={[...(pssaRows.length ? ['pssa'] : []), ...(keystoneRows.length ? ['keystone'] : [])] as Array<'pssa' | 'keystone'>} />
      </div>

      {(d.schools ?? []).length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-stone-900 mb-3">Schools</h2>
          <div className="card-surface overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {d.schools.map((s: any) => (
                <li key={s.id}>
                  <Link to={`/schools/${s.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-stone-50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900">{s.name}</div>
                      <div className="text-xs text-stone-500">{[s.schoolType, s.city].filter(Boolean).join(' · ')}</div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-stone-300 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
