import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useT } from '../i18n';
import AccessibleChart from '../components/AccessibleChart';
import ChartActions from '../components/ChartActions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { performanceApi } from '../services/api';
import { useAvailableYears, yearsForExam } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import { useUrlState, parseNumber, parseString } from '../hooks/useUrlState';
import FilterSelect from '../components/FilterSelect';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import ExportCsvButton from '../components/ExportCsvButton';
import { CHART_COLORS, tooltipStyle, growthBand } from '../lib/chartUtils';

import { SUBJECTS, isExam, type Exam } from '../lib/constants';
import QueryState from '../components/QueryState';

type RankEntity = 'school' | 'district' | 'county';
type Mode = 'level' | 'change';

export default function RankingsPage() {
  const t = useT();
  const availableYears = useAvailableYears();
  const { latest } = availableYears;
  const smUp = useIsSmUp();

  const [yearParam, setYearParam] = useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const year = yearParam ?? latest;
  const [examType, setExamType] = useUrlState<Exam>('exam', 'pssa', (r) => (isExam(r) ? r : null));
  const years = yearsForExam(availableYears, examType);
  const [entity, setEntity] = useUrlState<RankEntity>('entity', 'school', (r) => (['school', 'district', 'county'].includes(r) ? (r as RankEntity) : null));
  const [mode, setMode] = useUrlState<Mode>('mode', 'level', (r) => (r === 'level' || r === 'change' ? r : null));
  const [compareYearParam, setCompareYear] = useUrlState<number | null>('since', null, parseNumber, (v) => (v == null ? '' : String(v)));
  const [subject, setSubject] = useUrlState<string>('subject', '', parseString);
  const [grade, setGrade] = useUrlState<number | ''>('grade', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [schoolType, setSchoolType] = useUrlState<string>('type', '', parseString);
  const [countyId, setCountyId] = useUrlState<number | ''>('county', '', parseNumber, (v) => (v === '' ? '' : String(v)));
  const [limit, setLimit] = useUrlState<number>('limit', 10, parseNumber);
  const [minTested, setMinTested] = useUrlState<number>('min', 40, parseNumber);
  const MEASURES = ['proficiency', 'beating_odds', 'grad_rate_4yr', 'regular_attendance', 'low_income', 'per_pupil', 'students_per_teacher'] as const;
  type Measure = typeof MEASURES[number];
  const [measure, setMeasure] = useUrlState<Measure>('measure', 'proficiency', (r) => (MEASURES.includes(r as Measure) ? (r as Measure) : null));
  const districtOnly = measure === 'per_pupil' || measure === 'students_per_teacher';
  const isIndicator = measure !== 'proficiency' && measure !== 'beating_odds';
  const isOdds = measure === 'beating_odds';
  const fmtMeasure = (v: number | null | undefined) => (v == null ? 'N/A' : measure === 'per_pupil' ? `$${Math.round(v).toLocaleString()}` : measure === 'students_per_teacher' ? `${v.toFixed(1)}:1` : `${v}%`);

  const { data: filterOptions } = useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => {
      const response = await fetch('/paschools/api/schools/filters');
      return response.json() as Promise<{ counties: Array<{ id: number; name: string; code: string }>; schoolTypes: string[] }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const commonParams = {
    examType,
    subject: subject || undefined,
    grade: grade || undefined,
    countyId: countyId || undefined,
    schoolType: entity === 'school' && schoolType ? schoolType : undefined,
    minTested,
  };

  const { data: rankings, isLoading, error, refetch } = useQuery({
    queryKey: ['rankings', year, commonParams, limit, entity, mode, compareYearParam, measure],
    queryFn: () => performanceApi.getRankings({ year: year!, ...commonParams, limit, entity: districtOnly && entity === 'school' ? 'district' : entity, mode: measure === 'proficiency' ? mode : 'level', compareYear: compareYearParam ?? undefined, measure } as any),
    enabled: year != null,
  });
  const isChange = mode === 'change' && measure === 'proficiency';
  const compareYear: number | null = (rankings as any)?.filters?.compareYear ?? null;
  const entityNoun = entity === 'school' ? 'schools' : entity === 'district' ? 'districts' : 'counties';
  const pathFor = (id: number) => (entity === 'school' ? `/schools/${id}` : entity === 'district' ? `/districts/${id}` : `/counties/${id}`);
  const metricOf = (s: any): number => (isChange ? s.change : isOdds ? s.residual : s.avgProficiency);

  const { data: growthData } = useQuery({
    queryKey: ['growth-achievement', year, commonParams],
    queryFn: () => performanceApi.getGrowthAchievement({ year: year!, ...commonParams }),
    enabled: year != null && entity === 'school',
  });

  const subjects = SUBJECTS[examType];
  useDocumentTitle(`School rankings${year ? `, ${year}` : ''}`, 'Highest and lowest proficiency Pennsylvania schools, with PVAAS growth.');

  // The category axis eats fixed width; phones get a narrower axis and shorter labels.
  const axisWidth = smUp ? 210 : 120;
  const nameMax = smUp ? 28 : 17;
  const shorten = (name: string) => (name.length > nameMax ? name.slice(0, nameMax - 2) + '...' : name);

  const chartData = rankings
    ? [
        ...rankings.top.map((s: any) => ({ name: shorten(s.schoolName), fullName: s.schoolName, value: metricOf(s), isTop: true })),
        ...rankings.bottom.slice().reverse().map((s: any) => ({ name: shorten(s.schoolName), fullName: s.schoolName, value: metricOf(s), isTop: false })),
      ]
    : [];
  const changeExtent = Math.max(5, ...chartData.map((d) => Math.abs(d.value ?? 0)));
  const chartHeight = Math.max(400, chartData.length * 36 + 80);

  const points = growthData?.points ?? [];
  const quadrant = (p: { proficiency: number; growth: number }) => {
    const highAch = rankings?.stateAverage != null ? p.proficiency >= rankings.stateAverage : p.proficiency >= 50;
    if (p.growth >= 1) return highAch ? CHART_COLORS.navyDark : CHART_COLORS.teal;
    if (p.growth <= -1) return highAch ? CHART_COLORS.gold : CHART_COLORS.brick;
    return CHART_COLORS.navyLight;
  };

  const barMax = rankings ? Math.max(...[...rankings.top, ...rankings.bottom].map((r: any) => r.avgProficiency ?? 0)) : 0;
  const SchoolCard = ({ school, variant }: { school: any; variant: 'top' | 'bottom' }) => {
    const isTop = variant === 'top';
    const band = growthBand(school.avgGrowth);
    const sub = entity === 'school' ? `${school.districtName} · ${school.countyName}` : entity === 'district' ? `${school.countyName} County${school.city ? ` · ${school.city}` : ''}` : 'County';
    return (
      <div className="card-surface p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-stone-100 text-stone-700 tabular-nums">
            {school.rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link to={pathFor(school.schoolId)} className="text-sm font-semibold text-stone-900 hover:text-navy-600 transition-colors truncate">
                {school.schoolName}
              </Link>
              <Link to={pathFor(school.schoolId)} className="flex-shrink-0 text-stone-500 hover:text-navy-500" aria-label={`Open ${school.schoolName}`}>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-stone-500 truncate">{sub}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${isTop ? 'bg-navy-600' : 'bg-navy-300'}`} style={{ width: `${districtOnly ? Math.min(100, (school.avgProficiency / (barMax || 1)) * 100) : school.avgProficiency}%` }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-stone-900">{fmtMeasure(school.avgProficiency)}</span>
              {isChange && (
                <span className={`text-sm font-semibold tabular-nums ${school.change >= 0 ? 'text-teal-700' : 'text-brick-600'}`}>
                  {school.change > 0 ? '+' : ''}{school.change} pts
                </span>
              )}
              {isOdds && (
                <span className={`text-sm font-semibold tabular-nums ${school.residual >= 0 ? 'text-teal-700' : 'text-brick-600'}`} title={t('rank.odds.expected', { value: `${school.expectedProficiency}%` })}>
                  {school.residual > 0 ? '+' : ''}{school.residual} pts
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <UserGroupIcon className="w-3 h-3" />
                {school.totalTested?.toLocaleString() ?? '—'} {measure === 'per_pupil' ? 'ADM' : measure === 'students_per_teacher' ? 'teachers' : measure === 'grad_rate_4yr' ? 'in cohort' : isIndicator ? 'enrolled' : 'tested'}
              </span>
              {isOdds && <span title={t('rank.odds.expected', { value: `${school.expectedProficiency}%` })}>{school.lowIncome}% low-income · {school.avgProficiency}% proficient</span>}
              {school.avgGrowth != null && (
                <span className={band.className} title="PVAAS growth index">growth {school.avgGrowth.toFixed(1)} · {band.label}</span>
              )}
              {school.schoolType && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600">{school.schoolType}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{t('pages.rankings.title')}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {isChange
            ? `Change in the share of students proficient or above${compareYear ? ` since ${compareYear}` : ''}, weighted by students tested. Most improved and most declined ${entityNoun}.`
            : `Share of students proficient or above, weighted by students tested. ${entityNoun[0].toUpperCase() + entityNoun.slice(1)} below the minimum tested are left out.`}
        </p>
      </div>

      <div className="card-surface p-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
          <FilterSelect label={t('rank.rank')} value={entity} onChange={(e) => setEntity(e.target.value as RankEntity)}>
            <option value="school">{t('nav.schools')}</option>
            <option value="district">{t('nav.districts')}</option>
            <option value="county">{t('nav.counties')}</option>
          </FilterSelect>
          <FilterSelect label={t('rank.measure')} value={measure} onChange={(e) => { const m = e.target.value as Measure; setMeasure(m); if ((m === 'per_pupil' || m === 'students_per_teacher') && entity === 'school') setEntity('district'); }}>
            {MEASURES.map((m) => <option key={m} value={m} disabled={(m === 'per_pupil' || m === 'students_per_teacher') && entity === 'county'}>{t(`rank.m.${m}`)}</option>)}
          </FilterSelect>
          {measure === 'proficiency' && <FilterSelect label={t('rank.by')} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="level">{t('rank.level')}</option>
            <option value="change">{t('rank.change')}</option>
          </FilterSelect>}
          {isChange && (
            <FilterSelect label={t('rank.since')} value={compareYearParam ?? compareYear ?? ''} onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}>
              {years.filter((y) => year == null || y < year).map((y) => <option key={y} value={y}>{y}</option>)}
            </FilterSelect>
          )}
          <FilterSelect label={t('common.year')} value={year ?? ''} onChange={(e) => setYearParam(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
          <FilterSelect label={t('common.exam')} value={examType} onChange={(e) => { setExamType(e.target.value as Exam); setSubject(''); setGrade(''); }}>
            <option value="pssa">PSSA</option>
            <option value="keystone">Keystone</option>
          </FilterSelect>
          <FilterSelect label={t('common.subject')} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">{t('common.allSubjects')}</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          {examType === 'pssa' && (
            <FilterSelect label={t('common.grade')} value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{t('common.allGrades')}</option>
              {[3, 4, 5, 6, 7, 8].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </FilterSelect>
          )}
          {entity === 'school' && (
            <FilterSelect label={t('common.schoolType')} value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
              <option value="">{t('common.allTypes')}</option>
              {filterOptions?.schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
          )}
          <FilterSelect label={t('common.county')} value={countyId} onChange={(e) => setCountyId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('common.allCounties')}</option>
            {filterOptions?.counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label={t('rank.minTested')} value={minTested} onChange={(e) => setMinTested(Number(e.target.value))}>
            {[20, 40, 100, 250].map((n) => <option key={n} value={n}>{n} students</option>)}
          </FilterSelect>
          <FilterSelect label={t('rank.show')} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[5, 10, 15, 25].map((n) => <option key={n} value={n}>Top/Bottom {n}</option>)}
          </FilterSelect>
        </div>
      </div>

      <QueryState isLoading={isLoading} error={error} empty={!!rankings && rankings.top.length === 0} emptyMessage={`No ${entityNoun} meet these filters${isChange && !compareYear ? ' (no earlier year to compare with)' : ''}.`} onRetry={() => refetch()} loadingMessage="Loading rankings...">
      {rankings && rankings.top.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">{isChange ? 'Most improved' : isOdds ? t('rank.odds.above') : 'Highest'}</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">{isChange || isOdds ? `${metricOf(rankings.top[0]) > 0 ? '+' : ''}${metricOf(rankings.top[0])} pts` : fmtMeasure(rankings.top[0]?.avgProficiency)}</p>
              <p className="text-sm text-stone-700 mt-0.5 truncate">{rankings.top[0]?.schoolName || 'N/A'}</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">{isChange ? `Statewide change${compareYear ? ` since ${compareYear}` : ''}` : isOdds ? 'Poverty and proficiency' : 'State average'}</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">
                {isChange
                  ? ((rankings as any).stateChange != null ? `${(rankings as any).stateChange > 0 ? '+' : ''}${(rankings as any).stateChange} pts` : 'N/A')
                  : isOdds ? ((rankings as any).fit?.r2 != null ? `r² ${(rankings as any).fit.r2}` : 'N/A')
                  : (rankings.stateAverage != null ? fmtMeasure(rankings.stateAverage) : 'N/A')}
              </p>
              <p className="text-sm text-stone-700 mt-0.5">{isChange ? `Now ${rankings.stateAverage ?? '—'}% proficient` : isOdds ? t('rank.odds.fit', { r2: Math.round(((rankings as any).fit?.r2 ?? 0) * 100), n: (rankings as any).fit?.n ?? 0, entity: entityNoun }) : isIndicator ? t('rank.measureYear', { year: (rankings as any).filters?.measureYear ?? '' }) : 'All students, same subject and grade'}</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-stone-500">{isChange ? 'Most declined' : isOdds ? t('rank.odds.below') : 'Lowest'}</p>
              <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">{isChange || isOdds ? `${metricOf(rankings.bottom[0]) > 0 ? '+' : ''}${metricOf(rankings.bottom[0])} pts` : fmtMeasure(rankings.bottom[0]?.avgProficiency)}</p>
              <p className="text-sm text-stone-700 mt-0.5 truncate">{rankings.bottom[0]?.schoolName || 'N/A'}</p>
            </div>
          </div>

          <div className="card-surface p-4 sm:p-6 mb-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-stone-900 mb-1">{isChange ? t('rank.changeTitle', { range: compareYear ? `, ${compareYear} – ${year}` : '' }) : measure === 'proficiency' ? t('rank.levelTitle') : t('rank.chartTitle', { measure: t(`rank.m.${measure}`) })}</h2>
              <ExportCsvButton
                filename={`rankings-${entity}-${mode}-${examType}-${subject || 'all-subjects'}-${year}`}
                rows={[...rankings.top.map((r: any) => ({ list: isChange ? 'most improved' : 'highest', ...r })), ...rankings.bottom.map((r: any) => ({ list: isChange ? 'most declined' : 'lowest', ...r }))]}
                columns={[{ key: 'list', label: 'List' }, { key: 'rank', label: 'Rank' }, { key: 'schoolName', label: 'Name' }, { key: 'districtName', label: 'District' }, { key: 'countyName', label: 'County' }, { key: 'schoolType', label: 'Type' }, { key: 'avgProficiency', label: '% proficient or above' }, ...(isChange ? [{ key: 'previousProficiency', label: `% proficient in ${compareYear}` }, { key: 'change', label: 'Change (pts)' }] : []), { key: 'avgGrowth', label: 'Growth index' }, { key: 'totalTested', label: 'Students tested' }]}
              />
            </div>
            <p className="text-xs text-stone-500 mb-4">
              {isChange ? `Most improved ${rankings.top.length} and most declined ${rankings.bottom.length} ${entityNoun}, percentage points` : isOdds ? t('rank.oddsSub') : t('rank.chartSub', { top: rankings.top.length, bottom: rankings.bottom.length, entity: entityNoun, measure: measure === 'proficiency' ? '% proficient or above' : t(`rank.m.${measure}`).toLowerCase() })}
            </p>
            <div aria-hidden="true"><ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart layout="vertical" data={chartData} margin={{ left: smUp ? 10 : 0, right: smUp ? 30 : 16, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                <XAxis type="number" domain={isChange || isOdds ? [-Math.ceil(changeExtent), Math.ceil(changeExtent)] : districtOnly ? [0, 'auto'] : [0, 100]} tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => (isChange || isOdds ? `${v > 0 ? '+' : ''}${v}` : measure === 'per_pupil' ? `$${Math.round(v / 1000)}k` : measure === 'students_per_teacher' ? `${v}` : `${v}%`)} />
                <YAxis type="category" dataKey="name" width={axisWidth} tick={{ fontSize: smUp ? 11 : 10, fill: '#57534e' }} />
                {!isChange && !isOdds && rankings.stateAverage != null && (
                  <ReferenceLine x={rankings.stateAverage} stroke={CHART_COLORS.gold} strokeWidth={2} strokeDasharray="6 3"
                    label={{ value: `State: ${fmtMeasure(rankings.stateAverage)}`, position: 'top', fill: CHART_COLORS.gold, fontSize: 11, fontWeight: 600 }} />
                )}
                {(isChange || isOdds) && <ReferenceLine x={0} stroke="#a8a29e" />}
                {isChange && (rankings as any).stateChange != null && (
                  <ReferenceLine x={(rankings as any).stateChange} stroke={CHART_COLORS.gold} strokeWidth={2} strokeDasharray="6 3"
                    label={{ value: `State: ${(rankings as any).stateChange > 0 ? '+' : ''}${(rankings as any).stateChange}`, position: 'top', fill: CHART_COLORS.gold, fontSize: 11, fontWeight: 600 }} />
                )}
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => (isChange || isOdds ? [`${value > 0 ? '+' : ''}${value} pts`, isOdds ? 'Vs. expected' : 'Change'] : [fmtMeasure(value), t(`rank.m.${measure}`)])}
                  labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((entry, index) => <Cell key={index} fill={isChange || isOdds ? (entry.value >= 0 ? CHART_COLORS.teal : CHART_COLORS.brick) : entry.isTop ? CHART_COLORS.navy : CHART_COLORS.navyLight} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          </div>

          {isOdds && (rankings as any).points?.length > 0 && (
            <div className="card-surface p-4 sm:p-6 mb-8">
              <h2 className="text-base font-semibold text-stone-900 mb-1">{t('rank.odds.title')}</h2>
              <p className="text-xs text-stone-500 mb-4">{t('rank.odds.sub', { entity: entity === 'school' ? 'school' : 'district' })}</p>
              <ChartActions filename={`beating-the-odds-${entity}-${year}`} title={t('rank.odds.title')}>
              <AccessibleChart label={t('rank.odds.title')} rows={(rankings as any).points.map((p: any) => ({ name: p.name, lowIncome: p.lowIncome, proficiency: p.proficiency, residual: p.residual }))}>
                <ResponsiveContainer width="100%" height={smUp ? 420 : 320}>
                  <ScatterChart margin={{ top: 10, right: smUp ? 30 : 12, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis type="number" dataKey="lowIncome" domain={[0, 100]} name="Low-income share" tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} label={{ value: '% of students from low-income families', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#78716c' }} />
                    <YAxis type="number" dataKey="proficiency" domain={[0, 100]} name="Proficient or above" tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} width={40} />
                    <ZAxis type="number" dataKey="tested" range={[14, 160]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => { const p = payload?.[0]?.payload; return p ? <div className="bg-white border border-stone-200 rounded-lg shadow-lg px-3 py-2 text-xs"><div className="font-semibold text-stone-900">{p.name}</div><div>{p.lowIncome}% low-income · {p.proficiency}% proficient</div><div className={p.residual >= 0 ? 'text-teal-700' : 'text-brick-600'}>{p.residual > 0 ? '+' : ''}{p.residual} pts vs. expected</div></div> : null; }} />
                    {(rankings as any).fit && <ReferenceLine segment={[{ x: 0, y: (rankings as any).fit.intercept }, { x: 100, y: (rankings as any).fit.intercept + (rankings as any).fit.slope * 100 }]} stroke={CHART_COLORS.gold} strokeWidth={2} strokeDasharray="6 3" />}
                    <Scatter data={(rankings as any).points} fill="#1e3a5f" fillOpacity={0.5} isAnimationActive={false} onClick={(p: any) => p?.id && window.location.assign(`/paschools${pathFor(p.id)}`)} className="cursor-pointer" />
                  </ScatterChart>
                </ResponsiveContainer>
              </AccessibleChart>
              </ChartActions>
            </div>
          )}

          {entity === 'school' && !isOdds && !isIndicator && points.length > 0 && (
            <div className="card-surface p-4 sm:p-6 mb-8">
              <h2 className="text-base font-semibold text-stone-900 mb-1">{t('rank.growthVs')}</h2>
              <p className="text-xs text-stone-500 mb-4">
                Every school matching the filters ({points.length.toLocaleString()}). Right is higher proficiency; up is more PVAAS growth than the state standard.
                Schools low on achievement but high on growth (teal) are catching up; high achievement with low growth (gold) is coasting.
              </p>
              <div aria-hidden="true"><ResponsiveContainer width="100%" height={smUp ? 420 : 320}>
                <ScatterChart margin={{ top: 10, right: smUp ? 30 : 12, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" dataKey="proficiency" domain={[0, 100]} name="Proficient or above" tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `${v}%`}
                    label={{ value: '% proficient or above', position: 'insideBottom', offset: -12, fill: '#78716c', fontSize: 11 }} />
                  <YAxis type="number" dataKey="growth" name="Growth index" tick={{ fontSize: 11, fill: '#78716c' }} width={smUp ? 48 : 36}
                    label={smUp ? { value: 'PVAAS growth index', angle: -90, position: 'insideLeft', fill: '#78716c', fontSize: 11 } : undefined} />
                  <ZAxis type="number" dataKey="tested" range={[20, 160]} name="Tested" />
                  <ReferenceLine y={0} stroke="#a8a29e" />
                  {rankings.stateAverage != null && <ReferenceLine x={rankings.stateAverage} stroke={CHART_COLORS.gold} strokeDasharray="6 3" />}
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      const p: any = payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div style={tooltipStyle} className="p-2">
                          <div className="font-medium text-stone-900">{p.schoolName}</div>
                          <div className="text-stone-500">{p.districtName}</div>
                          <div className="mt-1">{p.proficiency}% proficient · growth {p.growth} · {p.tested.toLocaleString()} tested</div>
                        </div>
                      );
                    }} />
                  <Scatter data={points} fillOpacity={0.7}>
                    {points.map((p, i) => <Cell key={i} fill={quadrant(p)} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer></div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-4">{t(isChange ? 'home.improved' : 'rank.highest')}</h2>
              <div className="space-y-3">
                {rankings.top.map((school) => <SchoolCard key={school.schoolId} school={school} variant="top" />)}
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 mb-4">{t(isChange ? 'home.declined' : 'rank.lowest')}</h2>
              <div className="space-y-3">
                {rankings.bottom.map((school) => <SchoolCard key={school.schoolId} school={school} variant="bottom" />)}
              </div>
            </div>
          </div>
        </>
      )}
      </QueryState>
    </div>
  );
}
