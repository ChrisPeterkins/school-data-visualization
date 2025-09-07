import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import StatsCard from '../components/StatsCard';

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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
              Pennsylvania School Data Explorer
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-primary-100 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Explore comprehensive performance data for Pennsylvania public schools. 
              View PSSA and Keystone exam results, track trends, and compare schools across the state.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mt-8 max-w-xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a school or district..."
                  className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 placeholder-gray-500 bg-white shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <MagnifyingGlassIcon className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                <button
                  type="submit"
                  className="absolute right-2 top-2 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Schools"
            value="3,000+"
            description="Public schools tracked"
            color="bg-blue-500"
          />
          <StatsCard
            title="Districts"
            value="500+"
            description="School districts"
            color="bg-green-500"
          />
          <StatsCard
            title="Students"
            value="1.7M"
            description="Students represented"
            color="bg-purple-500"
          />
          <StatsCard
            title="Data Years"
            value="2015-2024"
            description="Historical data available"
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Explore Pennsylvania School Data</h2>
          <p className="mt-4 text-lg text-gray-600">
            Access comprehensive data from state assessments and track performance over time
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">PSSA Results</div>
            <p className="text-gray-600">
              View Pennsylvania System of School Assessment results for grades 3-8 in Math, ELA, and Science.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">Keystone Exams</div>
            <p className="text-gray-600">
              Explore end-of-course assessment results in Algebra I, Biology, and Literature.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">Historical Trends</div>
            <p className="text-gray-600">
              Track school and district performance trends from 2015 to present.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">Compare Schools</div>
            <p className="text-gray-600">
              Compare performance metrics across multiple schools and districts.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">District Analysis</div>
            <p className="text-gray-600">
              Analyze district-wide performance and identify top-performing schools.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-xl font-semibold text-gray-900 mb-2">Export Data</div>
            <p className="text-gray-600">
              Download data in various formats for further analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}