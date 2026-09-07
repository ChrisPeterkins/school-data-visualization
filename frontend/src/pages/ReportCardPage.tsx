import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, districtApi, countyApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSummaryBundle, seriesFor } from '../hooks/useSummaryBundle';
import { formatPct, fillYearGaps } from '../lib/chartUtils';
import IndicatorsPanel from '../components/IndicatorsPanel';
import GapsPanel from '../components/GapsPanel';
import TrendCard from '../components/TrendCard';
import ResultsTable from '../components/ResultsTable';
import { useT } from '../i18n';

/**
 * One-page report card for a school or district: headline figures, the
 * non-assessment indicators, gaps, and the trend, laid out for print.
 */
export default function ReportCardPage({ entity }: { entity: 'school' | 'district' | 'county' | 'state' }) {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { data: school } = useQuery({ queryKey: ['school', id], queryFn: () => schoolApi.getSchool(id!), enabled: entity === 'school' && !!id });
  const { data: district } = useQuery({ queryKey: ['district', id], queryFn: () => districtApi.getDistrict(id!), enabled: entity === 'district' && !!id });
  const { data: county } = useQuery({ queryKey: ['county', id], queryFn: () => countyApi.getCounty(id!), enabled: entity === 'county' && !!id });
  const ent: any = entity === 'school' ? school : entity === 'district' ? district : entity === 'county' ? (county ? { ...county, name: `${county.name} County` } : undefined) : { name: 'Pennsylvania' };
  const bundle = useSummaryBundle(entity, id ? Number(id) : undefined);
  useDocumentTitle(ent ? `${ent.name} · ${t('report.title')}` : null, ent ? `One-page report card for ${ent.name}.` : null);
  useEffect(() => { if (ent && new URLSearchParams(window.location.search).get('print') === '1') setTimeout(() => window.print(), 800); }, [ent]);
  if (!ent) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-stone-500 dark:text-stone-400">{t('common.loading')}</div>;

  const pssa = (ent.pssaResults ?? []) as any[]; const keystone = (ent.keystoneResults ?? []) as any[];
  const latestYear = Math.max(0, ...[...pssa, ...keystone].map((r) => r.year));
  const totals = pssa.filter((r) => r.year === latestYear && r.grade === 0 && (r.demographicGroup ?? 'All Students') === 'All Students');
  const keys = keystone.filter((r) => r.year === latestYear && (r.demographicGroup ?? 'All Students') === 'All Students');
  // County and state pages carry no result rows; their headline comes from the bundle's latest year.
  const bundleLatest = Math.max(0, ...Object.values(bundle.data?.pssa ?? {}).flat().map((p) => p.year));
  const bundleHeadline = Object.entries(bundle.data?.pssa ?? {}).map(([subject, pts]) => { const p = pts.find((x) => x.year === bundleLatest); return p ? { subject, value: p.proficiency, tested: p.tested } : null; }).filter((h): h is { subject: string; value: number | null; tested: number } => !!h);
  const headline = totals.length || keys.length ? (totals.length ? totals : keys).map((r) => ({ subject: r.subject, value: r.percentProficientOrAbove, tested: r.numberScored })) : bundleHeadline;
  const headlineYear = latestYear || bundleLatest;
  const pssaTrend = fillYearGaps(seriesFor(bundle.data, 'pssa', ['Mathematics', 'English Language Arts', 'Science']));
  const years = pssaTrend.filter((r: any) => Object.keys(r).length > 1).map((r: any) => r.year);
  const back = entity === 'school' ? `/schools/${id}` : entity === 'district' ? `/districts/${id}` : entity === 'county' ? `/counties/${id}` : '/state';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-2 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link to={back} className="text-sm text-navy-600 dark:text-navy-300 hover:text-navy-800 dark:hover:text-navy-100 dark:text-navy-200">← {ent.name}</Link>
        <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-navy-700 text-white text-sm font-medium hover:bg-navy-600">{t('common.print')}</button>
      </div>
      <header className="border-b-2 border-navy-800 pb-3">
        <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">{t('report.title')} · PA School Data</p>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{ent.name}</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">{entity === 'school' ? `${ent.districtName} · ${ent.countyName} County${ent.type ? ` · ${ent.type}` : ''}` : entity === 'district' ? `${ent.countyName} County${ent.districtType && ent.districtType !== 'Public' ? ` · ${ent.districtType}` : ''}` : entity === 'county' ? `${ent.districtCount ?? ent.totalDistricts ?? ''} ${t('nav.districts').toLowerCase()}`.trim() : t('nav.state')}{ent.enrollment || ent.totalEnrollment ? ` · ${(ent.enrollment ?? ent.totalEnrollment).toLocaleString()} ${t('common.students')}` : ''}</p>
      </header>
      {headline.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-2">{t('report.headline', { year: headlineYear })}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {headline.map((h) => (
              <div key={h.subject} className="card-surface p-3"><div className="text-xs text-stone-500 dark:text-stone-400">{h.subject}</div><div className="text-2xl font-bold text-navy-900 dark:text-stone-100 tabular-nums">{formatPct(h.value)}</div><div className="text-[11px] text-stone-500 dark:text-stone-400">{h.tested?.toLocaleString() ?? '—'} {t('results.tested').toLowerCase()}</div></div>
            ))}
          </div>
        </section>
      )}
      {entity !== 'county' && <IndicatorsPanel entity={entity} id={entity === 'state' ? undefined : Number(id)} />}
      {years.length > 1 && <TrendCard title={t('report.trend')} data={pssaTrend} series={['Mathematics', 'English Language Arts', 'Science']} years={years} exam="pssa" height={260} />}
      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t('state.gaps').replace(/, .*$/, '')}</h2>
        <GapsPanel level={entity === 'school' ? 'school' : entity === 'state' ? 'state' : 'district'} {...(entity === 'school' ? { schoolId: Number(id) } : entity === 'district' ? { districtId: Number(id) } : entity === 'county' ? { countyId: Number(id) } : {})} year={headlineYear || undefined} exams={entity === 'school' || entity === 'district' ? ([...(pssa.length ? ['pssa'] : []), ...(keystone.length ? ['keystone'] : [])] as Array<'pssa' | 'keystone'>) : ['pssa', 'keystone']} />
      </section>
      {totals.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-2">{t('common.pssa')} {latestYear}</h2>
          <ResultsTable results={pssa.filter((r) => r.year === latestYear && (r.demographicGroup ?? 'All Students') === 'All Students')} showGrade compact={entity === 'district'} />
        </section>
      )}
      <footer className="text-[11px] text-stone-500 dark:text-stone-400 border-t border-stone-200 dark:border-stone-700 pt-2">{t('report.footer', { date: new Date().toLocaleDateString() })} chrispeterkins.com/paschools{back}</footer>
    </div>
  );
}
