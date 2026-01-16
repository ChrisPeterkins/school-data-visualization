import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface ExcelFile {
  path: string;
  name: string;
  category: string;
  type: string;
}

interface ExcelData {
  fileName: string;
  sheets: string[];
  activeSheet: string;
  data: any[][];
  rowCount: number;
  columnCount: number;
}

export default function ExcelViewer() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  // Fetch file list
  const { data: fileList } = useQuery({
    queryKey: ['excel-files'],
    queryFn: async () => {
      const { data } = await axios.get<ExcelFile[]>('/paschools/api/files/list');
      return data;
    },
  });

  // Fetch selected file data
  const { data: excelData, isLoading, error } = useQuery({
    queryKey: ['excel-data', selectedFile, selectedSheet],
    queryFn: async () => {
      if (!selectedFile) return null;
      const endpoint = selectedSheet
        ? `/paschools/api/files/sheet?file=${encodeURIComponent(selectedFile)}&sheet=${encodeURIComponent(selectedSheet)}`
        : `/paschools/api/files/data?file=${encodeURIComponent(selectedFile)}`;
      const { data } = await axios.get<ExcelData>(endpoint, {
        timeout: 30000, // 30 second timeout
      });
      return data;
    },
    enabled: !!selectedFile,
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Group files by category
  const groupedFiles = fileList?.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {} as Record<string, ExcelFile[]>);

  useEffect(() => {
    if (excelData && !selectedSheet) {
      setSelectedSheet(excelData.activeSheet);
    }
  }, [excelData, selectedSheet]);

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Excel File Viewer</h2>
        <p className="text-sm text-gray-600 mb-4">
          Browse and inspect the raw source Excel files
        </p>

        {/* File Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File
          </label>
          <select
            value={selectedFile || ''}
            onChange={(e) => {
              setSelectedFile(e.target.value);
              setSelectedSheet(null);
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose a file --</option>
            {groupedFiles && Object.entries(groupedFiles).map(([category, files]) => (
              <optgroup key={category} label={category}>
                {files.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Sheet Selector */}
        {excelData && excelData.sheets.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Sheet
            </label>
            <select
              value={selectedSheet || ''}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {excelData.sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* File Info */}
        {excelData && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-gray-600">File:</span>
                <span className="ml-2 font-semibold">{excelData.fileName}</span>
              </div>
              <div>
                <span className="text-gray-600">Sheet:</span>
                <span className="ml-2 font-semibold">{selectedSheet}</span>
              </div>
              <div>
                <span className="text-gray-600">Rows:</span>
                <span className="ml-2 font-semibold">{excelData.rowCount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Columns:</span>
                <span className="ml-2 font-semibold">{excelData.columnCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-semibold">Error loading Excel file</span>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Failed to load file. Please try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Data Table */}
      {isLoading && !error && (
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading Excel data... (this may take a few seconds for large files)</p>
        </div>
      )}

      {excelData && !isLoading && !error && excelData.data && Array.isArray(excelData.data) && excelData.data.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {(excelData.data[0] && Array.isArray(excelData.data[0]) ? excelData.data[0] : []).map((header: any, index: number) => (
                    <th
                      key={index}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap"
                    >
                      {header || `Col ${index + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {excelData.data.slice(1, 101).map((row: any[], rowIndex: number) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {(Array.isArray(row) ? row : []).map((cell: any, cellIndex: number) => (
                      <td
                        key={cellIndex}
                        className="px-4 py-2 text-sm text-gray-900 border-r border-gray-100 whitespace-nowrap"
                      >
                        {cell !== null && cell !== undefined ? String(cell) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {excelData.rowCount > 101 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-600">
              Showing first 100 rows of {excelData.rowCount.toLocaleString()} total rows
            </div>
          )}
        </div>
      )}

      {excelData && !isLoading && !error && (!excelData.data || !Array.isArray(excelData.data) || excelData.data.length === 0) && (
        <div className="p-12 text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4">No data found in this file</p>
        </div>
      )}

      {!selectedFile && !isLoading && !error && (
        <div className="p-12 text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4">Select a file to view its contents</p>
        </div>
      )}
    </div>
  );
}
