import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, districtApi } from '../services/api';
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
export default function ReportCardPage({ entity }: { entity: 'school' | 'district' }) {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { data: school } = useQuery({ queryKey: ['school', id], queryFn: () => schoolApi.getSchool(id!), enabled: entity === 'school' && !!id });
  const { data: district } = useQuery({ queryKey: ['district', id], queryFn: () => districtApi.getDistrict(id!), enabled: entity === 'district' && !!id });
  const ent: any = entity === 'school' ? school : district;
  const bundle = useSummaryBundle(entity, id ? Number(id) : undefined);
  useDocumentTitle(ent ? `${ent.name} · ${t('report.title')}` : null, ent ? `One-page report card for ${ent.name}.` : null);
  useEffect(() => { if (ent && new URLSearchParams(window.location.search).get('print') === '1') setTimeout(() => window.print(), 800); }, [ent]);
  if (!ent) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-sm text-stone-500">{t('common.loading')}</div>;

  const pssa = (ent.pssaResults ?? []) as any[]; const keystone = (ent.keystoneResults ?? []) as any[];
  const latestYear = Math.max(0, ...[...pssa, ...keystone].map((r) => r.year));
  const totals = pssa.filter((r) => r.year === latestYear && r.grade === 0 && (r.demographicGroup ?? 'All Students') === 'All Students');
  const keys = keystone.filter((r) => r.year === latestYear && (r.demographicGroup ?? 'All Students') === 'All Students');
  const headline = (totals.length ? totals : keys).map((r) => ({ subject: r.subject, value: r.percentProficientOrAbove, tested: r.numberScored }));
  const pssaTrend = fillYearGaps(seriesFor(bundle.data, 'pssa', ['Mathematics', 'English Language Arts', 'Science']));
  const years = pssaTrend.filter((r: any) => Object.keys(r).length > 1).map((r: any) => r.year);
  const back = entity === 'school' ? `/schools/${id}` : `/districts/${id}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-2 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link to={back} className="text-sm text-navy-600 hover:text-navy-800">← {ent.name}</Link>
        <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-navy-700 text-white text-sm font-medium hover:bg-navy-600">{t('common.print')}</button>
      </div>
      <header className="border-b-2 border-navy-800 pb-3">
        <p className="text-xs uppercase tracking-wide text-stone-500">{t('report.title')} · PA School Data</p>
        <h1 className="text-2xl font-bold text-stone-900">{ent.name}</h1>
        <p className="text-sm text-stone-600">{entity === 'school' ? `${ent.districtName} · ${ent.countyName} County${ent.type ? ` · ${ent.type}` : ''}` : `${ent.countyName} County${ent.districtType && ent.districtType !== 'Public' ? ` · ${ent.districtType}` : ''}`}{ent.enrollment || ent.totalEnrollment ? ` · ${(ent.enrollment ?? ent.totalEnrollment).toLocaleString()} ${t('common.students')}` : ''}</p>
      </header>
      {headline.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">{t('report.headline', { year: latestYear })}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {headline.map((h) => (
              <div key={h.subject} className="card-surface p-3"><div className="text-xs text-stone-500">{h.subject}</div><div className="text-2xl font-bold text-navy-900 tabular-nums">{formatPct(h.value)}</div><div className="text-[11px] text-stone-500">{h.tested?.toLocaleString() ?? '—'} {t('results.tested').toLowerCase()}</div></div>
            ))}
          </div>
        </section>
      )}
      <IndicatorsPanel entity={entity} id={Number(id)} />
      {years.length > 1 && <TrendCard title={t('report.trend')} data={pssaTrend} series={['Mathematics', 'English Language Arts', 'Science']} years={years} exam="pssa" height={260} />}
      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-base font-semibold text-stone-900">{t('state.gaps').replace(/, .*$/, '')}</h2>
        <GapsPanel level={entity} {...(entity === 'school' ? { schoolId: Number(id) } : { districtId: Number(id) })} year={latestYear || undefined} exams={[...(pssa.length ? ['pssa'] : []), ...(keystone.length ? ['keystone'] : [])] as Array<'pssa' | 'keystone'>} />
      </section>
      {totals.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="text-base font-semibold text-stone-900 mb-2">{t('common.pssa')} {latestYear}</h2>
          <ResultsTable results={pssa.filter((r) => r.year === latestYear && (r.demographicGroup ?? 'All Students') === 'All Students')} showGrade compact={entity === 'district'} />
        </section>
      )}
      <footer className="text-[11px] text-stone-500 border-t border-stone-200 pt-2">{t('report.footer', { date: new Date().toLocaleDateString() })} chrispeterkins.com/paschools{back}</footer>
    </div>
  );
}
