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

  // Get initial status
  const { data: initialStatus } = useQuery({
    queryKey: ['import-status'],
    queryFn: async () => {
      const { data } = await axios.get<ImportStatus>('/paschools/api/import/status');
      return data;
    },
    refetchInterval: status.isRunning ? 5000 : false,
  });

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const source = new EventSource('/paschools/api/import/status/stream');
    
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as ImportStatus;
      setStatus(data);
    };

    source.onerror = (error) => {
      console.error('SSE Error:', error);
      source.close();
    };

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
      await axios.post('/paschools/api/import/start');
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };

  const handleCancelImport = async () => {
    try {
      await axios.post('/paschools/api/import/cancel');
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
    if (status.errors && status.errors.length > 0) return 'bg-brick-500';
    if (status.progress === 100) return 'bg-civic-600';
    return 'bg-navy-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Data Import Progress</h1>
        <p className="mt-1 text-sm text-stone-500">
          Monitor the real-time progress of data imports from Pennsylvania Department of Education
        </p>
      </div>

      <div className="card-philly p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-2.5 h-2.5 rounded-full mr-3 ${status.isRunning ? 'bg-civic-500 animate-pulse' : 'bg-stone-400'}`}></div>
            <span className="text-base font-semibold text-stone-900">
              {status.isRunning ? 'Import in Progress' : 'Import Idle'}
            </span>
          </div>
          <div className="space-x-2">
            {!status.isRunning ? (
              <button onClick={handleStartImport} className="px-4 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 transition-colors">Start Import</button>
            ) : (
              <button onClick={handleCancelImport} className="px-4 py-2 bg-brick-500 text-white text-sm font-medium rounded-lg hover:bg-brick-600 transition-colors">Cancel Import</button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm text-stone-500 mb-2">
            <span>{status.currentStep || 'Ready to import'}</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
            <div className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressBarColor()}`} style={{ width: `${status.progress}%` }} />
          </div>
        </div>

        {status.currentFile && (
          <div className="mb-4 p-3 bg-navy-50 rounded-lg border border-navy-100">
            <span className="text-sm font-medium text-navy-800">Processing: {status.currentFile}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Files', value: `${status.processedFiles || 0} / ${status.totalFiles || 0}` },
            { label: 'Records Processed', value: (status.processedRecords || 0).toLocaleString() },
            { label: 'Start Time', value: formatTime(status.startTime) || '--:--:--' },
            { label: 'Errors', value: status.errors?.length || 0, error: (status.errors?.length || 0) > 0 },
          ].map((s, i) => (
            <div key={i} className="bg-stone-50 p-3 rounded-lg">
              <div className="text-xs text-stone-500 uppercase tracking-wider">{s.label}</div>
              <div className={`text-xl font-bold mt-1 ${s.error ? 'text-brick-600' : 'text-stone-900'}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {status.errors && status.errors.length > 0 && (
          <div className="mt-4 p-3 bg-brick-50 rounded-lg border border-brick-200">
            <h4 className="text-sm font-medium text-brick-800 mb-2">Errors:</h4>
            <ul className="text-sm text-brick-700 space-y-1">
              {status.errors.map((error, idx) => (<li key={idx}>- {error}</li>))}
            </ul>
          </div>
        )}
      </div>

      {status.stats && (
        <div className="card-philly p-6">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Database Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: status.stats.pssaRecords, label: 'PSSA Records', color: 'text-navy-600' },
              { value: status.stats.keystoneRecords, label: 'Keystone Records', color: 'text-civic-700' },
              { value: status.stats.schools, label: 'Schools', color: 'text-gold-700' },
              { value: status.stats.districts, label: 'Districts', color: 'text-brick-600' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-stone-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="text-xs text-stone-400 text-center">Last Updated: {new Date(status.stats.lastUpdate).toLocaleString()}</div>
          </div>
        </div>
      )}

      {status.isRunning && (
        <div className="mt-6 flex justify-center">
          <div className="relative">
            <div className="w-32 h-32">
              <svg className="transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="12" fill="none" className="text-stone-200" />
                <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="12" fill="none"
                  strokeDasharray={`${2 * Math.PI * 54}`} strokeDashoffset={`${2 * Math.PI * 54 * (1 - (status.progress || 0) / 100)}`}
                  className="text-navy-600 transition-all duration-500" />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-stone-900">{status.progress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}