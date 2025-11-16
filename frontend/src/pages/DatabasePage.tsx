import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ReactGrid, Column, Row, Cell, CellChange } from '@silevis/reactgrid';
import '@silevis/reactgrid/styles.css';

interface TableInfo {
  name: string;
  label: string;
  recordCount: number;
}

interface TableSchema {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: any;
  primaryKey: boolean;
}

interface TableData {
  tableName: string;
  data: any[];
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [customQuery, setCustomQuery] = useState('');
  const [queryMode, setQueryMode] = useState<'table' | 'custom'>('table');
  const pageSize = 100;

  // Fetch table list
  const { data: tables } = useQuery({
    queryKey: ['database-tables'],
    queryFn: async () => {
      const { data } = await axios.get<TableInfo[]>('/pa-school-data-visualization/api/database/tables');
      return data;
    },
  });

  // Fetch table schema
  const { data: schema } = useQuery({
    queryKey: ['database-schema', selectedTable],
    queryFn: async () => {
      const { data } = await axios.get<TableSchema[]>(
        `/pa-school-data-visualization/api/database/schema/${selectedTable}`
      );
      return data;
    },
    enabled: !!selectedTable && queryMode === 'table',
  });

  // Fetch table data
  const { data: tableData, isLoading, error } = useQuery({
    queryKey: ['database-data', selectedTable, currentPage],
    queryFn: async () => {
      const { data } = await axios.get<TableData>(
        `/pa-school-data-visualization/api/database/data/${selectedTable}?page=${currentPage}&limit=${pageSize}`
      );
      return data;
    },
    enabled: !!selectedTable && queryMode === 'table',
    retry: 1,
  });

  // Execute custom query
  const { data: queryResult, isLoading: queryLoading, error: queryError, refetch: executeQuery } = useQuery({
    queryKey: ['database-query', customQuery],
    queryFn: async () => {
      const { data } = await axios.post('/pa-school-data-visualization/api/database/query', {
        query: customQuery,
      });
      return data;
    },
    enabled: false, // Manual execution only
  });

  // Convert table data to ReactGrid format
  const { columns, rows } = useMemo(() => {
    const dataSource = queryMode === 'custom' ? queryResult?.results : tableData?.data;

    if (!dataSource || dataSource.length === 0) {
      return { columns: [], rows: [] };
    }

    const firstRow = dataSource[0];
    const columnNames = Object.keys(firstRow);

    // Create columns
    const cols: Column[] = columnNames.map((name) => ({
      columnId: name,
      width: 150,
      resizable: true,
    }));

    // Create header row
    const headerRow: Row = {
      rowId: 'header',
      cells: columnNames.map((name) => ({
        type: 'header',
        text: name,
      } as Cell)),
    };

    // Create data rows
    const dataRows: Row[] = dataSource.map((record: any, idx: number) => ({
      rowId: `row-${idx}`,
      cells: columnNames.map((colName) => ({
        type: 'text',
        text: record[colName] !== null && record[colName] !== undefined ? String(record[colName]) : '',
        nonEditable: true,
      } as Cell)),
    }));

    return {
      columns: cols,
      rows: [headerRow, ...dataRows],
    };
  }, [tableData, queryResult, queryMode]);

  const handleChanges = (changes: CellChange[]) => {
    // Read-only grid
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(1);
    setQueryMode('table');
  };

  const handleExecuteQuery = () => {
    if (customQuery.trim()) {
      setQueryMode('custom');
      executeQuery();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Database Viewer</h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse raw database tables and execute read-only SQL queries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-lg rounded-lg p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tables</h2>
            <div className="space-y-2">
              {tables?.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleTableSelect(table.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTable === table.name && queryMode === 'table'
                      ? 'bg-blue-100 text-blue-900 font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div>{table.label}</div>
                  <div className="text-xs text-gray-500">
                    {table.recordCount.toLocaleString()} records
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Query Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Custom Query</h3>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM pssa_results LIMIT 10"
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs font-mono h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleExecuteQuery}
                disabled={!customQuery.trim()}
                className="mt-2 w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Execute Query
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Only SELECT queries allowed
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Table Info Header */}
            {queryMode === 'table' && tableData && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {tables?.find((t) => t.name === selectedTable)?.label}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {tableData.totalRecords.toLocaleString()} total records
                    </p>
                  </div>
                  {tableData.totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Page {tableData.page} of {tableData.totalPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={tableData.page === 1}
                          className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => p - 1)}
                          disabled={tableData.page === 1}
                          className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => p + 1)}
                          disabled={tableData.page === tableData.totalPages}
                          className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => setCurrentPage(tableData.totalPages)}
                          disabled={tableData.page === tableData.totalPages}
                          className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Schema Info */}
                {schema && schema.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                      View Table Schema ({schema.length} columns)
                    </summary>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {schema.map((col) => (
                        <div key={col.name} className="bg-white p-2 rounded border">
                          <div className="font-semibold flex items-center gap-1">
                            {col.name}
                            {col.primaryKey && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">PK</span>
                            )}
                          </div>
                          <div className="text-gray-600">
                            {col.type} {col.notNull && '(NOT NULL)'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Query Result Header */}
            {queryMode === 'custom' && queryResult && (
              <div className="p-4 border-b border-gray-200 bg-green-50">
                <h2 className="text-lg font-bold text-gray-900">Query Results</h2>
                <p className="text-sm text-gray-600">
                  {queryResult.rowCount.toLocaleString()} rows returned
                </p>
                <div className="mt-2 p-2 bg-white rounded border text-xs font-mono overflow-x-auto">
                  {queryResult.query}
                </div>
              </div>
            )}

            {/* Error Display */}
            {(error || queryError) && (
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800 font-semibold">Error</p>
                  <p className="text-sm text-red-700">
                    {error instanceof Error ? error.message : queryError instanceof Error ? queryError.message : 'An error occurred'}
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {(isLoading || queryLoading) && (
              <div className="p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading data...</p>
              </div>
            )}

            {/* Data Grid */}
            {columns.length > 0 && !isLoading && !queryLoading && (
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
            )}

            {/* Empty State */}
            {!selectedTable && queryMode === 'table' && !queryResult && (
              <div className="p-12 text-center text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                  />
                </svg>
                <p className="mt-4">Select a table or execute a custom query</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
