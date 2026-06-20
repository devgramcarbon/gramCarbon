'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Users, Building2, Beef, Package, Wind, Award,
  TrendingUp, AlertTriangle, CheckCircle2, RefreshCw,
  UserPlus, Truck, MessageSquare, ChevronRight,
} from 'lucide-react';

const REFRESH_INTERVAL = 30_000;

const GENDER_COLORS = ['#16a34a', '#4ade80', '#bbf7d0'];
const DISTRICT_COLORS = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#15803d', '#166534'];

interface Stats {
  totalFarmers?: number;
  totalCooperatives?: number;
  totalCows?: number;
  totalDistributed?: number;
  methaneReduced?: number;
  carbonCredits?: number;
  totalSold?: number;
}

interface GrowthPoint { month: string; farmers: number }
interface FeedPoint { date: string; kg: number; sales: number }
interface MethanePoint { date: string; methane: number }
interface DistrictPoint { district: string; farmers: number }
interface GenderPoint { name: string; value: number }
interface CooperativePoint { name: string; farmers: number }

interface RecentFarmer {
  _id?: string;
  farmerId?: string;
  name: string;
  district?: string;
  gender?: string;
  animalCount?: number;
  createdAt?: string;
}

interface RecentSale {
  _id?: string;
  farmerName?: string;
  distributorPhone?: string;
  cowCount?: number;
  qtyKg?: number;
  batchNo?: string;
  saleDate?: string;
}

interface Activity {
  action: string;
  entity: string;
  user: string;
  timestamp: string;
  detail?: string;
}

interface Alert {
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

interface DashboardData {
  stats?: Stats;
  recentFarmers?: RecentFarmer[];
  recentSales?: RecentSale[];
  farmerGrowthData?: GrowthPoint[];
  feedDistributionData?: FeedPoint[];
  methaneReductionData?: MethanePoint[];
  districtData?: DistrictPoint[];
  genderData?: GenderPoint[];
  cooperativeData?: CooperativePoint[];
  recentActivities?: Activity[];
  alerts?: Alert[];
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value?: number | null;
  unit?: string;
  color: string;
  bg: string;
  trend?: string;
}
function StatCard({ icon, label, value, unit, color, bg, trend }: StatCardProps) {
  const formatted = value == null ? '—' : value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
    ? `${(value / 1_000).toFixed(1)}K`
    : value.toLocaleString();

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 transition-colors flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>{icon}</div>
        {trend && <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{trend}</span>}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>
          {formatted}
          {unit && <span className="text-sm font-medium text-gray-400 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">{children}</h2>;
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = { contentStyle: { borderRadius: 10, border: '1px solid #f3f4f6', fontSize: 12 } };

// ─── Skeleton primitives ──────────────────────────────────────────────────────
function Sk({ w = 'w-full', h = 'h-4', rounded = 'rounded-lg', className = '' }: { w?: string; h?: string; rounded?: string; className?: string }) {
  return <div className={`bg-gray-100 ${w} ${h} ${rounded} ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* ── Stat Cards ── */}
      <section>
        <Sk w="w-24" h="h-3.5" rounded="rounded-md" className="mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-3">
              <Sk w="w-10" h="h-10" rounded="rounded-xl" />
              <div className="space-y-2">
                <Sk w="w-3/4" h="h-2.5" />
                <Sk w="w-1/2" h="h-7" rounded="rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trends ── */}
      <section>
        <Sk w="w-16" h="h-3.5" rounded="rounded-md" className="mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="mb-4 space-y-1.5">
                <Sk w="w-2/5" h="h-3.5" />
                <Sk w="w-3/5" h="h-2.5" />
              </div>
              {/* fake area chart */}
              <div className="relative h-[200px] flex flex-col justify-end gap-0 overflow-hidden">
                <div className="absolute inset-0 flex items-end gap-[3px] px-1">
                  {[40, 65, 50, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((pct, j) => (
                    <div key={j} className="flex-1 bg-gray-100 rounded-t-sm" style={{ height: `${pct}%` }} />
                  ))}
                </div>
                {/* x-axis line */}
                <div className="h-[1px] w-full bg-gray-100 relative z-10" />
                <div className="flex justify-between mt-2 px-1">
                  {Array.from({ length: 4 }).map((_, k) => <Sk key={k} w="w-8" h="h-2" />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Distribution ── */}
      <section>
        <Sk w="w-24" h="h-3.5" rounded="rounded-md" className="mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* District bar chart (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="mb-4 space-y-1.5">
              <Sk w="w-2/5" h="h-3.5" />
              <Sk w="w-3/5" h="h-2.5" />
            </div>
            <div className="h-[220px] flex items-end gap-2 px-1">
              {[70, 90, 55, 100, 45, 75, 60, 85].map((pct, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: `${pct * 1.9}px` }} />
                  <Sk w="w-full" h="h-2" />
                </div>
              ))}
            </div>
          </div>
          {/* Gender donut (1/3) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="mb-4 space-y-1.5">
              <Sk w="w-2/5" h="h-3.5" />
              <Sk w="w-3/5" h="h-2.5" />
            </div>
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="w-[120px] h-[120px] rounded-full bg-gray-100 flex items-center justify-center">
                <div className="w-[76px] h-[76px] rounded-full bg-white" />
              </div>
              <div className="flex gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Sk w="w-2.5" h="h-2.5" rounded="rounded-full" />
                    <Sk w="w-10" h="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Cooperative bar chart */}
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="mb-4 space-y-1.5">
            <Sk w="w-2/5" h="h-3.5" />
            <Sk w="w-3/5" h="h-2.5" />
          </div>
          <div className="h-[200px] flex items-end gap-3 px-1">
            {[80, 60, 100, 45, 70, 55, 90, 65].map((pct, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: `${pct * 1.7}px` }} />
                <Sk w="w-full" h="h-2" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Records (two list panels) ── */}
      <section>
        <Sk w="w-28" h="h-3.5" rounded="rounded-md" className="mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, p) => (
            <div key={p} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* panel header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="space-y-1.5">
                  <Sk w="w-32" h="h-3.5" />
                  <Sk w="w-24" h="h-2.5" />
                </div>
                <Sk w="w-12" h="h-3" />
              </div>
              {/* rows */}
              {Array.from({ length: 6 }).map((_, r) => (
                <div key={r} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                  <Sk w="w-8" h="h-8" rounded="rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Sk w="w-2/5" h="h-3" />
                    <Sk w="w-3/5" h="h-2.5" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Sk w="w-12" h="h-2.5" />
                    <Sk w="w-8" h="h-2" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent Activities ── */}
      <section>
        <Sk w="w-32" h="h-3.5" rounded="rounded-md" className="mb-4" />
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
              <Sk w="w-7" h="h-7" rounded="rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Sk w="w-2/5" h="h-3" />
                <Sk w="w-1/4" h="h-2.5" />
              </div>
              <Sk w="w-12" h="h-2.5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function activityIcon(action: string) {
  if (action.includes('FARMER')) return <UserPlus size={14} className="text-green-600" />;
  if (action.includes('SALE') || action.includes('STOCK') || action.includes('DISTRIBUTOR')) return <Truck size={14} className="text-blue-500" />;
  if (action.includes('MESSAGE')) return <MessageSquare size={14} className="text-purple-500" />;
  return <CheckCircle2 size={14} className="text-gray-400" />;
}

function activityLabel(action: string, detail?: string) {
  const name = detail ? ` — ${detail}` : '';
  if (action === 'FARMER_CREATED') return `Farmer added${name}`;
  if (action === 'SALE_RECORDED') return `Feed distributed${name}`;
  if (action === 'STOCK_ADDED') return `Stock added${name}`;
  if (action === 'MESSAGE_SENT') return `WhatsApp message sent${name}`;
  return action.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) + name;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true); else setRefreshing(true);
    try {
      const res = await axios.get<{ success: boolean; data: DashboardData }>('/api/dashboard');
      setData(res.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      if (isFirst) setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const iv = setInterval(() => fetchData(false), REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchData]);

  const s = data?.stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Overview</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated {lastUpdated.toLocaleTimeString('en-IN')}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchData(false)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? <DashboardSkeleton /> : (
        <>
          {/* ── Alerts ─────────────────────────────────────────────────── */}
          {data?.alerts && data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                  a.severity === 'high'
                    ? 'bg-red-50 border-red-100 text-red-700'
                    : a.severity === 'medium'
                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                    : 'bg-blue-50 border-blue-100 text-blue-700'
                }`}>
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Stat Cards ──────────────────────────────────────────────── */}
          <section>
            <SectionTitle><span>Key Metrics</span></SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard
                icon={<Users size={18} className="text-green-700" />}
                label="Total Farmers"
                value={s?.totalFarmers}
                color="text-gray-900"
                bg="bg-green-50"
              />
              <StatCard
                icon={<Building2 size={18} className="text-blue-700" />}
                label="Cooperatives"
                value={s?.totalCooperatives}
                color="text-gray-900"
                bg="bg-blue-50"
              />
              <StatCard
                icon={<Beef size={18} className="text-orange-700" />}
                label="Total Cows"
                value={s?.totalCows}
                color="text-gray-900"
                bg="bg-orange-50"
              />
              <StatCard
                icon={<Package size={18} className="text-purple-700" />}
                label="Feed Distributed"
                value={s?.totalDistributed}
                unit="kg"
                color="text-gray-900"
                bg="bg-purple-50"
              />
              <StatCard
                icon={<Wind size={18} className="text-teal-700" />}
                label="Methane Reduced"
                value={s?.methaneReduced}
                unit="kg CH₄"
                color="text-teal-700"
                bg="bg-teal-50"
              />
              <StatCard
                icon={<Award size={18} className="text-yellow-700" />}
                label="Carbon Credits"
                value={s?.carbonCredits}
                unit="tCO₂e"
                color="text-yellow-700"
                bg="bg-yellow-50"
              />
            </div>
          </section>

          {/* ── Graphs ──────────────────────────────────────────────────── */}
          <section>
            <SectionTitle><TrendingUp size={14} className="text-gray-500" /><span>Trends</span></SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel title="Farmer Growth" subtitle="New registrations over last 6 months">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.farmerGrowthData ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="farmerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...ChartTooltip} formatter={(v: number) => [v, 'Farmers']} />
                    <Area type="monotone" dataKey="farmers" stroke="#16a34a" strokeWidth={2} fill="url(#farmerGrad)" dot={{ r: 3, fill: '#16a34a' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Feed Distribution" subtitle="Daily kg sold (last 30 days)">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.feedDistributionData ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip {...ChartTooltip} formatter={(v: number) => [`${v} kg`, 'Feed']} />
                    <Area type="monotone" dataKey="kg" stroke="#6366f1" strokeWidth={2} fill="url(#feedGrad)" dot={{ r: 3, fill: '#6366f1' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Methane Reduction" subtitle="Estimated CH₄ reduced (kg) daily">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.methaneReductionData ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="methGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip {...ChartTooltip} formatter={(v: number) => [`${v} kg`, 'CH₄ Reduced']} />
                    <Area type="monotone" dataKey="methane" stroke="#0d9488" strokeWidth={2} fill="url(#methGrad)" dot={{ r: 3, fill: '#0d9488' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </section>

          {/* ── Charts ──────────────────────────────────────────────────── */}
          <section>
            <SectionTitle><span>Distribution</span></SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel title="District-wise Farmers" subtitle="Top 8 districts by farmer count" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.districtData ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="district" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...ChartTooltip} formatter={(v: number) => [v, 'Farmers']} />
                    <Bar dataKey="farmers" radius={[4, 4, 0, 0]}>
                      {(data?.districtData ?? []).map((_, i) => (
                        <Cell key={i} fill={DISTRICT_COLORS[i % DISTRICT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Gender Distribution" subtitle="Farmers by gender">
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data?.genderData ?? []}
                        cx="50%" cy="50%"
                        innerRadius={52} outerRadius={76}
                        paddingAngle={3} dataKey="value"
                      >
                        {(data?.genderData ?? []).map((_, i) => (
                          <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...ChartTooltip} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div className="mt-4">
              <Panel title="Cooperative-wise Farmers" subtitle="Farmer count per cooperative/distributor">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data?.cooperativeData ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...ChartTooltip} formatter={(v: number) => [v, 'Farmers']} />
                    <Bar dataKey="farmers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </section>

          {/* ── Tables ──────────────────────────────────────────────────── */}
          <section>
            <SectionTitle><span>Recent Records</span></SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Farmers */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Recent Farmers</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Latest registrations</p>
                  </div>
                  <a href="/dashboard/farmers" className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                    View all <ChevronRight size={12} />
                  </a>
                </div>
                <div className="divide-y divide-gray-50">
                  {!data?.recentFarmers?.length ? (
                    <p className="text-sm text-gray-400 text-center py-10">No farmers yet.</p>
                  ) : data.recentFarmers.map((f) => (
                    <div key={f._id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {f.name?.[0]?.toUpperCase() || 'F'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{f.district || 'N/A'} · {f.animalCount ?? 0} animals</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-mono text-gray-400">{f.farmerId || '—'}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          f.gender === 'Female' ? 'bg-pink-50 text-pink-600' :
                          f.gender === 'Male' ? 'bg-blue-50 text-blue-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>{f.gender || 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Feed Distribution */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Recent Feed Distribution</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Latest sales transactions</p>
                  </div>
                  <a href="/dashboard/sales" className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                    View all <ChevronRight size={12} />
                  </a>
                </div>
                <div className="divide-y divide-gray-50">
                  {!data?.recentSales?.length ? (
                    <p className="text-sm text-gray-400 text-center py-10">No sales yet.</p>
                  ) : data.recentSales.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                        <Package size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.farmerName || '—'}</p>
                        <p className="text-[11px] text-gray-400">{s.cowCount ?? 0} cows · {s.qtyKg ?? 0} kg</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {s.batchNo && <p className="text-[10px] font-mono text-gray-400">{s.batchNo}</p>}
                        <p className="text-[10px] text-gray-400">{s.saleDate ? new Date(s.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Recent Activities ────────────────────────────────────────── */}
          <section>
            <SectionTitle><span>Recent Activities</span></SectionTitle>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {!data?.recentActivities?.length ? (
                  <p className="text-sm text-gray-400 text-center py-10">No recent activities.</p>
                ) : data.recentActivities.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {activityIcon(a.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{activityLabel(a.action, a.detail)}</p>
                      <p className="text-[11px] text-gray-400 truncate">{a.user}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(a.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
