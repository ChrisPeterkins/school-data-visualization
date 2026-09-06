import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { XMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { performanceApi, type FigureEntity } from '../services/api';
import { usePins, lastSeenImport, markImportSeen } from '../lib/watchlist';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { formatPct } from '../lib/chartUtils';
import { useT } from '../i18n';

/**
 * Home-page card for the visitor's pinned schools and districts: the latest
 * Math and ELA proficiency with the change from the prior year, and a notice
 * when data has been imported since they last looked.
 */
export default function WatchlistPanel() {
  const t = useT();
  const { pins, remove } = usePins();
  const { latest, pssaYears, lastImportAt } = useAvailableYears();
  const years = pssaYears ?? [];
  const prev = latest ? years.filter((y) => y < latest).sort((a, b) => b - a)[0] : undefined;
  const seen = lastSeenImport();
  const isNew = !!(lastImportAt && seen && seen !== lastImportAt);
  useEffect(() => { if (lastImportAt && !seen) markImportSeen(lastImportAt); }, [lastImportAt, seen]);

  // One request per kind × exam × year; high schools have Keystone rather than PSSA figures.
  const kinds = ['school', 'district'] as const;
  const exams = ['pssa', 'keystone'] as const;
  const yearsWanted = [latest, prev].filter((y): y is number => y != null);
  const specs = kinds.flatMap((kind) => {
    const ids = pins.filter((p) => p.kind === kind).map((p) => p.id);
    if (!ids.length || !latest) return [];
    return exams.flatMap((exam) => yearsWanted.map((year) => ({ kind, exam, year, ids })));
  });
  const queries = useQueries({
    queries: specs.map((sp) => ({
      queryKey: ['figures', sp.kind, sp.exam, sp.ids, sp.year],
      queryFn: () => performanceApi.getFigures({ entity: sp.kind, ids: sp.ids, year: sp.year, exam: sp.exam }),
      staleTime: 60 * 60 * 1000,
    })),
  });
  if (pins.length === 0) return null;

  const lookup = (kind: string, exam: string, year: number | undefined, id: number): FigureEntity | undefined => {
    const i = specs.findIndex((sp) => sp.kind === kind && sp.exam === exam && sp.year === year);
    return i < 0 ? undefined : (queries[i]?.data ?? []).find((e) => e.id === id);
  };
  const SUBJECTS_BY_EXAM: Record<string, Array<[string, string]>> = { pssa: [['Mathematics', 'Math'], ['English Language Arts', 'ELA']], keystone: [['Algebra I', 'Alg I'], ['Literature', 'Lit']] };

  return (
    <section className="card-surface p-5 sm:p-6" aria-labelledby="watchlist-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="watchlist-heading" className="text-lg font-semibold text-stone-900 inline-flex items-center gap-2"><BookmarkIcon className="w-5 h-5 text-gold-600" />{t('pin.title')}</h3>
        <p className="text-xs text-stone-500">{isNew ? <span className="text-teal-700 font-medium">{t('pin.newData')}</span> : t('pin.sub', { year: latest ?? '' })}</p>
      </div>
      <ul className="mt-3 divide-y divide-stone-100">
        {pins.map((p) => {
          const pssaCur = lookup(p.kind, 'pssa', latest ?? undefined, p.id);
          const exam = pssaCur && Object.values(pssaCur.subjects).some((s) => s.proficiency != null) ? 'pssa' : 'keystone';
          const cur = lookup(p.kind, exam, latest ?? undefined, p.id), old = lookup(p.kind, exam, prev, p.id);
          return (
            <li key={`${p.kind}-${p.id}`} className="py-2 flex items-center gap-3">
              <Link to={`/${p.kind}s/${p.id}`} className="min-w-0 flex-1 hover:text-navy-700">
                <span className="block text-sm font-medium text-stone-900 truncate">{p.name}</span>
                <span className="block text-xs text-stone-500 truncate">{p.detail ?? t(p.kind === 'school' ? 'nav.schools' : 'nav.districts')}</span>
              </Link>
              <div className="flex gap-4 text-right">
                {SUBJECTS_BY_EXAM[exam].map(([s, short]) => {
                  const v = cur?.subjects[s]?.proficiency ?? null, o = old?.subjects[s]?.proficiency ?? null;
                  const d = v != null && o != null ? Math.round((v - o) * 10) / 10 : null;
                  return (
                    <div key={s} className="w-16 sm:w-20">
                      <div className="text-[10px] uppercase tracking-wide text-stone-500">{short}</div>
                      <div className="text-sm font-semibold text-navy-900 tabular-nums">{formatPct(v)}</div>
                      {d != null && <div className={`text-[11px] tabular-nums ${d >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>{d > 0 ? '+' : ''}{d}</div>}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => remove(p.kind, p.id)} aria-label={t('pin.remove')} className="p-1 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100"><XMarkIcon className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ul>
      {isNew && lastImportAt && <button type="button" onClick={() => markImportSeen(lastImportAt)} className="mt-2 text-xs text-navy-600 hover:underline">{t('pin.dismiss')}</button>}
    </section>
  );
}
