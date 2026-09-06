import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { indicatorApi, type SpendingDistrict } from '../services/api';
import { useUrlState, parseNumber } from '../hooks/useUrlState';
import { isExam, type Exam } from '../lib/constants';
import FilterSelect from './FilterSelect';
import AccessibleChart from './AccessibleChart';
import { useT } from '../i18n';

const money = (n: number) => `$${Math.round(n / 1000)}k`;

/** Every district's spending per pupil against its Math + ELA proficiency, with the statewide figures as crosshairs. */
export default function SpendingScatter() {
  const t = useT();
  const navigate = useNavigate();
  const [yearParam, setYear] = useUrlState<number | null>('fy', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [exam, setExam] = useUrlState<Exam>('fexam', 'pssa', (r) => (isExam(r) ? r : null));
  const { data, isLoading } = useQuery({
    queryKey: ['spending', yearParam, exam],
    queryFn: () => indicatorApi.getSpending({ year: yearParam ?? undefined, exam }),
    staleTime: 60 * 60 * 1000,
  });

  // Clip the long tail of tiny charters and CTCs so the bulk of districts stays readable.
  const { rows, xMax } = useMemo(() => {
    const ds = data?.districts ?? [];
    const sorted = ds.map((d) => d.perPupil).sort((a, b) => a - b);
    const p97 = sorted.length ? sorted[Math.floor(sorted.length * 0.97)] : 0;
    return { rows: ds.map((d) => ({ ...d, x: Math.min(d.perPupil, p97), clipped: d.perPupil > p97 })), xMax: p97 };
  }, [data]);

  if (!isLoading && data && data.districts.length === 0) return null;
  return (
    <section className="card-surface p-4 sm:p-6 space-y-4" aria-labelledby="spending-heading">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 id="spending-heading" className="text-lg font-bold text-stone-900">{t('spend.title')}</h2>
          <p className="mt-1 text-sm text-stone-500">{t('spend.sub')}</p>
        </div>
        <div className="flex gap-3">
          <FilterSelect label={t('common.year')} value={data?.year ?? ''} onChange={(e) => setYear(Number(e.target.value))} fluid={false}>
            {(data?.years ?? []).map((y) => <option key={y} value={y}>{y - 1}-{String(y).slice(2)}</option>)}
          </FilterSelect>
          <FilterSelect label={t('common.exam')} value={exam} onChange={(e) => setExam(e.target.value as Exam)} fluid={false}>
            <option value="pssa">{t('common.pssa')}</option>
            <option value="keystone">{t('common.keystone')}</option>
          </FilterSelect>
        </div>
      </div>
      {data && data.year && (
        <AccessibleChart label={t('spend.title')} rows={data.districts.map((d) => ({ district: d.name, county: d.county, perPupil: d.perPupil, proficiency: d.proficiency, tested: d.tested }))}>
          <div className="h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis type="number" dataKey="x" name={t('ind.perPupil')} domain={['auto', xMax || 'auto']} tickFormatter={money} tick={{ fontSize: 11 }} label={{ value: t('spend.xAxis'), position: 'insideBottom', offset: -12, fontSize: 11, fill: '#78716c' }} />
                <YAxis type="number" dataKey="proficiency" name={t('common.proficient')} unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
                <ZAxis type="number" dataKey="tested" range={[18, 220]} />
                {data.state?.medianPerPupil != null && <ReferenceLine x={Math.min(data.state.medianPerPupil, xMax)} stroke="#a8a29e" strokeDasharray="4 4" label={{ value: t('spend.median'), fontSize: 10, fill: '#78716c', position: 'insideTopRight' }} />}
                {data.state?.proficiency != null && <ReferenceLine y={data.state.proficiency} stroke="#a8a29e" strokeDasharray="4 4" label={{ value: t('spend.stateAvg'), fontSize: 10, fill: '#78716c', position: 'insideTopLeft' }} />}
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const d = payload?.[0]?.payload as (SpendingDistrict & { clipped: boolean }) | undefined;
                  if (!d) return null;
                  return (
                    <div className="bg-white border border-stone-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                      <div className="font-semibold text-stone-900">{d.name}</div>
                      <div className="text-stone-500">{d.county}{d.type && d.type !== 'Public' ? ` · ${d.type}` : ''}</div>
                      <div className="tabular-nums">{t('ind.perPupil')}: ${d.perPupil.toLocaleString()}{d.clipped ? ` (${t('spend.offScale')})` : ''}</div>
                      <div className="tabular-nums">{t('common.proficient')}: {d.proficiency}% · {d.tested.toLocaleString()} {t('results.tested').toLowerCase()}</div>
                    </div>
                  );
                }} />
                <Scatter data={rows} fill="#1e3a5f" fillOpacity={0.55} onClick={(p: any) => p?.id && navigate(`/districts/${p.id}`)} className="cursor-pointer" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </AccessibleChart>
      )}
      <p className="text-xs text-stone-500">{t('spend.note')}</p>
    </section>
  );
}
