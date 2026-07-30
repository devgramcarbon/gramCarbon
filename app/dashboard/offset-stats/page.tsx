'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { PawPrint, CalendarRange, Layers, Award, Leaf, RefreshCw, type LucideIcon } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';

const TEAL = '#2F9E8C';
const TEAL_LIGHT = '#CFEFE9';
const PURPLE = '#9A60A8';
const AMBER = '#D99416';

interface FeedBatch {
  _id: string;
  feedBatchId: string;
  supplyDate?: string;
  gramsPerAnimalPerDay?: number;
  totalKg?: number;
  activeFrom?: string;
  activeTo?: string;
}

interface TimelinePoint {
  date: string;
  dayOffset: number;
  cowDays: number;
  cumulativeOffset: number;
}

interface PlaceBreakdown {
  place: string;
  offsetValue: number;
  cowDays: number;
}

interface MonthlyStatus {
  year: number;
  month: number;
  daysLogged: number;
  daysInMonth: number;
  status: 'ON_TRACK' | 'PARTIAL' | 'PENDING';
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
  timeline: TimelinePoint[];
  byPlace: PlaceBreakdown[];
  monthlyStatus: MonthlyStatus[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_STYLES: Record<MonthlyStatus['status'], string> = {
  ON_TRACK: 'bg-teal-50 text-teal-600 border-teal-100',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-100',
  PENDING: 'bg-gray-50 text-gray-400 border-gray-100',
};

const PLACE_COLORS = [TEAL, PURPLE, AMBER, '#3B82F6', '#EF4444', '#6366F1', '#EC4899'];

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatMonthShort(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// Group daily timeline points into monthly buckets for the "offset per month" bar chart.
function toMonthlyBuckets(timeline: TimelinePoint[]): Array<{ month: string; offset: number }> {
  const map = new Map<string, number>();
  for (const point of timeline) {
    const d = new Date(point.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + point.dayOffset);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, offset]) => {
      const [y, m] = key.split('-').map(Number);
      return { month: formatMonthShort(new Date(y, m - 1, 1).toISOString()), offset: Number(offset.toFixed(4)) };
    });
}

function CumulativeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TimelinePoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-900 mb-1">{formatDateShort(p.date)}</p>
      <p className="text-gray-500">Cumulative: <span className="font-semibold text-gray-900">{p.cumulativeOffset.toFixed(4)} tCO2e</span></p>
      <p className="text-gray-500">That day: <span className="font-medium text-gray-700">{p.dayOffset.toFixed(4)} tCO2e</span> ({p.cowDays} cow-days)</p>
    </div>
  );
}

function MonthlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      <p className="text-gray-500">Offset: <span className="font-semibold text-gray-900">{payload[0].value.toFixed(4)} tCO2e</span></p>
    </div>
  );
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

  const timeline = stats?.timeline ?? [];
  const monthlyBuckets = useMemo(() => toMonthlyBuckets(timeline), [timeline]);
  const last90 = useMemo(() => timeline.slice(-90), [timeline]);

  const statCards: Array<{ label: string; value: string; icon: LucideIcon; color: string; bg: string }> = stats
    ? [
        { label: 'Farmers / Animals', value: `${stats.farmers} / ${stats.animals}`, icon: PawPrint, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Days', value: `${stats.activeDays}`, icon: CalendarRange, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Fractional Offsets Logged', value: stats.totalFractionalOffsets.toLocaleString('en-IN'), icon: Layers, color: 'text-teal-600', bg: 'bg-teal-50' },
        { label: 'Full Offsets Accumulated', value: `${stats.fullOffsets}`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
      ]
    : [];

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

      {/* Hero cumulative offset */}
      <div className="rounded-2xl border border-gray-100 p-8 mb-6 bg-gradient-to-br from-teal-50 via-white to-purple-50 text-center">
        <Leaf size={30} className="mx-auto text-[#2F9E8C] mb-2" />
        <p className="text-4xl font-extrabold text-gray-900 tabular-nums">
          {loading ? '—' : stats?.totalOffsetValueTons.toFixed(4)}
          <span className="text-lg font-semibold text-gray-500 ml-2">tCO2e accumulated</span>
        </p>
        <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">
          {stats?.fullOffsets ?? 0} full offset{stats?.fullOffsets === 1 ? '' : 's'} (1 tCO2e each) + {stats?.fractionalRemainderValue.toFixed(4) ?? '0'} tCO2e in progress
          {stats?.dateRange.from && (
            <> · {formatDate(stats.dateRange.from)} – {formatDate(stats.dateRange.to)}</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      {stats?.offsetPerCowPerDay != null && (
        <p className="text-xs text-gray-500 mb-6">
          Offset formula: {stats.offsetPerCowPerDay.toFixed(6)} tCO2e per verified cow-day (0.68 tCO2e/cow/year ÷ 365).
          1 tCO2e = 1 full offset. Totals count every logged feed day.
        </p>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Accumulating Offset (last 90 days)</h3>
          <p className="text-xs text-gray-400 mb-4">Running total of tCO2e offset from all verified cow-feeding days</p>
          {last90.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No offset data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={last90} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDateShort(v)}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<CumulativeTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulativeOffset"
                  name="Cumulative offset (tCO2e)"
                  stroke={TEAL}
                  strokeWidth={2}
                  fill="url(#cumulativeFill)"
                  dot={false}
                  activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Offset by Month</h3>
          <p className="text-xs text-gray-400 mb-4">tCO2e generated per calendar month</p>
          {monthlyBuckets.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">No offset data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MonthlyTooltip />} cursor={{ fill: TEAL_LIGHT, opacity: 0.4 }} />
                <Bar dataKey="offset" name="Offset (tCO2e)" fill={PURPLE} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">By Place</h3>
          {(!stats?.byPlace || stats.byPlace.length === 0) ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data yet.</div>
          ) : (
            <div className="space-y-3">
              {stats.byPlace.map((p, i) => {
                const max = stats.byPlace[0].offsetValue || 1;
                const pct = Math.max((p.offsetValue / max) * 100, 4);
                return (
                  <div key={p.place}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{p.place}</span>
                      <span className="text-gray-400 tabular-nums">{p.offsetValue.toFixed(4)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: PLACE_COLORS[i % PLACE_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Status</h3>
          {(!stats?.monthlyStatus || stats.monthlyStatus.length === 0) ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400">No data yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {stats.monthlyStatus.map((m) => (
                  <div
                    key={`${m.year}-${m.month}`}
                    className={`rounded-xl border p-3 text-center ${STATUS_STYLES[m.status]}`}
                    title={`${m.daysLogged}/${m.daysInMonth} days logged`}
                  >
                    <p className="text-xs font-semibold">{MONTH_NAMES[m.month - 1]}</p>
                    <p className="text-[10px] opacity-70">{m.year}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> On Track</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Pending</span>
              </div>
            </>
          )}
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Feed Supply Batches</h2>
      <DataTable
        columns={[
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
        ]}
        data={stats?.feedBatches || []}
        loading={loading}
        emptyText="No feed batches recorded."
      />
      <p className="text-[11px] text-gray-400 mt-2">
        <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: AMBER }} />
        Verification is currently done locally at the point of feed distribution — every logged feed day is treated as verified.
      </p>
    </div>
  );
}
