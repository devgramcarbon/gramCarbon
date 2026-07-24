'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PawPrint, CalendarRange, Layers, Award, Gauge, RefreshCw, type LucideIcon } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';

interface FeedBatch {
  _id: string;
  feedBatchId: string;
  supplyDate?: string;
  gramsPerAnimalPerDay?: number;
  totalKg?: number;
  activeFrom?: string;
  activeTo?: string;
}

interface OffsetStats {
  animals: number;
  farmers: number;
  activeDays: number;
  dateRange: { from: string | null; to: string | null };
  totalFractionalOffsets: number;
  verifiedFractionalOffsets: number;
  totalOffsetValueTons: number;
  fullOffsets: number;
  fractionalRemainderValue: number;
  offsetPerCowPerDay: number | null;
  feedBatches: FeedBatch[];
}

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function OffsetStatsPage() {
  const { project } = useProjectFilter();
  const { toast } = useToast() ?? {};
  const [stats, setStats] = useState<OffsetStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ success: boolean; data: OffsetStats }>('/api/carbon-offsets');
      if (data.success) setStats(data.data);
    } catch {
      toast?.('Failed to load offset stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards: Array<{ label: string; value: string; icon: LucideIcon; color: string; bg: string }> = stats
    ? [
        { label: 'Animals Tracked', value: String(stats.animals), icon: PawPrint, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Days', value: `${stats.activeDays} (${formatDate(stats.dateRange.from)} – ${formatDate(stats.dateRange.to)})`, icon: CalendarRange, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Fractional Offsets Logged', value: stats.totalFractionalOffsets.toLocaleString('en-IN'), icon: Layers, color: 'text-teal-600', bg: 'bg-teal-50' },
        { label: 'Full Offsets Accumulated', value: `${stats.fullOffsets} + ${stats.fractionalRemainderValue.toFixed(3)}t`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Verified Fractional Offsets', value: stats.verifiedFractionalOffsets.toLocaleString('en-IN'), icon: Gauge, color: 'text-green-600', bg: 'bg-green-50' },
      ]
    : [];

  const columns = [
    { key: 'feedBatchId', label: 'Batch ID' },
    { key: 'supplyDate', label: 'Supply Date', render: (v: string) => formatDate(v) },
    { key: 'gramsPerAnimalPerDay', label: 'g/animal/day', render: (v: number) => (v ? `${v}g` : '—') },
    { key: 'totalKg', label: 'Total Supplied', render: (v: number) => (v ? `${v}kg` : '—') },
    {
      key: 'activePeriod',
      label: 'Active Period',
      render: (_: unknown, row: FeedBatch) =>
        row.activeFrom ? `${formatDate(row.activeFrom)} – ${formatDate(row.activeTo)}` : '—',
    },
  ];

  if (project === 'mm') {
    return (
      <div>
        <Breadcrumbs items={[{ label: 'Offset Stats', href: '/dashboard/offset-stats' }]} />
        <PageHeader title="Carbon Offset Stats" description="Milky Mist program — feed-to-offset accumulation" />
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">
          No Milky Mist offset tracking data yet — this pipeline currently only covers the NainarPalayam program.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Offset Stats', href: '/dashboard/offset-stats' }]} />
      <PageHeader
        title="Carbon Offset Stats"
        description="NainarPalayam program — feed-to-offset accumulation across all tracked cattle"
        actions={
          <button onClick={fetchData} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <Icon size={22} className={card.color} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {stats?.offsetPerCowPerDay && (
        <p className="text-xs text-gray-500 mb-4">
          Offset formula: {stats.offsetPerCowPerDay.toFixed(6)} tCO2e per verified cow-day (0.68 tCO2e/cow/year ÷ 365). 1 tCO2e = 1 full offset.
          Totals above count all logged feed days, not only camp-lead-verified entries.
        </p>
      )}

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Feed Supply Batches</h2>
      <DataTable columns={columns} data={stats?.feedBatches || []} loading={loading} emptyText="No feed batches recorded." />
    </div>
  );
}
