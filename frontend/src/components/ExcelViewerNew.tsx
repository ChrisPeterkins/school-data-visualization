import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ReactGrid, Column, Row, DefaultCellTypes } from '@silevis/reactgrid';
import '@silevis/reactgrid/styles.css';

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
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
  rowCount: number;
  columnCount: number;
}

export default function ExcelViewerNew() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 500;

  // Fetch file list
  const { data: fileList } = useQuery({
    queryKey: ['excel-files'],
    queryFn: async () => {
      const { data } = await api.get<ExcelFile[]>('/api/files/list');
      return data;
    },
  });

  // Fetch selected file data
  const { data: excelData, isLoading, error } = useQuery({
    queryKey: ['excel-data', selectedFile, selectedSheet, currentPage],
    queryFn: async () => {
      if (!selectedFile) return null;
      const { data } = await api.get<ExcelData>('/api/files/data', {
        params: { file: selectedFile, page: currentPage, limit: pageSize },
        timeout: 30000,
      });
      return data;
    },
    enabled: !!selectedFile,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Group files by category
  const groupedFiles = fileList?.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {} as Record<string, ExcelFile[]>);

  // Convert Excel data to ReactGrid format
  const { columns, rows } = useMemo(() => {
    if (!excelData || !excelData.data || excelData.data.length === 0) {
      return { columns: [], rows: [] };
    }

    const headerRow = excelData.data[0] || [];
    const dataRows = excelData.data.slice(1);

    // Create columns from header
    const cols: Column[] = headerRow.map((_header, idx) => ({
      columnId: `col-${idx}`,
      width: 150,
      resizable: true,
    }));

    // Create header row
    const headerGridRow: Row<DefaultCellTypes> = {
      rowId: 'header',
      cells: headerRow.map((header, idx) => ({
        type: 'header' as const,
        text: header || `Column ${idx + 1}`,
      })),
    };

    // Create data rows - calculate actual row numbers based on page
    const startRowNumber = (excelData.page - 1) * excelData.limit + 2; // +2 because header is row 1
    const dataGridRows: Row<DefaultCellTypes>[] = dataRows.map((row, rowIdx) => ({
      rowId: `row-${startRowNumber + rowIdx}`,
      cells: row.map((cell) => ({
        type: 'text' as const,
        text: cell !== null && cell !== undefined ? String(cell) : '',
        nonEditable: true,
      })),
    }));

    return {
      columns: cols,
      rows: [headerGridRow, ...dataGridRows],
    };
  }, [excelData]);

  const handleChanges = () => {
    // Read-only grid, no changes allowed
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    setSelectedSheet(null);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

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
            onChange={(e) => handleFileSelect(e.target.value)}
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
                <span className="ml-2 font-semibold">{excelData.activeSheet}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Rows:</span>
                <span className="ml-2 font-semibold">{excelData.totalRows.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Columns:</span>
                <span className="ml-2 font-semibold">{excelData.columnCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {excelData && excelData.totalPages > 1 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {excelData.page} of {excelData.totalPages} ({excelData.totalRows.toLocaleString()} total rows)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={excelData.page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(excelData.page - 1)}
                disabled={excelData.page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(excelData.page + 1)}
                disabled={excelData.page === excelData.totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(excelData.totalPages)}
                disabled={excelData.page === excelData.totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Last
              </button>
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

      {/* Loading State */}
      {isLoading && !error && (
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading Excel data...</p>
        </div>
      )}

      {/* ReactGrid Data Table */}
      {excelData && !isLoading && !error && columns.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="overflow-auto" style={{ height: '600px' }}>
            <ReactGrid
              rows={rows}
              columns={columns}
              onCellsChanged={handleChanges}
              enableRowSelection
              enableColumnSelection
              stickyTopRows={1}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
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
