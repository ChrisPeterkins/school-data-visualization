import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { MagnifyingGlassIcon, XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

const COMPARE_COLORS = ['#2d4a6f', '#27ab83', '#d4aa3c', '#c53030', '#4a6d8c'];

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  borderRadius: '0.5rem',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

export default function ComparePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [year, setYear] = useState(2024);

  const { data: searchResults } = useQuery({
    queryKey: ['school-search', searchTerm],
    queryFn: () => schoolApi.getSchools({ search: searchTerm, limit: 50 }),
    enabled: searchTerm.length >= 2,
  });

  const { data: performanceData } = useQuery({
    queryKey: ['compare-performance', selectedSchools.map(s => s.id), year],
    queryFn: async () => {
      const results = await Promise.all(
        selectedSchools.map(school =>
          performanceApi.getPSSAResults({ schoolId: school.id, year, level: 'school' })
            .then(data => ({ school, data }))
        )
      );
      return results;
    },
    enabled: selectedSchools.length > 0,
  });

  const addSchool = (school: any) => {
    if (selectedSchools.length < 5 && !selectedSchools.find(s => s.id === school.id)) {
      setSelectedSchools([...selectedSchools, school]);
      setSearchTerm('');
      setShowSearch(false);
    }
  };

  const removeSchool = (id: number) => {
    setSelectedSchools(selectedSchools.filter(s => s.id !== id));
  };

  const processComparisonData = () => {
    if (!performanceData) return { barData: [], radarData: [] };
    const subjects = ['Mathematics', 'English Language Arts', 'Science'];
    const barData = subjects.map(subject => {
      const subjectData: any = { subject };
      performanceData.forEach(({ school, data }) => {
        const subjectResults = data.filter((d: any) => d.subject === subject && d.proficientOrAbovePercent != null);
        if (subjectResults.length > 0) {
          const avg = subjectResults.reduce((sum: number, d: any) => sum + d.proficientOrAbovePercent, 0) / subjectResults.length;
          subjectData[school.name] = parseFloat(avg.toFixed(1));
        }
      });
      return subjectData;
    });
    const radarData = selectedSchools.map(school => {
      const schoolPerf = performanceData.find(p => p.school.id === school.id);
      if (!schoolPerf) return null;
      const metrics: any = { school: school.name };
      subjects.forEach(subject => {
        const subjectResults = schoolPerf.data.filter((d: any) => d.subject === subject && d.proficientOrAbovePercent != null);
        if (subjectResults.length > 0) {
          const avg = subjectResults.reduce((sum: number, d: any) => sum + d.proficientOrAbovePercent, 0) / subjectResults.length;
          metrics[subject] = parseFloat(avg.toFixed(1));
        }
      });
      return metrics;
    }).filter(Boolean);
    return { barData, radarData };
  };

  const { barData, radarData } = processComparisonData();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start gap-4 mb-8">
          <div className="p-2.5 rounded-xl bg-navy-100">
            <ArrowsRightLeftIcon className="w-6 h-6 text-navy-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Compare Schools</h1>
            <p className="mt-1 text-sm text-stone-500">Compare academic performance across multiple schools (up to 5)</p>
          </div>
        </div>

        {/* Controls */}
        <div className="card-philly p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-stone-500">Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500">
                {[2024, 2023, 2022, 2021, 2019, 2018, 2017, 2016, 2015].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              onClick={() => setShowSearch(true)}
              disabled={selectedSchools.length >= 5}
              className="px-4 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Add School ({selectedSchools.length}/5)
            </button>
          </div>

          {/* Search Panel */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-4"
              >
                <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search for a school..."
                      className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                      autoFocus
                    />
                  </div>
                  {searchResults && searchResults.data.length > 0 && (
                    <ul className="mt-2 max-h-48 overflow-auto divide-y divide-stone-100 border border-stone-200 rounded-lg bg-white">
                      {searchResults.data.map((school: any) => (
                        <li key={school.id}>
                          <button
                            onClick={() => addSchool(school)}
                            disabled={!!selectedSchools.find(s => s.id === school.id)}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 disabled:opacity-40 transition-colors"
                          >
                            <div className="font-medium text-stone-900">{school.name}</div>
                            <div className="text-xs text-stone-500">{school.districtName}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected Schools Chips */}
          <div className="flex flex-wrap gap-2">
            {selectedSchools.map((school, index) => (
              <motion.div
                key={school.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full"
                style={{ borderColor: COMPARE_COLORS[index] }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                <span className="text-sm font-medium text-stone-700">{school.name}</span>
                <button onClick={() => removeSchool(school.id)} className="text-stone-400 hover:text-stone-600 transition-colors">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Charts */}
        {selectedSchools.length > 0 && performanceData ? (
          <div className="space-y-6">
            <div className="card-philly p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Subject Performance ({year})</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#78716c' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }}
                    label={{ value: '% Proficient or Above', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#78716c' } }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {selectedSchools.map((school, index) => (
                    <Bar key={school.id} dataKey={school.name} fill={COMPARE_COLORS[index]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {radarData.length > 0 && (
              <div className="card-philly p-6">
                <h2 className="text-base font-semibold text-stone-900 mb-4">Performance Profile ({year})</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarData[0] ? Object.keys(radarData[0])
                    .filter(k => k !== 'school')
                    .map(subject => {
                      const point: any = { subject };
                      radarData.forEach((d: any) => { point[d.school] = d[subject] || 0; });
                      return point;
                    }) : []}>
                    <PolarGrid stroke="#e7e5e4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#78716c' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#a8a29e' }} />
                    {selectedSchools.map((school, index) => (
                      <Radar key={school.id} name={school.name} dataKey={school.name}
                        stroke={COMPARE_COLORS[index]} fill={COMPARE_COLORS[index]} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Summary Table */}
            <div className="card-philly overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="text-base font-semibold text-stone-900">Summary ({year})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-stone-50/80 border-b border-stone-200">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">School</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Math</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">ELA</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Science</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedSchools.map((school, index) => {
                      const schoolData = barData.reduce((acc: any, subject: any) => {
                        acc[subject.subject] = subject[school.name] || 0;
                        return acc;
                      }, {});
                      const values = Object.values(schoolData).filter((v: any) => v > 0) as number[];
                      const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : NaN;

                      return (
                        <tr key={school.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                              <span className="text-sm font-medium text-stone-900">{school.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center text-sm text-stone-600">{schoolData['Mathematics']?.toFixed(1) || 'N/A'}%</td>
                          <td className="px-5 py-3.5 text-center text-sm text-stone-600">{schoolData['English Language Arts']?.toFixed(1) || 'N/A'}%</td>
                          <td className="px-5 py-3.5 text-center text-sm text-stone-600">{schoolData['Science']?.toFixed(1) || 'N/A'}%</td>
                          <td className="px-5 py-3.5 text-center text-sm font-semibold text-navy-600">{isNaN(avg) ? 'N/A' : `${avg.toFixed(1)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : selectedSchools.length === 0 ? (
          <div className="card-philly p-12 text-center">
            <ArrowsRightLeftIcon className="w-10 h-10 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Select up to 5 schools to compare their academic performance</p>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
