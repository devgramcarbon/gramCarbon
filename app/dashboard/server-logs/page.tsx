'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Terminal, Search, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useToast } from '../../components/Toaster';
import { useSocket } from '../../components/SocketProvider';

const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-red-100 text-red-700 border-red-200',
  warn: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  http: 'bg-purple-100 text-purple-700 border-purple-200',
  debug: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ROW_ACCENT: Record<string, string> = {
  error: 'border-l-2 border-l-red-400',
  warn: 'border-l-2 border-l-yellow-400',
  info: '',
  http: 'border-l-2 border-l-purple-400',
  debug: '',
};

const LEVELS = ['error', 'warn', 'info', 'http', 'debug'];

interface LogEntry { level: string; message: string; timestamp?: string; stack?: string; service?: string; meta?: Record<string, unknown> }
interface Pagination { page: number; pages: number; total: number }

function LogMessage({ message, stack, meta }: { message: string; stack?: string; meta?: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = meta && Object.keys(meta).length > 0;

  return (
    <div>
      <span className="text-gray-800">{message}</span>
      {hasMeta && (
        <>
          <span className="text-gray-400"> </span>
          <span className="text-gray-500">{JSON.stringify(meta)}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-200 transition-colors"
          >
            {expanded ? 'hide' : 'detail'}
          </button>
          {expanded && (
            <pre className="mt-1.5 p-2 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(meta, null, 2)}
            </pre>
          )}
        </>
      )}
      {stack && (
        <pre className="mt-1 text-red-500 whitespace-pre-wrap text-[10px] leading-tight">{stack}</pre>
      )}
    </div>
  );
}

export default function ServerLogsPage() {
  const { toast } = useToast() ?? {};
  const socket = useSocket();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: { logs: LogEntry[]; pagination: Pagination } }>(
        '/api/server-logs',
        { params: { page, search, level, limit: 500 } }
      );
      if (data.success) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
      }
    } catch {
      toast?.('Failed to load server logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, level, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!socket) return;
    return socket.subscribe('log_created', (data) => {
      const entry = data as LogEntry;
      // only prepend if no active filters, otherwise it would be out of place
      if (!search && !level) {
        setLogs((prev) => [entry, ...prev.slice(0, 499)]);
        setPagination((p) => p ? { ...p, total: p.total + 1 } : p);
      }
    });
  }, [socket, search, level]);

  const hasFilters = search || level;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Server Logs', href: '/dashboard/server-logs' }]} />
      <PageHeader
        title="Server Logs"
        description="Real-time in-memory application logs (last 500 entries)"
        actions={
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${socket?.connected ? 'text-green-600 bg-green-50 border-green-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
              {socket?.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {socket?.connected ? 'Live' : 'Offline'}
            </span>
            <button onClick={fetchLogs} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500" title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search message..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setLevel(''); setPage(1); }} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
            <X size={12} /> Clear Filters
          </button>
        )}
        {pagination && <span className="ml-auto text-xs text-gray-400">{pagination.total} entries</span>}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Terminal size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Time</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Level</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log, i) => (
                  <tr key={i} className={`hover:bg-gray-50 transition-colors ${ROW_ACCENT[log.level] || ''}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{log.timestamp || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${LEVEL_STYLES[log.level] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {log.level?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs break-all">
                      <LogMessage message={log.message} stack={log.stack} meta={log.meta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
