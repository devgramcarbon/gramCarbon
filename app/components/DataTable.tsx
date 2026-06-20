'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonRow } from './LoadingState';
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  width?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, row: T) => ReactNode;
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
}

interface DataTableProps<T extends { _id?: string }> {
  columns?: Column<T>[];
  data?: T[];
  loading?: boolean;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  emptyText?: string;
}

export default function DataTable<T extends { _id?: string }>({
  columns = [],
  data = [],
  loading = false,
  pagination,
  onPageChange,
  emptyText = 'No records found',
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row._id || i} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-gray-700">
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : ((row[col.key as keyof T] as ReactNode) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>
            Page {pagination.page} of {pagination.pages} ({pagination.total} records)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
