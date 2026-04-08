import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { performanceApi } from '../services/api';
import {
  TrophyIcon,
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

const COLORS = {
  civic: '#27ab83',
  civicLight: '#c6f7e2',
  brick: '#c53030',
  brickLight: '#fde3e3',
  navy: '#2d4a6f',
  gold: '#d4aa3c',
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  borderRadius: '0.5rem',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

export default function RankingsPage() {
  const [year, setYear] = useState(2024);
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
        year,
        examType,
        subject: subject || undefined,
        grade: grade || undefined,
        countyId: countyId || undefined,
        schoolType: schoolType || undefined,
        limit,
      }),
  });

  const pssaSubjects = ['Mathematics', 'English Language Arts', 'Science'];
  const keystoneSubjects = ['Algebra I', 'Biology', 'Literature'];
  const subjects = examType === 'pssa' ? pssaSubjects : keystoneSubjects;
  const years = [2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016, 2015];

  // Build chart data: top schools (green) then gap then bottom schools (red, reversed)
  const chartData = rankings
    ? [
        ...rankings.top.map((s) => ({
          name: s.schoolName.length > 28 ? s.schoolName.slice(0, 26) + '...' : s.schoolName,
          fullName: s.schoolName,
          value: s.avgProficiency,
          isTop: true,
        })),
        ...rankings.bottom
          .slice()
          .reverse()
          .map((s) => ({
            name: s.schoolName.length > 28 ? s.schoolName.slice(0, 26) + '...' : s.schoolName,
            fullName: s.schoolName,
            value: s.avgProficiency,
            isTop: false,
          })),
      ]
    : [];

  const chartHeight = Math.max(400, chartData.length * 36 + 80);

  const FilterSelect = ({ label, value, onChange, children }: any) => (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-stone-500 whitespace-nowrap">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
      >
        {children}
      </select>
    </div>
  );

  const SchoolCard = ({
    school,
    index,
    variant,
  }: {
    school: NonNullable<typeof rankings>['top'][0];
    index: number;
    variant: 'top' | 'bottom';
  }) => {
    const isTop = variant === 'top';

    return (
      <motion.div
        custom={index}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="card-philly p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isTop
                ? 'bg-civic-100 text-civic-800'
                : 'bg-brick-100 text-brick-700'
            }`}
          >
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
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTop ? 'bg-civic-500' : 'bg-brick-400'
                  }`}
                  style={{ width: `${school.avgProficiency}%` }}
                />
              </div>
              <span
                className={`text-sm font-bold tabular-nums ${
                  isTop ? 'text-civic-700' : 'text-brick-600'
                }`}
              >
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
      </motion.div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-2.5 rounded-xl bg-gold-100">
            <TrophyIcon className="w-6 h-6 text-gold-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">School Rankings</h1>
            <p className="mt-1 text-sm text-stone-500">
              Top and bottom performing schools ranked by proficiency rates
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="card-philly p-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <FilterSelect label="Year" value={year} onChange={(e: any) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Exam"
              value={examType}
              onChange={(e: any) => {
                setExamType(e.target.value);
                setSubject('');
                setGrade('');
              }}
            >
              <option value="pssa">PSSA</option>
              <option value="keystone">Keystone</option>
            </FilterSelect>

            <FilterSelect label="Subject" value={subject} onChange={(e: any) => setSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FilterSelect>

            {examType === 'pssa' && (
              <FilterSelect label="Grade" value={grade} onChange={(e: any) => setGrade(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All Grades</option>
                {[3, 4, 5, 6, 7, 8].map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </FilterSelect>
            )}

            <FilterSelect label="School Type" value={schoolType} onChange={(e: any) => setSchoolType(e.target.value)}>
              <option value="">All Types</option>
              {filterOptions?.schoolTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </FilterSelect>

            <FilterSelect label="County" value={countyId} onChange={(e: any) => setCountyId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All Counties</option>
              {filterOptions?.counties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FilterSelect>

            <FilterSelect label="Show" value={limit} onChange={(e: any) => setLimit(Number(e.target.value))}>
              {[5, 10, 15, 25].map((n) => (
                <option key={n} value={n}>Top/Bottom {n}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="card-philly p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-stone-500">Loading rankings...</p>
          </div>
        )}

        {rankings && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card-philly p-5 border-l-4 border-l-civic-500">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Top School</p>
                <p className="text-lg font-bold text-stone-900 mt-1 truncate">
                  {rankings.top[0]?.schoolName || 'N/A'}
                </p>
                <p className="text-2xl font-bold text-civic-700 mt-0.5">
                  {rankings.top[0]?.avgProficiency ?? 'N/A'}%
                </p>
              </div>
              <div className="card-philly p-5 border-l-4 border-l-gold-400">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">State Average</p>
                <p className="text-lg font-bold text-stone-900 mt-1">Benchmark</p>
                <p className="text-2xl font-bold text-gold-700 mt-0.5">
                  {rankings.stateAverage != null ? `${rankings.stateAverage}%` : 'N/A'}
                </p>
              </div>
              <div className="card-philly p-5 border-l-4 border-l-brick-500">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Bottom School</p>
                <p className="text-lg font-bold text-stone-900 mt-1 truncate">
                  {rankings.bottom[0]?.schoolName || 'N/A'}
                </p>
                <p className="text-2xl font-bold text-brick-600 mt-0.5">
                  {rankings.bottom[0]?.avgProficiency ?? 'N/A'}%
                </p>
              </div>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="card-philly p-6 mb-8">
              <h2 className="text-base font-semibold text-stone-900 mb-1">
                Proficiency Rankings
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Top {rankings.top.length} and bottom {rankings.bottom.length} schools by average % proficient or above
              </p>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart layout="vertical" data={chartData} margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
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
                    width={210}
                    tick={{ fontSize: 11, fill: '#57534e' }}
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
                        fill={entry.isTop ? COLORS.civic : COLORS.brick}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Two-column card lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Performers */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-civic-500" />
                  <h2 className="text-base font-semibold text-stone-900">Top Performers</h2>
                </div>
                <div className="space-y-3">
                  {rankings.top.map((school, i) => (
                    <SchoolCard key={school.schoolId} school={school} index={i} variant="top" />
                  ))}
                </div>
              </div>

              {/* Needs Improvement */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-brick-500" />
                  <h2 className="text-base font-semibold text-stone-900">Needs Improvement</h2>
                </div>
                <div className="space-y-3">
                  {rankings.bottom.map((school, i) => (
                    <SchoolCard key={school.schoolId} school={school} index={i} variant="bottom" />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
