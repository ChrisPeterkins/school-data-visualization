import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import { useAvailableYears } from '../hooks/useAvailableYears';
import { useIsSmUp } from '../hooks/useMediaQuery';
import FilterSelect from '../components/FilterSelect';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import { MagnifyingGlassIcon, XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

const COMPARE_COLORS = ['#2d4a6f', '#27ab83', '#c53030', '#4a6d8c', '#199473'];
const STATE_COLOR = '#d4aa3c'; // gold is reserved for the state-average reference
const SUBJECTS = ['Mathematics', 'English Language Arts', 'Science'];
const SUBJECT_SHORT: Record<string, string> = { 'Mathematics': 'Math', 'English Language Arts': 'ELA', 'Science': 'Science' };

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
  const { years, latest } = useAvailableYears();
  const smUp = useIsSmUp();
  const chartHeight = smUp ? 400 : 300;
  // null = latest year in the database; becomes a number once the user picks one.
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const year = yearChoice ?? latest;

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
    enabled: selectedSchools.length > 0 && year != null,
  });

  // Statewide proficiency per subject for the same year (grade 0 = PDE's "Total").
  const { data: statePerformance } = useQuery({
    queryKey: ['state-performance', year],
    queryFn: () => performanceApi.getStatePerformance(year!),
    enabled: year != null,
  });
  const stateBySubject: Record<string, number> = {};
  (statePerformance?.pssa ?? []).forEach((r: any) => {
    if (r.grade === 0 && r.avgProficientOrAbove != null) {
      stateBySubject[r.subject] = parseFloat(r.avgProficientOrAbove.toFixed(1));
    }
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
    if (!performanceData) return { barData: [] };
    const barData = SUBJECTS.map(subject => {
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
    return { barData };
  };

  const { barData } = processComparisonData();

  // Dot plot rows: one point per school per subject, plus the state average.
  const dotSeries = selectedSchools.map((school) => ({
    name: school.name,
    data: barData
      .filter((row: any) => row[school.name] != null)
      .map((row: any) => ({ subject: SUBJECT_SHORT[row.subject] ?? row.subject, value: row[school.name] })),
  }));
  const stateSeries = SUBJECTS
    .filter((s) => stateBySubject[s] != null)
    .map((s) => ({ subject: SUBJECT_SHORT[s], value: stateBySubject[s] }));
  const stateAverageOfAverages = stateSeries.length
    ? stateSeries.reduce((sum, d) => sum + d.value, 0) / stateSeries.length
    : NaN;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Compare Schools</h1>
            <p className="mt-1 text-sm text-stone-500">Compare academic performance across multiple schools (up to 5)</p>
          </div>

        {/* Controls */}
        <div className="card-surface p-5 mb-6">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4 mb-4">
            <FilterSelect label="Year" value={year ?? ''} onChange={(e) => setYearChoice(Number(e.target.value))} fluid={false}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </FilterSelect>
            <button
              onClick={() => setShowSearch(true)}
              disabled={selectedSchools.length >= 5}
              className="px-4 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Add School ({selectedSchools.length}/5)
            </button>
          </div>

          {/* Search Panel */}
          {showSearch && (
              <div className="mb-4">
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
              </div>
            )}

          {/* Selected Schools Chips */}
          <div className="flex flex-wrap gap-2">
            {selectedSchools.map((school, index) => (
              <div
                key={school.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full"
                style={{ borderColor: COMPARE_COLORS[index] }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                <span className="text-sm font-medium text-stone-700">{school.name}</span>
                <button onClick={() => removeSchool(school.id)} className="text-stone-400 hover:text-stone-600 transition-colors">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        {selectedSchools.length > 0 && performanceData ? (
          <div className="space-y-6">
            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Subject Performance ({year})</h2>
              <ResponsiveContainer width="100%" height={chartHeight}>
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

            <div className="card-surface p-4 sm:p-6">
              <h2 className="text-base font-semibold text-stone-900 mb-1">Schools vs. State Average ({year})</h2>
              <p className="text-xs text-stone-400 mb-4">Each dot is a school's % proficient or above; the gold diamond is the statewide figure</p>
              <ResponsiveContainer width="100%" height={smUp ? 260 : 220}>
                <ScatterChart margin={{ top: 10, right: smUp ? 30 : 16, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis type="number" dataKey="value" domain={[0, 100]} tick={{ fontSize: 12, fill: '#78716c' }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="subject" allowDuplicatedCategory={false} width={smUp ? 80 : 60} tick={{ fontSize: 12, fill: '#57534e' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Proficient or above']} cursor={{ strokeDasharray: '3 3' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {dotSeries.map((series, index) => (
                    <Scatter key={series.name} name={series.name} data={series.data} fill={COMPARE_COLORS[index]} />
                  ))}
                  {stateSeries.length > 0 && (
                    <Scatter name="State average" data={stateSeries} fill={STATE_COLOR} shape="diamond" />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Table */}
            <div className="card-surface overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="text-base font-semibold text-stone-900">Summary ({year})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-stone-50/80 border-b border-stone-200">
                      <th className="px-3 sm:px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">School</th>
                      <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Math</th>
                      <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">ELA</th>
                      <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Science</th>
                      <th className="px-3 sm:px-5 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Average</th>
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
                          <td className="px-3 sm:px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                              <span className="text-sm font-medium text-stone-900">{school.name}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{schoolData['Mathematics'] ? `${schoolData['Mathematics'].toFixed(1)}%` : 'N/A'}</td>
                          <td className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{schoolData['English Language Arts'] ? `${schoolData['English Language Arts'].toFixed(1)}%` : 'N/A'}</td>
                          <td className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">{schoolData['Science'] ? `${schoolData['Science'].toFixed(1)}%` : 'N/A'}</td>
                          <td className="px-3 sm:px-5 py-3.5 text-center text-sm font-semibold text-navy-600 whitespace-nowrap">{isNaN(avg) ? 'N/A' : `${avg.toFixed(1)}%`}</td>
                        </tr>
                      );
                    })}
                    {stateSeries.length > 0 && (
                      <tr className="bg-stone-50/80">
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: STATE_COLOR }} />
                            <span className="text-sm font-medium text-stone-700">State average</span>
                          </div>
                        </td>
                        {SUBJECTS.map((s) => (
                          <td key={s} className="px-3 sm:px-5 py-3.5 text-center text-sm text-stone-600 whitespace-nowrap">
                            {stateBySubject[s] != null ? `${stateBySubject[s].toFixed(1)}%` : 'N/A'}
                          </td>
                        ))}
                        <td className="px-3 sm:px-5 py-3.5 text-center text-sm font-semibold text-stone-700 whitespace-nowrap">
                          {isNaN(stateAverageOfAverages) ? 'N/A' : `${stateAverageOfAverages.toFixed(1)}%`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : selectedSchools.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <ArrowsRightLeftIcon className="w-10 h-10 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Select up to 5 schools to compare their academic performance</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
