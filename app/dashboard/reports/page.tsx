'use client';

import { useState } from 'react';
import axios from 'axios';
import { BarChart3, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useToast } from '../../components/Toaster';

const PERIOD_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last Year', days: 365 },
];

interface ReportSummary { totalSales: number; totalKgSold: number; totalAnimals: number; uniqueFarmers: number; activeDistributors: number; registeredFarmers: number }
interface ByDistributor { name: string; phone: string; totalSales: number; kgSold: number; stockBalance: number; utilizationPct: number }
interface ReportData { summary: ReportSummary; byDistributor: ByDistributor[] }

export default function ReportsPage() {
  const { toast } = useToast() ?? {};
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const applyPreset = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() - days);
    setFromDate(d.toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: ReportData }>('/api/reports', { params: { from: fromDate, to: toDate } });
      if (data.success) setReportData(data.data);
    } catch { toast?.('Failed to generate report', 'error'); }
    finally { setLoading(false); }
  };

  const downloadFile = async (format: 'excel' | 'csv') => {
    try {
      const response = await axios.get('/api/reports', { params: { from: fromDate, to: toDate, format }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gramCarbon-Console-report-${fromDate}-${toDate}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast?.(`${format === 'excel' ? 'Excel' : 'CSV'} report downloaded`, 'success');
    } catch { toast?.(`Failed to download report`, 'error'); }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }]} />
      <PageHeader title="Reports" description="Generate and export feed distribution reports" />
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Date Range</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {PERIOD_PRESETS.map((p) => (
            <button key={p.label} onClick={() => applyPreset(p.days)}
              className="px-3 py-1.5 text-xs rounded-full border border-gray-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors">{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
          <div className="flex items-end gap-2">
            <button onClick={generateReport} disabled={loading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />}Generate
            </button>
            <button onClick={() => downloadFile('excel')} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm px-4 py-2 rounded-xl"><FileSpreadsheet size={15} /> Excel</button>
            <button onClick={() => downloadFile('csv')} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm px-4 py-2 rounded-xl"><FileText size={15} /> CSV</button>
          </div>
        </div>
      </div>
      {reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(reportData.summary).map(([key, val]) => (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{val}</p>
                <p className="text-xs text-gray-500 mt-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Performance by Distributor</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Name', 'Phone', 'Sales', 'Kg Sold', 'Balance', 'Utilization'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reportData.byDistributor.map((d) => (
                    <tr key={d.phone} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                      <td className="px-4 py-3 text-gray-600">{d.phone}</td>
                      <td className="px-4 py-3">{d.totalSales}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{d.kgSold}kg</td>
                      <td className="px-4 py-3">{d.stockBalance}kg</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${d.utilizationPct}%` }} /></div><span className="text-xs">{d.utilizationPct}%</span></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {!reportData && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <BarChart3 size={48} className="mb-3 opacity-50" />
          <p className="text-sm">Select a date range and click Generate to view the report.</p>
        </div>
      )}
    </div>
  );
}
