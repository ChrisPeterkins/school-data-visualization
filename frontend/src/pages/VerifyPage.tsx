import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ExcelViewerNew from '../components/ExcelViewerNew';

interface FileResult {
  fileName: string;
  status: 'pass' | 'fail';
  sourceRowCount: number;
  dbRowCount: number;
  discrepancy: number;
  timestamp: Date;
}

interface VerificationStatus {
  isRunning: boolean;
  currentFile?: string;
  currentStep?: string;
  totalFiles?: number;
  processedFiles?: number;
  filesPassed?: number;
  filesFailed?: number;
  progress?: number;
  errors?: string[];
  startTime?: Date;
  fileResults?: FileResult[];
  report?: {
    timestamp: Date;
    totalFiles: number;
    filesVerified: number;
    filesPassed: number;
    filesFailed: number;
    summary: {
      totalSourceRecords: number;
      totalDbRecords: number;
      overallMatch: boolean;
      criticalIssues: string[];
    };
  };
}

export default function VerifyPage() {
  const [status, setStatus] = useState<VerificationStatus>({ isRunning: false, progress: 0 });

  // Get initial status
  const { data: initialStatus } = useQuery({
    queryKey: ['verification-status'],
    queryFn: async () => {
      const { data } = await axios.get<VerificationStatus>('/paschools/api/verify/status');
      return data;
    },
    refetchInterval: status.isRunning ? 5000 : false,
  });

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const source = new EventSource('/paschools/api/verify/status/stream');

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as VerificationStatus;
      setStatus(data);
    };

    source.onerror = () => {
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

  const handleStartVerification = async () => {
    try {
      await axios.post('/paschools/api/verify/start');
    } catch (error) {
      console.error('Failed to start verification:', error);
    }
  };

  const handleCancelVerification = async () => {
    try {
      await axios.post('/paschools/api/verify/cancel');
    } catch (error) {
      console.error('Failed to cancel verification:', error);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const response = await axios.get('/paschools/api/verify/report', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `verification-report-${new Date().toISOString()}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const getProgressBarColor = () => {
    if (status.errors && status.errors.length > 0) return 'bg-brick-500';
    if (status.progress === 100) {
      return status.report?.summary.overallMatch ? 'bg-civic-600' : 'bg-gold-500';
    }
    return 'bg-navy-600';
  };

  const getStatusIcon = () => {
    if (!status.report) return null;

    if (status.report.summary.overallMatch) {
      return (
        <svg className="w-8 h-8 text-civic-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-8 h-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Data Verification</h1>
        <p className="mt-2 text-sm text-stone-500">
          Verify that database records match the source Excel files
        </p>
      </div>

      {/* Status Card */}
      <div className="card-surface p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${status.isRunning ? 'bg-civic-500 animate-pulse' : 'bg-stone-400'}`}></div>
            <span className="text-lg font-semibold">
              {status.isRunning ? 'Verification in Progress' : 'Verification Idle'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {!status.isRunning ? (
              <button
                onClick={handleStartVerification}
                className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-600 transition-colors"
              >
                Start Verification
              </button>
            ) : (
              <button
                onClick={handleCancelVerification}
                className="px-4 py-2 bg-brick-500 text-white rounded-lg hover:bg-brick-600 transition-colors"
              >
                Cancel
              </button>
            )}
            {status.report && (
              <button
                onClick={handleDownloadReport}
                className="px-4 py-2 bg-stone-600 text-white rounded-lg hover:bg-stone-500 transition-colors"
              >
                Download Report
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-stone-500 mb-2">
            <span>{status.currentStep || 'Ready to verify'}</span>
            <span>{status.progress || 0}%</span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressBarColor()}`}
              style={{ width: `${status.progress || 0}%` }}
            >
              <div className="h-full bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Current File */}
        {status.currentFile && (
          <div className="mb-4 p-3 bg-navy-50 rounded-md">
            <div className="text-sm font-medium text-navy-900">Currently Verifying:</div>
            <div className="text-sm text-navy-700">{status.currentFile}</div>
          </div>
        )}

        {/* Progress Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-stone-50 p-3 rounded-md">
            <div className="text-sm text-stone-500">Files Verified</div>
            <div className="text-2xl font-bold text-stone-900">
              {status.processedFiles || 0} / {status.totalFiles || 0}
            </div>
          </div>
          <div className="bg-civic-50 p-3 rounded-md">
            <div className="text-sm text-civic-700">Passed</div>
            <div className="text-2xl font-bold text-civic-700">{status.filesPassed || 0}</div>
          </div>
          <div className="bg-brick-50 p-3 rounded-md">
            <div className="text-sm text-brick-600">Failed</div>
            <div className="text-2xl font-bold text-brick-700">{status.filesFailed || 0}</div>
          </div>
          <div className="bg-navy-50 p-3 rounded-md">
            <div className="text-sm text-navy-600">Status</div>
            <div className="text-lg font-bold text-navy-700">
              {status.isRunning ? 'Running' : 'Idle'}
            </div>
          </div>
        </div>

        {/* Errors */}
        {status.errors && status.errors.length > 0 && (
          <div className="mt-4 p-4 bg-brick-50 border border-brick-200 rounded-md">
            <div className="font-semibold text-brick-800 mb-2">Errors:</div>
            <ul className="text-sm text-brick-700 space-y-1">
              {status.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* File Results Log */}
      {status.fileResults && status.fileResults.length > 0 && (
        <div className="card-surface p-6 mb-6">
          <h2 className="text-xl font-bold text-stone-900 mb-4">
            File Verification Log ({status.fileResults.length} files)
          </h2>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-stone-600 uppercase">Source Records</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-stone-600 uppercase">DB Records</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-stone-600 uppercase">Difference</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-200">
                {status.fileResults.map((result, index) => (
                  <tr key={index} className={result.status === 'pass' ? 'bg-civic-50/50' : 'bg-brick-50/50'}>
                    <td className="px-4 py-2 text-sm text-stone-900 whitespace-nowrap">
                      {result.fileName}
                    </td>
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {result.status === 'pass' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-civic-100 text-civic-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brick-100 text-brick-700">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Fail
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-stone-900 text-right whitespace-nowrap">
                      {result.sourceRowCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-stone-900 text-right whitespace-nowrap">
                      {result.dbRowCount.toLocaleString()}
                    </td>
                    <td className={`px-4 py-2 text-sm text-right whitespace-nowrap font-medium ${
                      result.discrepancy === 0 ? 'text-civic-700' :
                      result.discrepancy < 0 ? 'text-navy-700' : 'text-gold-700'
                    }`}>
                      {result.discrepancy > 0 ? '+' : ''}{result.discrepancy.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report Summary */}
      {status.report && (
        <div className="card-surface p-6">
          <div className="flex items-center mb-4">
            {getStatusIcon()}
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 ml-3">Verification Report</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">File Summary</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-stone-500">Total Files:</dt>
                  <dd className="font-semibold">{status.report.totalFiles}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Files Verified:</dt>
                  <dd className="font-semibold">{status.report.filesVerified}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-civic-600">Files Passed:</dt>
                  <dd className="font-semibold text-civic-700">{status.report.filesPassed}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-brick-600">Files Failed:</dt>
                  <dd className="font-semibold text-brick-700">{status.report.filesFailed}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-3">Record Summary</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-stone-500">Source Records:</dt>
                  <dd className="font-semibold">{status.report.summary.totalSourceRecords.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Database Records:</dt>
                  <dd className="font-semibold">{status.report.summary.totalDbRecords.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Difference:</dt>
                  <dd className={`font-semibold ${
                    status.report.summary.totalSourceRecords === status.report.summary.totalDbRecords
                      ? 'text-civic-700'
                      : 'text-gold-700'
                  }`}>
                    {(status.report.summary.totalSourceRecords - status.report.summary.totalDbRecords).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-500">Overall Match:</dt>
                  <dd className={`font-semibold ${status.report.summary.overallMatch ? 'text-civic-700' : 'text-gold-700'}`}>
                    {status.report.summary.overallMatch ? '✓ YES' : '⚠ NO'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Critical Issues */}
          {status.report.summary.criticalIssues && status.report.summary.criticalIssues.length > 0 && (
            <div className="mt-6 p-4 bg-gold-50 border border-gold-200 rounded-md">
              <h3 className="font-semibold text-gold-900 mb-2">Critical Issues:</h3>
              <ul className="text-sm text-gold-800 space-y-1">
                {status.report.summary.criticalIssues.map((issue, index) => (
                  <li key={index}>⚠ {issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success Message */}
          {status.report.summary.overallMatch && (
            <div className="mt-6 p-4 bg-civic-50 border border-civic-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-civic-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-civic-900">
                  Data integrity verified! All source files match database records.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Excel File Viewer */}
      <div className="mt-8">
        <ExcelViewerNew />
      </div>
    </div>
  );
}
