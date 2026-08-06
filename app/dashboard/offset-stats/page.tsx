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
import { SkeletonBlock } from '../../components/LoadingState';
import { useToast } from '../../components/Toaster';
import { useProjectFilter } from '../ProjectFilterContext';

const TEAL = '#2F9E8C';
const TEAL_LIGHT = '#CFEFE9';
const PURPLE = '#9A60A8';
const AMBER = '#D99416';

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

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

interface MmMonthlyBreakdown {
  year: number;
  month: number;
  monthLabel: string;
  cc: number;
  fractionalCreditsGenerated: number;
  farmers: number;
  animals: number;
  mccs: string[];
}

interface MmByMcc {
  mccCode: string;
  mccName: string;
  cc: number;
  fractionalCreditsGenerated: number;
  animals: number;
  farmers: number;
}

interface MmStats {
  farmers: number;
  animals: number;
  totalCC: number;
  fullOffsets: number;
  fractionalRemainderValue: number;
  totalFractionalCredits: number;
  totalLowCarbonFeedTons: number;
  totalMonthlyCollectionLit: number;
  monthlyBreakdown: MmMonthlyBreakdown[];
  byMcc: MmByMcc[];
  latestMonthLabel: string | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_STYLES: Record<MonthlyStatus['status'], string> = {
  ON_TRACK: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  PENDING: 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-[#21262d] dark:text-[#636e7b] dark:border-[#30363d]',
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
    <div className="rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-900 dark:text-[#e6edf3] mb-1">{formatDateShort(p.date)}</p>
      <p className="text-gray-500 dark:text-[#8b949e]">Cumulative: <span className="font-semibold text-gray-900 dark:text-[#e6edf3]">{p.cumulativeOffset.toFixed(4)} tCO2e</span></p>
      <p className="text-gray-500 dark:text-[#8b949e]">That day: <span className="font-medium text-gray-700 dark:text-[#adbac7]">{p.dayOffset.toFixed(4)} tCO2e</span> ({p.cowDays} cow-days)</p>
    </div>
  );
}

function MonthlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-900 dark:text-[#e6edf3] mb-1">{label}</p>
      <p className="text-gray-500 dark:text-[#8b949e]">Offset: <span className="font-semibold text-gray-900 dark:text-[#e6edf3]">{payload[0].value.toFixed(4)} tCO2e</span></p>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-[#30363d] p-8 mb-4 bg-gray-50 dark:bg-[#161b22] text-center">
      <SkeletonBlock className="w-8 h-8 mx-auto mb-3 rounded-full" />
      <SkeletonBlock className="h-9 w-64 mx-auto mb-3" />
      <SkeletonBlock className="h-4 w-80 mx-auto" />
    </div>
  );
}

function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-4">
          <SkeletonBlock className="w-11 h-11 rounded-xl flex-shrink-0" />
          <div className="flex-1">
            <SkeletonBlock className="h-5 w-16 mb-2" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BarListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
      <SkeletonBlock className="h-4 w-24 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-3 w-10" />
            </div>
            <SkeletonBlock className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCardSkeleton({ span = 3 }: { span?: 2 | 3 }) {
  return (
    <div className={`${span === 2 ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5`}>
      <SkeletonBlock className="h-4 w-48 mb-2" />
      <SkeletonBlock className="h-3 w-64 mb-4" />
      <SkeletonBlock className="h-64 w-full" />
    </div>
  );
}

function MonthlyStatusSkeleton() {
  return (
    <div className="lg:col-span-3 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
      <SkeletonBlock className="h-4 w-28 mb-4" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] overflow-hidden">
      <div className="grid gap-4 px-4 py-3 border-b border-gray-100 dark:border-[#30363d]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 px-4 py-3 border-b border-gray-50 dark:border-[#21262d] last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className="h-4 w-2/3" />
          ))}
        </div>
      ))}
    </div>
  );
}

function OffsetStatsSkeleton({ project }: { project: string }) {
  const showNp = project === 'np' || project === 'all';
  const showMm = project === 'mm' || project === 'all';
  return (
    <div>
      {project === 'all' && (
        <div className="mb-8">
          <SkeletonBlock className="h-4 w-56 mb-3" />
          <HeroSkeleton />
          <StatCardsSkeleton />
        </div>
      )}

      {showMm && (
        <div className="mb-8">
          {project === 'all' && <SkeletonBlock className="h-4 w-36 mb-3" />}
          <HeroSkeleton />
          <StatCardsSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-2">
              <BarListSkeleton />
            </div>
            <ChartCardSkeleton span={3} />
          </div>
        </div>
      )}

      {showNp && (
        <div>
          {project === 'all' && <SkeletonBlock className="h-4 w-40 mb-3" />}
          <HeroSkeleton />
          <StatCardsSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <ChartCardSkeleton span={3} />
            <ChartCardSkeleton span={2} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-2">
              <BarListSkeleton />
            </div>
            <MonthlyStatusSkeleton />
          </div>
          <SkeletonBlock className="h-4 w-40 mb-3" />
          <TableSkeleton />
        </div>
      )}
    </div>
  );
}

export default function OffsetStatsPage() {
  const { project } = useProjectFilter();
  const { toast } = useToast() ?? {};
  const [stats, setStats] = useState<OffsetStats | null>(null);
  const [mmStats, setMmStats] = useState<MmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const isDark = useIsDark();
  const gridStroke = isDark ? '#21262d' : '#eee';
  const axisLineStroke = isDark ? '#30363d' : '#e5e7eb';
  const tickFill = isDark ? '#636e7b' : '#9ca3af';
  const cursorFill = isDark ? '#2F9E8C' : TEAL_LIGHT;

  const showNp = project === 'np' || project === 'all';
  const showMm = project === 'mm' || project === 'all';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [npRes, mmRes] = await Promise.all([
        showNp ? axios.get<{ success: boolean; data: OffsetStats }>('/api/carbon-offsets') : Promise.resolve(null),
        showMm ? axios.get<{ success: boolean; data: MmStats }>('/api/mm-offsets') : Promise.resolve(null),
      ]);
      if (npRes?.data.success) setStats(npRes.data.data);
      if (mmRes?.data.success) setMmStats(mmRes.data.data);
    } catch {
      toast?.('Failed to load offset stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, showNp, showMm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const timeline = stats?.timeline ?? [];
  const monthlyBuckets = useMemo(() => toMonthlyBuckets(timeline), [timeline]);
  const last90 = useMemo(() => timeline.slice(-90), [timeline]);

  const statCards: Array<{ label: string; value: string; icon: LucideIcon; color: string; bg: string }> = stats
    ? [
        { label: 'Farmers / Animals', value: `${stats.farmers} / ${stats.animals}`, icon: PawPrint, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
        { label: 'Active Days', value: `${stats.activeDays}`, icon: CalendarRange, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
        { label: 'Fractional Offsets Logged', value: stats.totalFractionalOffsets.toLocaleString('en-IN'), icon: Layers, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
        { label: 'Full Offsets Accumulated', value: `${stats.fullOffsets}`, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
      ]
    : [];

  const headerDescription =
    project === 'mm'
      ? 'Milky Mist program — feed-to-offset accumulation'
      : project === 'np'
      ? 'NainarPalayam program — feed-to-offset accumulation across all tracked cattle'
      : 'Combined view across the NainarPalayam and Milky Mist programs';

  const combinedTotalTons = (stats?.totalOffsetValueTons ?? 0) + (mmStats?.totalCC ?? 0);
  const combinedFullOffsets = Math.floor(combinedTotalTons);
  const combinedFractional = combinedTotalTons - combinedFullOffsets;
  const combinedFarmers = (stats?.farmers ?? 0) + (mmStats?.farmers ?? 0);
  const combinedAnimals = (stats?.animals ?? 0) + (mmStats?.animals ?? 0);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Offset Stats', href: '/dashboard/offset-stats' }]} />
      <PageHeader
        title="Carbon Offset Stats"
        description={headerDescription}
        actions={
          <button onClick={fetchData} className="p-2 rounded-xl border border-gray-200 dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#21262d] text-gray-500 dark:text-[#768390]">
            <RefreshCw size={16} />
          </button>
        }
      />

      {loading && !stats && !mmStats ? (
        <OffsetStatsSkeleton project={project} />
      ) : (
        <>
      {project === 'all' && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-3">Combined (NainarPalayam + Milky Mist)</h2>
          <div className="rounded-2xl border border-gray-100 p-8 mb-4 bg-gradient-to-br from-teal-50 via-white to-purple-50 dark:from-teal-500/5 dark:via-[#161b22] dark:to-purple-500/5 text-center">
            <Leaf size={30} className="mx-auto text-[#2F9E8C] mb-2" />
            <p className="text-4xl font-extrabold text-gray-900 dark:text-[#e6edf3] tabular-nums">
              {loading ? '—' : combinedTotalTons.toFixed(4)}
              <span className="text-lg font-semibold text-gray-500 dark:text-[#768390] ml-2">tCO2e accumulated</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-[#768390] mt-2 max-w-xl mx-auto">
              {combinedFullOffsets} full offset{combinedFullOffsets === 1 ? '' : 's'} (1 tCO2e each) + {combinedFractional.toFixed(4)} tCO2e in progress
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Farmers / Animals', value: `${combinedFarmers} / ${combinedAnimals}`, icon: PawPrint, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
              { label: 'NP Offset (tCO2e)', value: (stats?.totalOffsetValueTons ?? 0).toFixed(2), icon: CalendarRange, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
              { label: 'MM Offset (tCO2e)', value: (mmStats?.totalCC ?? 0).toFixed(2), icon: Layers, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
              { label: 'Full Offsets Accumulated', value: `${combinedFullOffsets}`, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                    <Icon size={22} className={card.color} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#e6edf3] leading-tight">{card.value}</p>
                    <p className="text-xs text-gray-500 dark:text-[#768390]">{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showMm && (
        <div className="mb-8">
          {project === 'all' && <h2 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-3">Milky Mist (D2B)</h2>}
          <div className="rounded-2xl border border-gray-100 p-8 mb-4 bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-[#1c2128] dark:via-[#161b22] dark:to-teal-500/5 text-center">
            <Leaf size={30} className="mx-auto text-[#4a6274] mb-2" />
            <p className="text-4xl font-extrabold text-gray-900 dark:text-[#e6edf3] tabular-nums">
              {loading ? '—' : mmStats?.totalCC.toFixed(4)}
              <span className="text-lg font-semibold text-gray-500 dark:text-[#768390] ml-2">tCO2e accumulated</span>
            </p>
            <p className="text-sm text-gray-500 dark:text-[#768390] mt-2 max-w-xl mx-auto">
              {mmStats?.fullOffsets ?? 0} full offset{mmStats?.fullOffsets === 1 ? '' : 's'} (1 tCO2e each) + {mmStats?.fractionalRemainderValue.toFixed(4) ?? '0'} tCO2e in progress
              {mmStats?.latestMonthLabel && <> · latest month: {mmStats.latestMonthLabel}</>}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Farmers / Animals', value: `${mmStats?.farmers ?? 0} / ${mmStats?.animals ?? 0}`, icon: PawPrint, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
              { label: 'MCCs Tracked', value: `${mmStats?.byMcc.length ?? 0}`, icon: CalendarRange, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
              { label: 'Fractional Credits', value: (mmStats?.totalFractionalCredits ?? 0).toLocaleString('en-IN'), icon: Layers, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
              { label: 'Full Offsets Accumulated', value: `${mmStats?.fullOffsets ?? 0}`, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                    <Icon size={22} className={card.color} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-[#e6edf3] leading-tight">{card.value}</p>
                    <p className="text-xs text-gray-500 dark:text-[#768390]">{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <div className="lg:col-span-2 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">By MCC</h3>
              {(!mmStats?.byMcc || mmStats.byMcc.length === 0) ? (
                <div className="h-32 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No data yet.</div>
              ) : (
                <div className="space-y-3">
                  {mmStats.byMcc.map((m, i) => {
                    const max = mmStats.byMcc[0].cc || 1;
                    const pct = Math.max((m.cc / max) * 100, 4);
                    return (
                      <div key={m.mccCode}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-[#adbac7] font-medium">{m.mccName}</span>
                          <span className="text-gray-400 dark:text-[#636e7b] tabular-nums">{m.cc.toFixed(4)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-[#21262d] overflow-hidden">
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

            <div className="lg:col-span-3 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-1">Offset by Month</h3>
              <p className="text-xs text-gray-400 dark:text-[#636e7b] mb-4">tCO2e generated per calendar month</p>
              {(!mmStats?.monthlyBreakdown || mmStats.monthlyBreakdown.length === 0) ? (
                <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No offset data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={mmStats.monthlyBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: tickFill }} axisLine={{ stroke: axisLineStroke }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip cursor={{ fill: cursorFill, opacity: 0.4 }} />
                    <Bar dataKey="cc" name="Offset (tCO2e)" fill="#4a6274" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {showNp && (
        <div>
          {project === 'all' && <h2 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-3">NainarPalayam (D2F)</h2>}
      {/* Hero cumulative offset */}
      <div className="rounded-2xl border border-gray-100 p-8 mb-6 bg-gradient-to-br from-teal-50 via-white to-purple-50 dark:from-teal-500/5 dark:via-[#161b22] dark:to-purple-500/5 text-center">
        <Leaf size={30} className="mx-auto text-[#2F9E8C] mb-2" />
        <p className="text-4xl font-extrabold text-gray-900 dark:text-[#e6edf3] tabular-nums">
          {loading ? '—' : stats?.totalOffsetValueTons.toFixed(4)}
          <span className="text-lg font-semibold text-gray-500 dark:text-[#768390] ml-2">tCO2e accumulated</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-[#768390] mt-2 max-w-xl mx-auto">
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
            <div key={card.label} className="bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <Icon size={22} className={card.color} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-[#e6edf3] leading-tight">{card.value}</p>
                <p className="text-xs text-gray-500 dark:text-[#768390]">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {stats?.offsetPerCowPerDay != null && (
        <p className="text-xs text-gray-500 dark:text-[#768390] mb-6">
          Offset formula: {stats.offsetPerCowPerDay.toFixed(6)} tCO2e per verified cow-day (0.68 tCO2e/cow/year ÷ 365).
          1 tCO2e = 1 full offset. Totals count every logged feed day.
        </p>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-1">Accumulating Offset (last 90 days)</h3>
          <p className="text-xs text-gray-400 dark:text-[#636e7b] mb-4">Running total of tCO2e offset from all verified cow-feeding days</p>
          {last90.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No offset data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={last90} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDateShort(v)}
                  tick={{ fontSize: 11, fill: tickFill }}
                  axisLine={{ stroke: axisLineStroke }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={48} />
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

        <div className="lg:col-span-2 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-1">Offset by Month</h3>
          <p className="text-xs text-gray-400 dark:text-[#636e7b] mb-4">tCO2e generated per calendar month</p>
          {monthlyBuckets.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No offset data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: tickFill }} axisLine={{ stroke: axisLineStroke }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<MonthlyTooltip />} cursor={{ fill: cursorFill, opacity: 0.4 }} />
                <Bar dataKey="offset" name="Offset (tCO2e)" fill={PURPLE} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">By Place</h3>
          {(!stats?.byPlace || stats.byPlace.length === 0) ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No data yet.</div>
          ) : (
            <div className="space-y-3">
              {stats.byPlace.map((p, i) => {
                const max = stats.byPlace[0].offsetValue || 1;
                const pct = Math.max((p.offsetValue / max) * 100, 4);
                return (
                  <div key={p.place}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-[#adbac7] font-medium">{p.place}</span>
                      <span className="text-gray-400 dark:text-[#636e7b] tabular-nums">{p.offsetValue.toFixed(4)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-[#21262d] overflow-hidden">
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

        <div className="lg:col-span-3 bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-[#30363d] p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">Monthly Status</h3>
          {(!stats?.monthlyStatus || stats.monthlyStatus.length === 0) ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400 dark:text-[#636e7b]">No data yet.</div>
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
              <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-500 dark:text-[#768390]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> On Track</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Pending</span>
              </div>
            </>
          )}
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-3">Feed Supply Batches</h2>
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
      <p className="text-[11px] text-gray-400 dark:text-[#636e7b] mt-2">
        <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: AMBER }} />
        Verification is currently done locally at the point of feed distribution — every logged feed day is treated as verified.
      </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
