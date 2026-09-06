import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ReactGrid, Column, Row, DefaultCellTypes } from '@silevis/reactgrid';
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
  const pageSize = 100;

  // Fetch table list
  const { data: tables } = useQuery({
    queryKey: ['database-tables'],
    queryFn: async () => {
      const { data } = await axios.get<TableInfo[]>('/paschools/api/database/tables');
      return data;
    },
  });

  // Fetch table schema
  const { data: schema } = useQuery({
    queryKey: ['database-schema', selectedTable],
    queryFn: async () => {
      const { data } = await axios.get<TableSchema[]>(
        `/paschools/api/database/schema/${selectedTable}`
      );
      return data;
    },
    enabled: !!selectedTable,
  });

  // Fetch table data
  const { data: tableData, isLoading, error } = useQuery({
    queryKey: ['database-data', selectedTable, currentPage],
    queryFn: async () => {
      const { data } = await axios.get<TableData>(
        `/paschools/api/database/data/${selectedTable}?page=${currentPage}&limit=${pageSize}`
      );
      return data;
    },
    enabled: !!selectedTable,
    retry: 1,
  });

  // Convert table data to ReactGrid format
  const { columns, rows } = useMemo(() => {
    const dataSource = tableData?.data;

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
    const headerRow: Row<DefaultCellTypes> = {
      rowId: 'header',
      cells: columnNames.map((name) => ({
        type: 'header' as const,
        text: name,
      })),
    };

    // Create data rows
    const dataRows: Row<DefaultCellTypes>[] = dataSource.map((record: any, idx: number) => ({
      rowId: `row-${idx}`,
      cells: columnNames.map((colName) => ({
        type: 'text' as const,
        text: record[colName] !== null && record[colName] !== undefined ? String(record[colName]) : '',
        nonEditable: true,
      })),
    }));

    return {
      columns: cols,
      rows: [headerRow, ...dataRows],
    };
  }, [tableData]);

  const handleChanges = () => {
    // Read-only grid
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Database Viewer</h1>
        <p className="mt-2 text-sm text-stone-500">
          Browse the raw database tables
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card-surface p-4">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Tables</h2>
            <div className="space-y-2">
              {tables?.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleTableSelect(table.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTable === table.name
                      ? 'bg-navy-100 text-navy-900 font-semibold'
                      : 'hover:bg-stone-100 text-stone-600'
                  }`}
                >
                  <div>{table.label}</div>
                  <div className="text-xs text-stone-500">
                    {table.recordCount.toLocaleString()} records
                  </div>
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="card-surface overflow-hidden">
            {/* Table Info Header */}
            {tableData && (
              <div className="p-4 border-b border-stone-200 bg-stone-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">
                      {tables?.find((t) => t.name === selectedTable)?.label}
                    </h2>
                    <p className="text-sm text-stone-500">
                      {tableData.totalRecords.toLocaleString()} total records
                    </p>
                  </div>
                  {tableData.totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-stone-500">
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
                    <summary className="text-sm text-navy-600 cursor-pointer hover:text-navy-800">
                      View Table Schema ({schema.length} columns)
                    </summary>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {schema.map((col) => (
                        <div key={col.name} className="bg-white p-2 rounded border">
                          <div className="font-semibold flex items-center gap-1">
                            {col.name}
                            {col.primaryKey && (
                              <span className="text-xs bg-navy-100 text-navy-800 px-1 rounded">PK</span>
                            )}
                          </div>
                          <div className="text-stone-500">
                            {col.type} {col.notNull && '(NOT NULL)'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-6">
                <div className="bg-brick-50 border border-brick-200 rounded-md p-4">
                  <p className="text-brick-700 font-semibold">Error</p>
                  <p className="text-sm text-brick-600">
                    {error instanceof Error ? error.message : 'An error occurred'}
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy-600"></div>
                <p className="mt-2 text-stone-500">Loading data...</p>
              </div>
            )}

            {/* Data Grid */}
            {columns.length > 0 && !isLoading && (
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
            {!selectedTable && (
              <div className="p-12 text-center text-stone-500">
                <svg
                  className="mx-auto h-12 w-12 text-stone-300"
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
                <p className="mt-4">Select a table</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
