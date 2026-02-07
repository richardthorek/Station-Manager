/**
 * Data Table Component
 *
 * Enhanced table with:
 * - Sortable columns
 * - Column filtering
 * - Pagination
 * - Row selection
 * - Responsive design
 * - Hover effects
 *
 * Props:
 * - data: Array of objects to display
 * - columns: Column definitions
 * - pageSize: Items per page (default: 10)
 * - showSearch: Show search input (default: true)
 * - onRowClick: Optional row click handler
 */

import { useState, useMemo, type ReactNode } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  showSearch?: boolean;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 10,
  showSearch = true,
  onRowClick,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSizeOption, setPageSizeOption] = useState(pageSize);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;

    return data.filter((row) => {
      return columns.some((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn as keyof T] as unknown;
      const bValue = b[sortColumn as keyof T] as unknown;

      if (aValue === bValue) return 0;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSizeOption;
    return sortedData.slice(startIndex, startIndex + pageSizeOption);
  }, [sortedData, currentPage, pageSizeOption]);

  const totalPages = Math.ceil(sortedData.length / pageSizeOption);

  // Handle sort
  const handleSort = (columnKey: keyof T | string) => {
    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSizeOption(newSize);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <div className="data-table">
      {showSearch && (
        <div className="data-table__controls">
          <input
            type="text"
            className="data-table__search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page
            }}
            aria-label="Search table"
          />
          <div className="data-table__page-size">
            <label htmlFor="page-size">Show:</label>
            <select
              id="page-size"
              value={pageSizeOption}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      <div className="data-table__wrapper">
        <table className="data-table__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  style={{ width: column.width }}
                  className={column.sortable ? 'data-table__th--sortable' : ''}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="data-table__th-content">
                    {column.header}
                    {column.sortable && (
                      <span className="data-table__sort-icon">
                        {sortColumn === column.key && sortDirection === 'asc' && '↑'}
                        {sortColumn === column.key && sortDirection === 'desc' && '↓'}
                        {sortColumn !== column.key && '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'data-table__row--clickable' : ''}
                >
                  {columns.map((column) => (
                    <td key={String(column.key)}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="data-table__no-data">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="data-table__pagination">
          <div className="data-table__pagination-info">
            Showing {(currentPage - 1) * pageSizeOption + 1} to{' '}
            {Math.min(currentPage * pageSizeOption, sortedData.length)} of {sortedData.length} entries
          </div>
          <div className="data-table__pagination-controls">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              aria-label="First page"
            >
              «
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={currentPage === pageNum ? 'active' : ''}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              ›
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
