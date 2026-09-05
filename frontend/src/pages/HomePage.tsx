import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MagnifyingGlassIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const features = [
  {
    title: 'PSSA Results',
    description: 'Grades 3-8 assessment results in Math, ELA, and Science across all Pennsylvania schools.',
    link: '/schools',
  },
  {
    title: 'Keystone Exams',
    description: 'End-of-course results in Algebra I, Biology, and Literature for high school students.',
    link: '/schools',
  },
  {
    title: 'Historical Trends',
    description: 'Track performance changes over a decade. See how schools and districts have evolved.',
    link: '/trends',
  },
  {
    title: 'Compare Schools',
    description: 'Side-by-side comparison of up to 5 schools against each other and the state average.',
    link: '/compare',
  },
  {
    title: 'District Analysis',
    description: 'Explore district-wide performance data and identify top-performing schools.',
    link: '/districts',
  },
  {
    title: 'State Overview',
    description: 'Statewide proficiency trends, subject breakdowns, and performance levels by grade.',
    link: '/state',
  },
];

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const availableYears = useAvailableYears();
  const { counts } = availableYears;
  const yearRange = formatYearRange(availableYears);
  useDocumentTitle(null);

  const stats = [
    { label: 'Public schools', value: counts ? counts.schools.toLocaleString() : '…' },
    { label: 'School districts', value: counts ? counts.districts.toLocaleString() : '…' },
    { label: 'PSSA results', value: counts ? compact.format(counts.pssaRecords) : '…' },
    { label: 'Years of data', value: yearRange || '…' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/schools?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-navy-900 border-t-4 border-gold-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-gold-400">
              {yearRange ? `PSSA & Keystone results, ${yearRange}` : 'Loading…'}
            </p>
            <h1 className="mt-3 text-3xl sm:text-5xl font-bold text-white tracking-tight">
              Pennsylvania School Data Explorer
            </h1>
            <p className="mt-5 text-base sm:text-lg text-navy-200 leading-relaxed">
              PSSA and Keystone exam performance for every public school in the Commonwealth,
              from the Pennsylvania Department of Education.
            </p>

            <form onSubmit={handleSearch} className="mt-8 max-w-xl">
              <div className="relative flex items-center">
                <MagnifyingGlassIcon className="absolute left-4 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a school or district"
                  aria-label="Search for a school or district"
                  className="w-full pl-11 sm:pl-12 pr-24 sm:pr-28 py-3.5 sm:py-4 rounded-lg bg-white text-stone-900 placeholder-stone-400 border-0 focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-4 sm:px-5 py-2 bg-navy-700 text-white text-sm font-medium rounded-md hover:bg-navy-600 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-stone-200">
        <dl className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-y-6 py-6 sm:py-8">
          {stats.map((stat) => (
            <div key={stat.label} className="lg:border-l lg:border-stone-200 lg:first:border-l-0 lg:pl-6 lg:first:pl-0">
              <dd className="text-2xl sm:text-3xl font-bold text-navy-900 tabular-nums whitespace-nowrap">{stat.value}</dd>
              <dt className="mt-1 text-sm text-stone-500">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Explore the data
        </h2>
        <p className="mt-2 text-base text-stone-500 max-w-2xl">
          Browse results by school, district, or statewide, and track performance over time.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.link}
              className="group card-surface p-6 flex flex-col hover:border-navy-300 transition-colors"
            >
              <h3 className="text-lg font-semibold text-stone-900 group-hover:text-navy-700 transition-colors">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-stone-500 leading-relaxed flex-1">
                {feature.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600">
                Explore
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
