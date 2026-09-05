import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import FilterSelect from '../components/FilterSelect';
import {
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

// One sequential hue: highest schools in full navy, lowest in a lighter tint.
const COLORS = {
  navy: '#2d4a6f',
  navyLight: '#a8c3d8',
  gold: '#d4aa3c',
};

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  borderRadius: '0.5rem',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

export default function RankingsPage() {
  const { years, latest } = useAvailableYears();
  const smUp = useIsSmUp();
  // null = latest year in the database; becomes a number once the user picks one.
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const year = yearChoice ?? latest;
  const [examType, setExamType] = useState<'pssa' | 'keystone'>('pssa');
  const [subject, setSubject] = useState<string>('');
  const [grade, setGrade] = useState<number | ''>('');
  const [schoolType, setSchoolType] = useState('');
  const [limit, setLimit] = useState(10);

  // Get filter options (counties, school types) from existing endpoint
  const { data: filterOptions } = useQuery({
    queryKey: ['school-filters'],
    queryFn: async () => {
      const response = await fetch('/paschools/api/schools/filters');
      return response.json() as Promise<{
        counties: Array<{ id: number; name: string; code: string }>;
        schoolTypes: string[];
      }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const [countyId, setCountyId] = useState<number | ''>('');

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings', year, examType, subject, grade, countyId, schoolType, limit],
    queryFn: () =>
      performanceApi.getRankings({
        year: year!,
        examType,
        subject: subject || undefined,
        grade: grade || undefined,
        countyId: countyId || undefined,
        schoolType: schoolType || undefined,
        limit,
      }),
    enabled: year != null,
  });

  const pssaSubjects = ['Mathematics', 'English Language Arts', 'Science'];
  const keystoneSubjects = ['Algebra I', 'Biology', 'Literature'];
  const subjects = examType === 'pssa' ? pssaSubjects : keystoneSubjects;

  // The category axis eats fixed width; phones get a narrower axis and shorter labels.
  const axisWidth = smUp ? 210 : 120;
  const nameMax = smUp ? 28 : 17;
  const shorten = (name: string) => (name.length > nameMax ? name.slice(0, nameMax - 2) + '...' : name);

  // Build chart data: top schools (green) then gap then bottom schools (red, reversed)
  const chartData = rankings
    ? [
        ...rankings.top.map((s) => ({
          name: shorten(s.schoolName),
          fullName: s.schoolName,
          value: s.avgProficiency,
          isTop: true,
        })),
        ...rankings.bottom
          .slice()
          .reverse()
          .map((s) => ({
            name: shorten(s.schoolName),
            fullName: s.schoolName,
            value: s.avgProficiency,
            isTop: false,
          })),
      ]
    : [];

  const chartHeight = Math.max(400, chartData.length * 36 + 80);

  const SchoolCard = ({
    school,
    variant,
  }: {
    school: NonNullable<typeof rankings>['top'][0];
    variant: 'top' | 'bottom';
  }) => {
    const isTop = variant === 'top';

    return (
      <div className="card-surface p-4">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-stone-100 text-stone-700 tabular-nums">
            {school.rank}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={`/schools/${school.schoolId}`}
                className="text-sm font-semibold text-stone-900 hover:text-navy-600 transition-colors truncate"
              >
                {school.schoolName}
              </Link>
              <Link
                to={`/schools/${school.schoolId}`}
                className="flex-shrink-0 text-stone-400 hover:text-navy-500"
              >
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-stone-500 truncate">
              {school.districtName} &middot; {school.countyName}
            </p>

            {/* Proficiency bar */}
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isTop ? 'bg-navy-600' : 'bg-navy-300'}`}
                  style={{ width: `${school.avgProficiency}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums text-stone-900">
                {school.avgProficiency}%
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-3 text-xs text-stone-400">
              <span className="flex items-center gap-1">
                <UserGroupIcon className="w-3 h-3" />
                {school.totalTested?.toLocaleString() ?? '—'} tested
              </span>
              {school.schoolType && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600`}>
                  {school.schoolType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">School Rankings</h1>
            <p className="mt-1 text-sm text-stone-500">
              Highest and lowest proficiency rates among schools matching the filters
            </p>
          </div>

        {/* Filters */}
        <div className="card-surface p-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4">
            <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYearChoice(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Exam"
              value={examType}
              onChange={(e) => {
                setExamType(e.target.value as 'pssa' | 'keystone');
                setSubject('');
                setGrade('');
              }}
            >
              <option value="pssa">PSSA</option>
              <option value="keystone">Keystone</option>
            </FilterSelect>

            <FilterSelect label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FilterSelect>

            {examType === 'pssa' && (
              <FilterSelect label="Grade" value={grade} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All Grades</option>
                {[3, 4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </FilterSelect>
            )}

            <FilterSelect label="School Type" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
              <option value="">All Types</option>
              {filterOptions?.schoolTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </FilterSelect>

            <FilterSelect label="County" value={countyId} onChange={(e) => setCountyId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All Counties</option>
              {filterOptions?.counties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>

            <FilterSelect label="Show" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[5, 10, 15, 25].map((n) => (
                <option key={n} value={n}>Top/Bottom {n}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="card-surface p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-stone-500">Loading rankings...</p>
          </div>
        )}

        {rankings && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">Highest</p>
                <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">
                  {rankings.top[0]?.avgProficiency ?? 'N/A'}%
                </p>
                <p className="text-sm text-stone-700 mt-0.5 truncate">
                  {rankings.top[0]?.schoolName || 'N/A'}
                </p>
              </div>
              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">State average</p>
                <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">
                  {rankings.stateAverage != null ? `${rankings.stateAverage}%` : 'N/A'}
                </p>
                <p className="text-sm text-stone-700 mt-0.5">All schools, same filters</p>
              </div>
              <div className="card-surface p-5">
                <p className="text-sm text-stone-500">Lowest</p>
                <p className="text-2xl font-bold text-navy-800 mt-1 tabular-nums">
                  {rankings.bottom[0]?.avgProficiency ?? 'N/A'}%
                </p>
                <p className="text-sm text-stone-700 mt-0.5 truncate">
                  {rankings.bottom[0]?.schoolName || 'N/A'}
                </p>
              </div>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="card-surface p-4 sm:p-6 mb-8">
              <h2 className="text-base font-semibold text-stone-900 mb-1">
                Proficiency Rankings
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Highest {rankings.top.length} and lowest {rankings.bottom.length} schools by average % proficient or above
              </p>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart layout="vertical" data={chartData} margin={{ left: smUp ? 10 : 0, right: smUp ? 30 : 16, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={axisWidth}
                    tick={{ fontSize: smUp ? 11 : 10, fill: '#57534e' }}
                  />
                  {rankings.stateAverage != null && (
                    <ReferenceLine
                      x={rankings.stateAverage}
                      stroke={COLORS.gold}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{
                        value: `State Avg: ${rankings.stateAverage}%`,
                        position: 'top',
                        fill: COLORS.gold,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value}%`, 'Proficiency']}
                    labelFormatter={(label) => {
                      const item = chartData.find((d) => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.isTop ? COLORS.navy : COLORS.navyLight}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Two-column card lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-base font-semibold text-stone-900 mb-4">Highest proficiency</h2>
                <div className="space-y-3">
                  {rankings.top.map((school) => (
                    <SchoolCard key={school.schoolId} school={school} variant="top" />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-stone-900 mb-4">Lowest proficiency</h2>
                <div className="space-y-3">
                  {rankings.bottom.map((school) => (
                    <SchoolCard key={school.schoolId} school={school} variant="bottom" />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
