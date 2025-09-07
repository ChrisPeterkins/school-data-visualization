import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface ImportStatus {
  isRunning: boolean;
  currentFile?: string;
  currentStep?: string;
  totalFiles?: number;
  processedFiles?: number;
  totalRecords?: number;
  processedRecords?: number;
  errors?: string[];
  startTime?: Date;
  progress?: number;
  stats?: {
    pssaRecords: number;
    keystoneRecords: number;
    schools: number;
    districts: number;
    lastUpdate: Date;
  };
}

export default function ImportProgressPage() {
  const [status, setStatus] = useState<ImportStatus>({ isRunning: false, progress: 0 });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Get initial status
  const { data: initialStatus } = useQuery({
    queryKey: ['import-status'],
    queryFn: async () => {
      const { data } = await axios.get<ImportStatus>('http://localhost:3000/api/import/status');
      return data;
    },
    refetchInterval: status.isRunning ? 5000 : false,
  });

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const source = new EventSource('http://localhost:3000/api/import/status/stream');
    
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as ImportStatus;
      setStatus(data);
    };

    source.onerror = (error) => {
      console.error('SSE Error:', error);
      source.close();
    };

    setEventSource(source);

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const handleStartImport = async () => {
    try {
      await axios.post('http://localhost:3000/api/import/start');
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };

  const handleCancelImport = async () => {
    try {
      await axios.post('http://localhost:3000/api/import/cancel');
    } catch (error) {
      console.error('Failed to cancel import:', error);
    }
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString();
  };

  const getProgressBarColor = () => {
    if (status.errors && status.errors.length > 0) return 'bg-red-600';
    if (status.progress === 100) return 'bg-green-600';
    return 'bg-blue-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Import Progress</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor the real-time progress of data imports from Pennsylvania Department of Education
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${status.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-lg font-semibold">
              {status.isRunning ? 'Import in Progress' : 'Import Idle'}
            </span>
          </div>
          
          <div className="space-x-2">
            {!status.isRunning ? (
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Import
              </button>
            ) : (
              <button
                onClick={handleCancelImport}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Cancel Import
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{status.currentStep || 'Ready to import'}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressBarColor()}`}
              style={{ width: `${status.progress}%` }}
            >
              <div className="h-full bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Current File */}
        {status.currentFile && (
          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="text-sm font-medium text-blue-900">Processing: {status.currentFile}</span>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500">Files</div>
            <div className="text-xl font-bold text-gray-900">
              {status.processedFiles || 0} / {status.totalFiles || 0}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500">Records Processed</div>
            <div className="text-xl font-bold text-gray-900">
              {(status.processedRecords || 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500">Start Time</div>
            <div className="text-xl font-bold text-gray-900">
              {formatTime(status.startTime) || '--:--:--'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-xs text-gray-500">Errors</div>
            <div className={`text-xl font-bold ${status.errors?.length ? 'text-red-600' : 'text-gray-900'}`}>
              {status.errors?.length || 0}
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {status.errors && status.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-md">
            <h4 className="text-sm font-medium text-red-900 mb-2">Errors:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {status.errors.map((error, idx) => (
                <li key={idx}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Database Statistics */}
      {status.stats && (
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Database Statistics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {status.stats.pssaRecords.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">PSSA Records</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {status.stats.keystoneRecords.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Keystone Records</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {status.stats.schools.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Schools</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {status.stats.districts.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Districts</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500 text-center">
              Last Updated: {new Date(status.stats.lastUpdate).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Visual Progress Indicator */}
      {status.isRunning && (
        <div className="mt-6 flex justify-center">
          <div className="relative">
            <div className="w-32 h-32">
              <svg className="transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - (status.progress || 0) / 100)}`}
                  className="text-blue-600 transition-all duration-500"
                />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{status.progress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}