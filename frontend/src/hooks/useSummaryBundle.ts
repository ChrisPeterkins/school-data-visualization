import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface BundlePoint { year: number; proficiency: number | null; tested: number; growth: number | null }
export type SummaryBundle = { pssa: Record<string, BundlePoint[]>; keystone: Record<string, BundlePoint[]> };

/** Every subject's student-weighted series for one entity in a single request. */
export function useSummaryBundle(level: 'school' | 'district' | 'county' | 'state', id?: number) {
  return useQuery({
    queryKey: ['summary-bundle', level, id ?? 0],
    queryFn: async () => (await api.get<SummaryBundle>('/api/performance/summary-bundle', { params: { level, ...(level === 'state' ? {} : { id }) } })).data,
    enabled: level === 'state' || id != null,
    staleTime: 60 * 60 * 1000,
  });
}

/** Rows shaped for TrendCard: one object per year with a key per subject. */
export function seriesFor(bundle: SummaryBundle | undefined, exam: 'pssa' | 'keystone', subjects: string[]) {
  if (!bundle) return [] as Array<{ year: number } & Record<string, number>>;
  const byYear: Record<number, { year: number } & Record<string, number>> = {};
  for (const s of subjects) for (const p of bundle[exam][s] ?? []) { if (p.proficiency == null) continue; (byYear[p.year] ??= { year: p.year })[s] = p.proficiency; }
  return Object.values(byYear).sort((a, b) => a.year - b.year);
}

/** Adapter so pages written against six `useQuery(summary)` results keep working: `{ data: { series } }` per subject. */
export function bundleAsQueries(bundle: SummaryBundle | undefined, exam: 'pssa' | 'keystone', subjects: string[]) {
  return subjects.map((s) => ({ data: bundle ? { series: bundle[exam][s] ?? [] } : undefined }));
}
