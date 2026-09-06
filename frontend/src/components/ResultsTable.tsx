import { gradeLabel, growthBand, formatPct } from '../lib/chartUtils';
import { useT } from '../i18n';

/** Fields the table reads; the API's ResultRow (shared) satisfies it. */
export interface ResultRow {
  grade?: number | null;
  subject: string;
  numberScored?: number | null;
  percentAdvanced?: number | null;
  percentProficient?: number | null;
  percentBasic?: number | null;
  percentBelowBasic?: number | null;
  percentProficientOrAbove?: number | null;
  growthScore?: number | null;
}

interface ResultsTableProps {
  results: ResultRow[];
  showGrade: boolean;
  /** District rows carry no level breakdown, so hide those columns. */
  compact?: boolean;
}

const proficiencyClass = (value: number | null | undefined) => {
  if (value == null) return 'text-stone-500';
  if (value >= 70) return 'text-navy-800 font-semibold';
  if (value >= 50) return 'text-navy-600 font-semibold';
  return 'text-stone-700 font-semibold';
};

/**
 * Results for one year. The all-grades total (grade 0) sorts last and reads
 * "All grades"; the four level columns only show from md and never in compact
 * mode. Growth is the PVAAS growth index with PDE's band label.
 */
export default function ResultsTable({ results, showGrade, compact = false }: ResultsTableProps) {
  const order = (g: number | null | undefined) => (g == null || g === 0 ? 99 : g);
  const rows = [...results].sort((a, b) => order(a.grade) - order(b.grade) || a.subject.localeCompare(b.subject));
  const hasGrowth = rows.some((r) => r.growthScore != null);
  const t = useT();
  const th = 'py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="card-surface overflow-hidden">
      {/* Phones: one card per row so nothing scrolls sideways. */}
      <ul className="sm:hidden divide-y divide-stone-100" data-testid="results-cards">
        {rows.map((r, idx) => {
          const total = r.grade === 0;
          const band = growthBand(r.growthScore);
          return (
            <li key={idx} className={`px-4 py-3 ${total ? 'bg-stone-50/60' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{r.subject}</div>
                  {showGrade && <div className="text-xs text-stone-500">{gradeLabel(r.grade)}</div>}
                </div>
                <div className={`text-lg tabular-nums ${proficiencyClass(r.percentProficientOrAbove)}`}>{formatPct(r.percentProficientOrAbove)}</div>
              </div>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500">
                <div className="flex gap-1"><dt>{t('results.tested')}</dt><dd className="tabular-nums text-stone-700">{r.numberScored ? r.numberScored.toLocaleString() : 'N/A'}</dd></div>
                {!compact && r.percentAdvanced != null && (
                  <div className="flex gap-1"><dt>{t('results.advanced').replace('% ', '')}</dt><dd className="tabular-nums text-stone-700">{formatPct(r.percentAdvanced)}</dd></div>
                )}
                {!compact && r.percentBelowBasic != null && (
                  <div className="flex gap-1"><dt>{t('results.belowBasic').replace('% ', '')}</dt><dd className="tabular-nums text-stone-700">{formatPct(r.percentBelowBasic)}</dd></div>
                )}
                {hasGrowth && (
                  <div className="flex gap-1"><dt>{t('results.growth')}</dt><dd className={`tabular-nums ${band.className}`}>{r.growthScore == null ? '—' : `${r.growthScore.toFixed(1)} · ${band.label}`}</dd></div>
                )}
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-200">
              {showGrade && <th className={`px-3 sm:px-5 text-left ${th}`}>{t('results.grade')}</th>}
              <th className={`px-3 sm:px-5 text-left ${th}`}>{t('results.subject')}</th>
              <th className={`px-3 sm:px-5 text-right ${th}`}>{t('results.tested')}</th>
              {!compact && (
                <>
                  <th className={`hidden md:table-cell px-5 text-right ${th}`}>{t('results.advanced')}</th>
                  <th className={`hidden md:table-cell px-5 text-right ${th}`}>{t('results.proficient')}</th>
                  <th className={`hidden md:table-cell px-5 text-right ${th}`}>{t('results.basic')}</th>
                  <th className={`hidden md:table-cell px-5 text-right ${th}`}>{t('results.belowBasic')}</th>
                </>
              )}
              <th className={`px-3 sm:px-5 text-right ${th}`}>{t('results.profPlus')}</th>
              {hasGrowth && <th className={`px-3 sm:px-5 text-right ${th}`}>{t('results.growth')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r, idx) => {
              const total = r.grade === 0;
              const band = growthBand(r.growthScore);
              return (
                <tr key={idx} className={`transition-colors ${total ? 'bg-stone-50/60 font-medium' : 'hover:bg-stone-50/50'}`}>
                  {showGrade && <td className="px-3 sm:px-5 py-3 text-sm text-stone-700 whitespace-nowrap">{gradeLabel(r.grade)}</td>}
                  <td className="px-3 sm:px-5 py-3 text-sm font-medium text-stone-900">{r.subject}</td>
                  <td className="px-3 sm:px-5 py-3 text-sm text-stone-600 text-right tabular-nums">{r.numberScored ? r.numberScored.toLocaleString() : 'N/A'}</td>
                  {!compact && (
                    <>
                      <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{formatPct(r.percentAdvanced)}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{formatPct(r.percentProficient)}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{formatPct(r.percentBasic)}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-sm text-right text-stone-600">{formatPct(r.percentBelowBasic)}</td>
                    </>
                  )}
                  <td className={`px-3 sm:px-5 py-3 text-sm text-right tabular-nums ${proficiencyClass(r.percentProficientOrAbove)}`}>{formatPct(r.percentProficientOrAbove)}</td>
                  {hasGrowth && (
                    <td className={`px-3 sm:px-5 py-3 text-sm text-right whitespace-nowrap ${band.className}`} title="PVAAS growth index">
                      {r.growthScore == null ? '—' : `${r.growthScore.toFixed(1)} · ${band.label}`}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasGrowth && (
        <p className="px-3 sm:px-5 py-2 text-xs text-stone-500 border-t border-stone-100">
          {t('results.note')}
        </p>
      )}
    </div>
  );
}
