import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, performanceApi } from '../services/api';
import PerformanceChart from '../components/PerformanceChart';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', id],
    queryFn: () => schoolApi.getSchool(id!),
    enabled: !!id,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', id],
    queryFn: () => performanceApi.getTrends(id!),
    enabled: !!id,
  });

  if (schoolLoading || trendsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading school details...</p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">School not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">School ID: {school.schoolId}</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">District</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{school.districtId}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">School Type</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{school.schoolType || 'N/A'}</dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Grade Range</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{school.gradeRange || 'N/A'}</dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Enrollment</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {school.enrollment ? school.enrollment.toLocaleString() : 'N/A'}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {school.address && (
                  <>
                    {school.address}<br />
                    {school.city}, {school.state} {school.zipCode}
                  </>
                )}
                {!school.address && 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {trends && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Trends</h2>
          <PerformanceChart data={trends} />
        </div>
      )}
    </div>
  );
}