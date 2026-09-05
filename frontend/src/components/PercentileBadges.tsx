import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';

interface PercentileBadgesProps {
  entity: 'school' | 'district';
  id: number;
  year: number | null | undefined;
  exam: 'pssa' | 'keystone';
  subject: string;
  compact?: boolean;
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/**
 * "Where does this stand" line: percentile of the entity's all-grades
 * proficiency statewide, within its county, and among the same school level.
 */
export default function PercentileBadges({ entity, id, year, exam, subject, compact = false }: PercentileBadgesProps) {
  const { data } = useQuery({
    queryKey: ['percentile', entity, id, year, exam, subject],
    queryFn: () => performanceApi.getPercentile({ entity, id, year: year!, exam, subject }),
    enabled: year != null,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  if (!data) return null;

  const items: Array<{ label: string; pct: number; n: number }> = [];
  if (data.statewide) items.push({ label: entity === 'school' ? 'of all schools' : 'of all districts', pct: data.statewide.percentile, n: data.statewide.n });
  if (data.sameType?.percentile != null && data.sameType.n) items.push({ label: `of ${data.sameType.type!.toLowerCase()} schools`, pct: data.sameType.percentile, n: data.sameType.n });
  if (data.county) items.push({ label: 'in its county', pct: data.county.percentile, n: data.county.n });
  if (items.length === 0) return null;

  const tone = (p: number) => (p >= 75 ? 'bg-navy-100 text-navy-800' : p >= 40 ? 'bg-stone-100 text-stone-700' : 'bg-gold-100 text-gold-800');

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <span className="text-stone-500">{subject === 'English Language Arts' ? 'ELA' : subject} {data.year}:</span>
      {items.map((it) => (
        <span key={it.label} className={`inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 ${tone(it.pct)}`} title={`${it.n.toLocaleString()} compared, minimum 20 students tested`}>
          <span className="font-semibold tabular-nums">{ordinal(it.pct)}</span>
          <span>percentile {it.label}</span>
        </span>
      ))}
    </div>
  );
}
