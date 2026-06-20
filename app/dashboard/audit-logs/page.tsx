'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import { useToast } from '../../components/Toaster';

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'bg-blue-100 text-blue-700',
  USER_LOGOUT: 'bg-gray-100 text-gray-600',
  STOCK_ADDED: 'bg-green-100 text-green-700',
  SALE_RECORDED: 'bg-emerald-100 text-emerald-700',
  FARMER_CREATED: 'bg-purple-100 text-purple-700',
  DISTRIBUTOR_CREATED: 'bg-indigo-100 text-indigo-700',
  MESSAGE_SENT: 'bg-yellow-100 text-yellow-700',
  SETTINGS_CHANGED: 'bg-orange-100 text-orange-700',
  USER_DELETED: 'bg-red-100 text-red-700',
  FARMER_DELETED: 'bg-red-100 text-red-700',
  DISTRIBUTOR_DELETED: 'bg-red-100 text-red-700',
  REPORT_GENERATED: 'bg-teal-100 text-teal-700',
};

const ALL_ACTIONS = [
  'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
  'STOCK_ADDED', 'STOCK_UPDATED', 'SALE_RECORDED', 'SALE_DELETED',
  'FARMER_CREATED', 'FARMER_UPDATED', 'FARMER_DELETED',
  'DISTRIBUTOR_CREATED', 'DISTRIBUTOR_UPDATED', 'DISTRIBUTOR_DELETED',
  'MESSAGE_SENT', 'SETTINGS_CHANGED', 'REPORT_GENERATED',
];

interface AuditLog { _id: string; action: string; userEmail?: string; entity?: string; entityId?: string; ipAddress?: string; createdAt?: string }
interface Pagination { page: number; pages: number; total: number; limit: number }

export default function AuditLogsPage() {
  const { toast } = useToast() ?? {};
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { logs: AuditLog[]; pagination: Pagination } }>('/api/audit-logs', { params: { page, search, action, from: fromDate, to: toDate, limit: 50 } });
      if (data.success) { setLogs(data.data.logs); setPagination(data.data.pagination); }
    } catch { toast?.('Failed to load audit logs', 'error'); }
    finally { setLoading(false); }
  }, [page, search, action, fromDate, toDate, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns = [
    { key: 'action', label: 'Action', render: (v: string | undefined) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[v ?? ''] || 'bg-gray-100 text-gray-600'}`}>{v}</span> },
    { key: 'userEmail', label: 'User', render: (v: string | undefined) => v || '—' },
    { key: 'entity', label: 'Entity', render: (v: string | undefined, row: AuditLog) => v ? `${v}${row.entityId ? ` (${row.entityId.slice(-6)})` : ''}` : '—' },
    { key: 'ipAddress', label: 'IP', render: (v: string | undefined) => v || '—' },
    { key: 'createdAt', label: 'Time', render: (v: string | undefined) => v ? new Date(v).toLocaleString('en-IN') : '—' },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Audit Logs', href: '/dashboard/audit-logs' }]} />
      <PageHeader title="Audit Logs" description="Track all system actions and user activities"
        actions={<button onClick={fetchLogs} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>}
      />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl w-48 focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">All Actions</option>
          {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        {(search || action || fromDate || toDate) && (
          <button onClick={() => { setSearch(''); setAction(''); setFromDate(''); setToDate(''); setPage(1); }} className="text-xs text-red-500 hover:underline">Clear Filters</button>
        )}
      </div>
      <DataTable columns={columns} data={logs} loading={loading} pagination={pagination ?? undefined} onPageChange={setPage} emptyText="No audit logs found for the selected filters." />
    </div>
  );
}
