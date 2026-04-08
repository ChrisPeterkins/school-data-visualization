import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ArrowsRightLeftIcon,
  GlobeAmericasIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const stats = [
  { label: 'Public Schools', value: '3,000+', icon: AcademicCapIcon, color: 'text-navy-600 bg-navy-100' },
  { label: 'School Districts', value: '500+', icon: BuildingOffice2Icon, color: 'text-civic-700 bg-civic-100' },
  { label: 'Students Represented', value: '1.7M', icon: GlobeAmericasIcon, color: 'text-gold-700 bg-gold-100' },
  { label: 'Years of Data', value: '2015-2024', icon: ChartBarIcon, color: 'text-brick-600 bg-brick-100' },
];

const features = [
  {
    title: 'PSSA Results',
    description: 'Grades 3-8 assessment results in Math, ELA, and Science across all Pennsylvania schools.',
    icon: AcademicCapIcon,
    link: '/schools',
    color: 'bg-navy-500',
  },
  {
    title: 'Keystone Exams',
    description: 'End-of-course results in Algebra I, Biology, and Literature for high school students.',
    icon: ChartBarIcon,
    link: '/schools',
    color: 'bg-civic-600',
  },
  {
    title: 'Historical Trends',
    description: 'Track performance changes over 10 years. See how schools and districts have evolved.',
    icon: ArrowTrendingUpIcon,
    link: '/trends',
    color: 'bg-gold-600',
  },
  {
    title: 'Compare Schools',
    description: 'Side-by-side comparison of up to 5 schools with radar charts and bar graphs.',
    icon: ArrowsRightLeftIcon,
    link: '/compare',
    color: 'bg-brick-500',
  },
  {
    title: 'District Analysis',
    description: 'Explore district-wide performance data and identify top-performing schools.',
    icon: BuildingOffice2Icon,
    link: '/districts',
    color: 'bg-navy-600',
  },
  {
    title: 'State Overview',
    description: 'Statewide proficiency trends, subject breakdowns, and distribution analysis.',
    icon: GlobeAmericasIcon,
    link: '/state',
    color: 'bg-civic-700',
  },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/schools?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden bg-navy-900">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />

        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-800 border border-navy-700 mb-6">
              <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              <span className="text-sm text-navy-200 font-medium">2015-2024 Data Available</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Pennsylvania School
              <span className="block text-gold-400 mt-1">Data Explorer</span>
            </h1>

            <p className="mt-5 max-w-2xl mx-auto text-lg text-navy-300 leading-relaxed">
              Explore comprehensive PSSA and Keystone exam performance data for every public school
              across the Commonwealth of Pennsylvania.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mt-10 max-w-xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-500/20 to-civic-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center">
                  <MagnifyingGlassIcon className="absolute left-4 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a school or district..."
                    className="w-full pl-12 pr-28 py-4 rounded-xl bg-white text-stone-900 placeholder-stone-400 border-0 shadow-lg shadow-navy-950/40 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 px-5 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-stone-50 to-transparent" />
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="card-philly p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 p-2.5 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
                  <p className="text-sm text-stone-500">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">
            Explore Pennsylvania School Data
          </h2>
          <p className="mt-3 text-lg text-stone-500 max-w-2xl mx-auto">
            Access comprehensive data from state assessments and track performance over time
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <Link
                to={feature.link}
                className="block card-philly p-6 hover:shadow-md hover:border-stone-300/80 transition-all duration-300 group h-full"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${feature.color} mb-4`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 group-hover:text-navy-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">
                  {feature.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
