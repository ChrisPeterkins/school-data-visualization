import type { ResultRow } from '@shared';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, MapPinIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { schoolApi, performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import PerformanceChart from '../components/PerformanceChart';
import ResultsTable from '../components/ResultsTable';
import IndicatorsPanel from '../components/IndicatorsPanel';
import PinButton from '../components/PinButton';
import ShareButton from '../components/ShareButton';
import SchoolMap from '../components/SchoolMap';
import DataNotes from '../components/DataNotes';
import GapsPanel from '../components/GapsPanel';
import SimilarSchools from '../components/SimilarSchools';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import PercentileBadges from '../components/PercentileBadges';
import ExportCsvButton from '../components/ExportCsvButton';
import PrintButton from '../components/PrintButton';
import CohortChart from '../components/CohortChart';
import { formatPct, growthBand } from '../lib/chartUtils';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { latest } = useAvailableYears();
  // null = "latest year this school has data for"; set once the user picks a year.
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: school, isLoading: schoolLoading, error: schoolError } = useQuery({
    queryKey: ['school', id],
    queryFn: () => schoolApi.getSchool(id!),
    enabled: !!id,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', id],
    queryFn: () => performanceApi.getTrends(id!),
    enabled: !!id,
  });
  useDocumentTitle(school?.name ?? null, school ? `PSSA and Keystone results, growth, and trends for ${school.name} (${school.districtName}), Pennsylvania.` : null);

  if (schoolLoading || trendsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm text-stone-500">Loading school details...</p>
      </div>
    );
  }

  if (schoolError || !school) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-surface border-brick-200 bg-brick-50 p-6">
          <p className="text-brick-700 font-medium">School not found.</p>
          <Link to="/schools" className="mt-2 inline-block text-sm text-navy-600 hover:text-navy-800">
            &larr; Back to schools list
          </Link>
        </div>
      </div>
    );
  }

  const s = school;
  const pssaResults: ResultRow[] = s.pssaResults || [];
  const keystoneResults: ResultRow[] = s.keystoneResults || [];
  const allYears: number[] = [...new Set([...pssaResults, ...keystoneResults].map((r) => r.year as number))].sort((a, b) => b - a);
  const activeYear = selectedYear != null && allYears.includes(selectedYear) ? selectedYear : allYears[0];
  const selectedPssa = pssaResults.filter((r) => r.year === activeYear);
  const selectedKeystone = keystoneResults.filter((r) => r.year === activeYear);

  // Headline: the all-grades totals for the active year, or Keystone for high schools.
  const headline = (subject: string) =>
    selectedPssa.find((r) => r.grade === 0 && r.subject === subject) ?? selectedKeystone.find((r) => r.subject === subject);
  const math = headline('Mathematics') ?? headline('Algebra I');
  const ela = headline('English Language Arts') ?? headline('Literature');
  const growthValues = [...selectedPssa.filter((r) => r.grade === 0), ...selectedKeystone].map((r) => r.growthScore).filter((g): g is number => g != null);
  const growth = growthValues.length ? growthValues.reduce((a, b) => a + b, 0) / growthValues.length : null;
  const band = growthBand(growth);
  const hasMap = typeof s.latitude === 'number' && typeof s.longitude === 'number';
  const pssaYears = [...new Set(pssaResults.map((r) => r.year as number))];
  const location = [s.address, s.city ? `${s.city}, PA${s.zipCode ? ` ${s.zipCode}` : ''}` : null].filter(Boolean).join(', ');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-stone-500 mb-6 min-w-0" aria-label="Breadcrumb">
        <Link to="/schools" className="hover:text-navy-600 transition-colors">Schools</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{s.countyName}</span>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <Link to={`/districts/${s.districtId}`} className="hover:text-navy-600 transition-colors">{s.districtName}</Link>
        <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-stone-700 font-medium break-words">{s.name}</span>
      </nav>

      <p className="print-only text-xs text-stone-500 mb-2">PA School Data · chrispeterkins.com/paschools · printed {new Date().toLocaleDateString()}</p>
      <div className="card-surface p-4 sm:p-6 mb-8">
        <div className={`grid grid-cols-1 gap-4 ${hasMap ? 'sm:grid-cols-[1fr_16rem]' : ''}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 break-words">{s.name}</h1>
              <PinButton pin={{ kind: 'school', id: Number(s.id), name: s.name, detail: s.districtName }} />
              <ShareButton title={`${s.name} · PA School Data`} />
              <PrintButton />
            </div>
            <p className="text-sm text-stone-500 mt-0.5">
              School #{s.schoolNumber}
              {s.gradeRange ? ` · Grades ${s.gradeRange}` : ''}
              {s.isCharter ? ' · Charter' : ''}
            </p>

            <div className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="w-4 h-4 text-stone-500 flex-shrink-0" />
                <Link to={`/districts/${s.districtId}`} className="text-stone-600 hover:text-navy-600">
                  {s.districtName}
                  <span className="text-stone-500 ml-1 text-xs">(AUN {s.districtAun})</span>
                </Link>
              </div>
              {location && (
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-stone-500 flex-shrink-0" />
                  <span className="text-stone-600">{location}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {s.type && <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-navy-100 text-navy-700">{s.type}</span>}
                <span className="text-stone-500">{s.countyName} County</span>
                {s.enrollment ? <span className="text-stone-500">· {s.enrollment.toLocaleString()} students</span> : null}
              </div>
            </div>

            <div className="mt-4">
              <PercentileBadges
                entity="school"
                id={Number(s.id)}
                year={activeYear}
                exam={selectedPssa.length ? 'pssa' : 'keystone'}
                subject={selectedPssa.length ? 'Mathematics' : 'Algebra I'}
              />
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-3 sm:gap-4 text-sm">
              <div>
                <dt className="text-stone-500 truncate">{math?.subject === 'Algebra I' ? 'Algebra I' : 'Math'}{activeYear ? `, ${activeYear}` : ''}</dt>
                <dd className="text-lg font-semibold text-navy-700">{formatPct(math?.percentProficientOrAbove)}</dd>
              </div>
              <div>
                <dt className="text-stone-500 truncate">{ela?.subject === 'Literature' ? 'Literature' : 'ELA'}{activeYear ? `, ${activeYear}` : ''}</dt>
                <dd className="text-lg font-semibold text-navy-700">{formatPct(ela?.percentProficientOrAbove)}</dd>
              </div>
              <div>
                <dt className="text-stone-500 truncate">Growth{activeYear ? `, ${activeYear}` : ''}</dt>
                <dd className={`text-lg ${band.className}`} title="PVAAS growth index, averaged across subjects">{growth == null ? '—' : `${growth.toFixed(1)} · ${band.label}`}</dd>
              </div>
            </dl>
          </div>
          {hasMap && <SchoolMap latitude={s.latitude!} longitude={s.longitude!} name={s.name} />}
        </div>
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

      {selectedPssa.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              PSSA Results
              <span className="text-sm font-normal text-stone-500">({activeYear})</span>
            </h2>
            <ExportCsvButton filename={`${s.name}-pssa-${activeYear}`} rows={selectedPssa} />
          </div>
          <ResultsTable results={selectedPssa} showGrade />
        </div>
      )}

      {selectedKeystone.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              Keystone Exam Results
              <span className="text-sm font-normal text-stone-500">({activeYear})</span>
            </h2>
            <ExportCsvButton filename={`${s.name}-keystone-${activeYear}`} rows={selectedKeystone} />
          </div>
          <ResultsTable results={selectedKeystone} showGrade={false} />
        </div>
      )}

      <div className="mb-8">
        <IndicatorsPanel entity="school" id={Number(s.id)} />
      </div>

      <div className="mb-8 space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Achievement gaps</h2>
        <GapsPanel
          level="school"
          schoolId={Number(s.id)}
          year={activeYear}
          exams={[...(pssaResults.length ? ['pssa'] : []), ...(keystoneResults.length ? ['keystone'] : [])] as Array<'pssa' | 'keystone'>}
        />
      </div>

      <div className="mb-8">
        <SimilarSchools schoolId={Number(s.id)} schoolName={s.name} />
      </div>

      {pssaResults.some((r) => r.grade && r.grade > 0) && (
        <div className="mb-8 space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Cohorts</h2>
          <CohortChart rows={pssaResults} entityName={s.name} />
        </div>
      )}

      {trends && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900">Historical Performance Trends</h2>
          <DataNotes exam="pssa" years={pssaYears} latestAvailable={latest} subject={pssaResults.some((r) => r.subject === 'Science') ? 'Science' : undefined} />
          <PerformanceChart data={trends} />
        </div>
      )}
    </div>
  );
}
