'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import axios from 'axios';
import { Info, CheckCircle2, X, Leaf, Users, Calendar, MapPin, ChevronRight, FolderKanban, Building2, Droplet, Maximize2 } from 'lucide-react';
import { useProjectFilter } from './ProjectFilterContext';
import type { MapMarker } from '../components/OffsetLocationMap';

const OffsetLocationMap = dynamic(() => import('../components/OffsetLocationMap'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
type OffsetStatus = 'np_full' | 'np_acc' | 'np_frac' | 'mm_full' | 'mm_acc' | 'mm_frac';

interface Cube {
  id: string;
  value: number;
  status: OffsetStatus;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C: Record<OffsetStatus, { bg: string; color: string; label: string; emptyBg?: string; fillColor?: string }> = {
  np_full:  { bg: '#C8900A', color: '#ffffff', label: 'Full Offset'        },
  np_acc:   { bg: '#e8c45a', color: '#7a4a00', label: 'Accumulating',   emptyBg: '#f7f0dc', fillColor: '#e8c45a' },
  np_frac:  { bg: '#f7f0dc', color: '#8a6820', label: 'Fractional',     emptyBg: '#f7f0dc', fillColor: '#e8c45a' },
  mm_full:  { bg: '#4a6274', color: '#ffffff', label: 'Full Offset'        },
  mm_acc:   { bg: '#6FA8A3', color: '#1c3a37', label: 'Accumulating',   emptyBg: '#e3f2f5', fillColor: '#6FA8A3' },
  mm_frac:  { bg: '#e3f2f5', color: '#2f6b78', label: 'Fractional',     emptyBg: '#e3f2f5', fillColor: '#6FA8A3' },
};

// Carbon credit conversion: 1 cow × 365 days = 0.68 tCO₂e  →  1 tCO₂e ≈ 536.76 cow·days
const COW_DAYS_PER_CC = 365 / 0.68;
const NP_CUBES_PER_OFFSET = Math.round(COW_DAYS_PER_CC); // 537
const NP_ACC_THRESHOLD = Math.round(NP_CUBES_PER_OFFSET / 2); // 269

// Milky Mist's own fractional-credit → CC conversion ratio (from source data)
const MM_CUBES_PER_OFFSET = 609;
const MM_ACC_THRESHOLD = 300;

function matrixCaption(label: string, cubesPerOffset: number, accThreshold: number): string {
  return `Full, Accumulating, Fractional  ·  ${cubesPerOffset} ${label} combine to form a full offset · Accumulating: > ${accThreshold} ${label} · Fractional: ≤ ${accThreshold} ${label}`;
}

interface MonthlyStatus {
  year: number;
  month: number;
  daysLogged: number;
  daysInMonth: number;
  status: 'ON_TRACK' | 'PARTIAL' | 'PENDING';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CUBE_DISPLAY_LIMIT = 140;

const STATUS_STYLES: Record<MonthlyStatus['status'], string> = {
  ON_TRACK: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  PENDING: 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-[#21262d] dark:text-[#636e7b] dark:border-[#30363d]',
};

// ─── Cow image preloader (singleton) ─────────────────────────────────────────
const _cow = { loaded: false, cbs: new Set<() => void>() };
if (typeof window !== 'undefined') {
  const _preload = new Image();
  _preload.onload = _preload.onerror = () => {
    _cow.loaded = true;
    _cow.cbs.forEach((cb) => cb());
    _cow.cbs.clear();
  };
  _preload.src = '/cownew.png';
}

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

function useCowLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (_cow.loaded) { setLoaded(true); return; }
    const cb = () => setLoaded(true);
    _cow.cbs.add(cb);
    return () => { _cow.cbs.delete(cb); };
  }, []);
  return loaded;
}

// ─── Cow Icon ────────────────────────────────────────────────────────────────
function CowIcon({ size = 32, color, className }: { size?: number; color?: string; className?: string }) {
  const loaded = useCowLoaded();
  const dimStyle: React.CSSProperties = className ? {} : { width: size, height: size, flexShrink: 0 };

  if (!loaded) {
    return (
      <div
        className={`${className ?? ''} rounded-md animate-pulse`}
        style={{ ...dimStyle, backgroundColor: color ? `${color}40` : 'currentColor', opacity: color ? 1 : 0.25 }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...dimStyle,
        backgroundColor: color ?? 'currentColor',
        WebkitMaskImage: 'url(/cownew.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: 'url(/cownew.png)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function OffsetCube({ cube, onClick, isSelected }: { cube: Cube; onClick: () => void; isSelected: boolean }) {
  const cfg = C[cube.status];
  const isFull = cube.value >= 1.0;
  const emptyBg   = cfg.emptyBg   ?? cfg.bg;
  const fillColor = cfg.fillColor ?? cfg.bg;
  const loaded = useCowLoaded();

  if (!loaded) {
    return <div className="rounded-lg aspect-square animate-pulse bg-gray-200 dark:bg-[#30363d]" />;
  }

  return (
    <div className="group relative" style={{ overflow: 'visible' }}>
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-50"
        style={{ backgroundColor: cfg.bg, color: cfg.color, outline: '1px solid rgba(255,255,255,0.3)' }}
      >
        {cube.value.toFixed(4)}
      </div>

      <button
        onClick={onClick}
        className="relative flex flex-col items-center justify-center rounded-lg p-1 aspect-square hover:opacity-90 hover:scale-105 transition-all duration-100 overflow-hidden w-full h-full"
        style={{
          backgroundColor: isFull ? cfg.bg : emptyBg,
          color: cfg.color,
          outline: isSelected ? '2.5px solid #2563eb' : undefined,
          outlineOffset: isSelected ? '1px' : undefined,
        }}
      >
        {!isFull && (
          <div className="absolute bottom-0 left-0 right-0" style={{ height: `${cube.value * 100}%` }}>
            <div className="wave-tile" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, marginTop: -5 }}>
              <svg
                viewBox="0 0 200 10"
                preserveAspectRatio="none"
                className="wave-svg"
                style={{ position: 'absolute', width: '200%', height: '100%', animation: 'wave-flow 1.8s linear infinite' }}
              >
                <path
                  d="M0,5 C20,0 30,10 50,5 C70,0 80,10 100,5 C120,0 130,10 150,5 C170,0 180,10 200,5 L200,10 L0,10 Z"
                  fill={fillColor}
                />
              </svg>
            </div>
            <div style={{ position: 'absolute', top: 5, left: 0, right: 0, bottom: 0, backgroundColor: fillColor }} />
          </div>
        )}

        <CowIcon className="cow-icon w-7 h-7 relative z-10" color={cfg.color} />
      </button>
    </div>
  );
}

const DONUT_COLORS = ['#0f766e', '#6366f1', '#a855f7', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6', '#84cc16'];
const PROJECT_COLORS = ['#2F9E8C', '#9A60A8']; // Milky Mist, NainarPalayam
const PLACE_COLORS = ['#2F9E8C', '#9A60A8', '#D99416', '#3B82F6', '#EF4444', '#6366F1', '#EC4899', '#14b8a6'];

function OffsetDonut({ slices, colors = DONUT_COLORS, valueFormat }: { slices: { label: string; value: number }[]; colors?: string[]; valueFormat?: (v: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 34;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0 -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" className="stroke-gray-100 dark:stroke-[#21262d]" strokeWidth="12" />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * c;
          const offset = acc * c;
          acc += frac;
          return (
            <circle
              key={s.label}
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="12"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <div className="flex-1 min-w-0 space-y-1">
        {slices.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-gray-600 dark:text-[#adbac7] truncate flex-1">{s.label}</span>
            <span className="text-gray-400 dark:text-[#636e7b] flex-shrink-0">{valueFormat ? valueFormat(s.value) : `${((s.value / total) * 100).toFixed(1)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - ((p - min) / range) * (h - 4) - 2}`)
    .join(' ');

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DetailRow({ icon, label, value, green, action }: { icon: React.ReactNode; label: string; value: string; green?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-[#636e7b]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 dark:text-[#636e7b] leading-none mb-0.5">{label}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-medium ${green ? 'text-teal-600 dark:text-teal-400' : 'text-gray-800 dark:text-[#e6edf3]'}`}>{value}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function Sk({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-[#30363d] rounded ${className}`} style={style} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Sk className="h-7 w-32 rounded-md" />
          <Sk className="w-4 h-4 rounded" />
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Sk className="w-3 h-3 rounded-sm flex-shrink-0" />
              <Sk className="h-2.5 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-2 sm:p-4">
        <div className="offset-matrix-grid">
          {Array.from({ length: 40 }).map((_, i) => (
            <Sk key={i} className="aspect-square w-full rounded" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-3">
            <Sk className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Sk className="h-6 w-24 rounded" />
              <Sk className="h-2.5 w-40 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
            <Sk className="h-4 w-20 rounded mb-4" />
            <div className="flex items-center gap-4">
              <Sk className="w-[88px] h-[88px] rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-2.5 w-full rounded" />
                <Sk className="h-2.5 w-3/4 rounded" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
            <Sk className="h-4 w-24 rounded mb-4" />
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Sk className="h-3 w-16 rounded flex-shrink-0" />
                  <Sk className="h-2.5 flex-1 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
          <Sk className="h-4 w-32 rounded mb-4" />
          <Sk className="w-full h-48 rounded-lg" />
        </div>

        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
          <Sk className="h-4 w-28 rounded mb-4" />
          <div className="grid grid-cols-4 gap-2.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <Sk key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const cowLoaded = useCowLoaded();
  const isDark = useIsDark();
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);
  const [showAllCubes, setShowAllCubes] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const { project } = useProjectFilter();
  const [npLive, setNpLive] = useState<{
    animals: number;
    farmers: number;
    activeDays: number;
    fullOffsets: number;
    fractionalRemainderValue: number;
    totalOffsetValueTons: number;
    monthlyStatus: MonthlyStatus[];
    farmerLocations: { lat: number; lng: number; label: string; place?: string }[];
    byPlace: { place: string; offsetValue: number; cowDays: number }[];
    timeline: { date: string; dayOffset: number; cowDays: number; cumulativeOffset: number }[];
    avgGramsPerAnimalPerDay: number;
    dateRange: { from: string | null; to: string | null };
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [mmLive, setMmLive] = useState<{
    farmers: number;
    animals: number;
    totalCC: number;
    fullOffsets: number;
    fractionalRemainderValue: number;
    totalFractionalCredits: number;
    totalLowCarbonFeedTons: number;
    totalMonthlyCollectionLit: number;
    monthlyBreakdown: { year: number; month: number; monthLabel: string; cc: number; fractionalCreditsGenerated: number; farmers: number; animals: number; mccs: string[] }[];
    byMcc: { mccCode: string; mccName: string; cc: number; fractionalCreditsGenerated: number; animals: number; farmers: number; lat: number | null; lng: number | null }[];
    latestMonthLabel: string | null;
    latestMilkCollectedLit: number;
    latestCh4owTons: number;
    latestFatPercent: number;
    latestSnfPercent: number;
  } | null>(null);

  useEffect(() => {
    axios.get<{ success: boolean; data: NonNullable<typeof npLive> }>('/api/carbon-offsets')
      .then(({ data }) => { if (data.success) setNpLive(data.data); else setLoadError(true); })
      .catch(() => setLoadError(true));

    axios.get<{ success: boolean; data: NonNullable<typeof mmLive> }>('/api/mm-offsets')
      .then(({ data }) => { if (data.success) setMmLive(data.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { setShowAllCubes(false); }, [project]);

  if (!cowLoaded || (!npLive && !loadError)) return <DashboardSkeleton />;

  function closePanel() {
    setIsPanelClosing(true);
    setShowMap(false);
    setTimeout(() => { setSelectedCubeId(null); setIsPanelClosing(false); }, 350);
  }

  const npCubes: Cube[] = !npLive
    ? []
    : [
        ...(npLive.fractionalRemainderValue > 0
          ? [{
              id: 'npa1',
              value: parseFloat(npLive.fractionalRemainderValue.toFixed(4)),
              status: (npLive.fractionalRemainderValue >= 0.5 ? 'np_acc' : 'np_frac') as OffsetStatus,
            }]
          : []),
        ...Array.from({ length: npLive.fullOffsets }, (_, i): Cube => ({ id: `npf${i + 1}`, value: 1.0, status: 'np_full' })),
      ];

  const mmCubes: Cube[] = !mmLive
    ? []
    : [
        ...(mmLive.fractionalRemainderValue > 0
          ? [{
              id: 'mma1',
              value: parseFloat(mmLive.fractionalRemainderValue.toFixed(4)),
              status: (mmLive.fractionalRemainderValue >= 0.5 ? 'mm_acc' : 'mm_frac') as OffsetStatus,
            }]
          : []),
        ...Array.from({ length: mmLive.fullOffsets }, (_, i): Cube => ({ id: `mmf${i + 1}`, value: 1.0, status: 'mm_full' })),
      ];

  const gridLive: Cube[] =
    project === 'mm' ? mmCubes : project === 'np' ? npCubes : [...npCubes, ...mmCubes];

  const selectedCube = gridLive.find((c) => c.id === selectedCubeId) ?? null;
  const selectedIndex = selectedCube ? gridLive.findIndex((c) => c.id === selectedCube.id) : -1;
  const isFull = selectedCube?.value === 1.0;
  const selectedIsMm = selectedCube?.status.startsWith('mm') ?? false;
  const offsetIdNum = selectedIndex >= 0 ? (selectedIsMm ? 4000 : 3000) + selectedIndex : 0;

  const selectedMcc =
    selectedIsMm && selectedIndex >= 0 && mmLive?.byMcc?.length
      ? mmLive.byMcc[selectedIndex % mmLive.byMcc.length]
      : null;

  const compositionSlices = selectedIsMm
    ? (mmLive?.byMcc ?? []).filter((m) => m.cc > 0).map((m) => ({ label: m.mccName, value: m.cc }))
    : [{ label: 'NainarPalayam', value: 1 }];

  const sparklinePoints = selectedIsMm
    ? (mmLive?.monthlyBreakdown ?? []).map((m) => m.cc)
    : (npLive?.timeline ?? []).slice(-30).map((t) => t.dayOffset);

  const generatedOn = selectedIsMm
    ? mmLive?.latestMonthLabel ?? null
    : npLive?.dateRange?.to
    ? new Date(npLive.dateRange.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const ch4owUsedKg = selectedCube
    ? selectedIsMm
      ? (mmLive?.latestCh4owTons ?? 0) * 1000 * (isFull ? 1 / Math.max(mmLive?.fullOffsets ?? 1, 1) : selectedCube.value)
      : ((npLive?.avgGramsPerAnimalPerDay ?? 0) * NP_CUBES_PER_OFFSET * selectedCube.value) / 1000
    : 0;

  const mapMarkers: MapMarker[] = selectedIsMm
    ? (selectedMcc && selectedMcc.lat != null && selectedMcc.lng != null
        ? [{ lat: selectedMcc.lat, lng: selectedMcc.lng, label: selectedMcc.mccName, sublabel: `${selectedMcc.cc.toFixed(1)} CC` }]
        : [])
    : (npLive?.farmerLocations ?? []).map((f) => ({ lat: f.lat, lng: f.lng, label: f.label, sublabel: f.place }));

  const LEGEND_ORDER: OffsetStatus[] =
    project === 'mm'
      ? ['mm_full', 'mm_acc', 'mm_frac']
      : project === 'np'
      ? ['np_full', 'np_acc', 'np_frac']
      : ['np_full', 'np_acc', 'np_frac', 'mm_full', 'mm_acc', 'mm_frac'];

  // ── Insights: By Project / By Society / By Location / Monthly Status ──────
  const projectSlices = [
    ...(project !== 'np' && (mmLive?.totalCC ?? 0) > 0 ? [{ label: 'Milky Mist MCCs', value: mmLive!.totalCC }] : []),
    ...(project !== 'mm' && (npLive?.totalOffsetValueTons ?? 0) > 0 ? [{ label: 'NainarPalayam', value: npLive!.totalOffsetValueTons }] : []),
  ];

  const societyItems = [
    ...(project !== 'mm' ? (npLive?.byPlace ?? []).map((p) => ({ name: p.place, value: p.offsetValue })) : []),
    ...(project !== 'np' ? (mmLive?.byMcc ?? []).map((m) => ({ name: m.mccName, value: m.cc })) : []),
  ].sort((a, b) => b.value - a.value);

  const locationMarkers: MapMarker[] = [
    ...(project !== 'mm' ? (npLive?.farmerLocations ?? []).map((f) => ({ lat: f.lat, lng: f.lng, label: f.label, sublabel: f.place })) : []),
    ...(project !== 'np'
      ? (mmLive?.byMcc ?? [])
          .filter((m) => m.lat != null && m.lng != null)
          .map((m) => ({ lat: m.lat as number, lng: m.lng as number, label: m.mccName, sublabel: `${m.cc.toFixed(1)} CC` }))
      : []),
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header row */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-[#e6edf3]">Offset Matrix</h1>
              <button className="text-gray-400 dark:text-[#636e7b] hover:text-gray-600 dark:hover:text-[#adbac7] transition-colors">
                <Info size={15} />
              </button>
            </div>
          </div>
          <div className="space-y-0.5">
            {project === 'np' && (
              <p className="text-xs text-gray-400 dark:text-[#636e7b]">{matrixCaption('cow·days', NP_CUBES_PER_OFFSET, NP_ACC_THRESHOLD)}</p>
            )}
            {project !== 'np' && (
              <p className="text-xs text-gray-400 dark:text-[#636e7b]">{matrixCaption('cubes', MM_CUBES_PER_OFFSET, MM_ACC_THRESHOLD)}</p>
            )}
          </div>
        </div>

        {/* Offset Matrix Grid */}
        <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-2 sm:p-4" style={{ overflow: 'visible' }}>
          {gridLive.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-[#636e7b] text-center py-8">No offset data available yet.</p>
          ) : (
            <>
              <div className={`offset-matrix-grid${selectedCubeId ? ' panel-open' : ''}`} style={{ overflow: 'visible' }}>
                {(showAllCubes ? gridLive : gridLive.slice(0, CUBE_DISPLAY_LIMIT)).map((cube) => (
                  <OffsetCube
                    key={cube.id}
                    cube={cube}
                    isSelected={cube.id === selectedCubeId}
                    onClick={() => { setSelectedCubeId(cube.id); setShowMap(false); }}
                  />
                ))}
              </div>
              {!showAllCubes && gridLive.length > CUBE_DISPLAY_LIMIT && (
                <div className="flex justify-center pt-3">
                  <button
                    onClick={() => setShowAllCubes(true)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
                  >
                    Show {gridLive.length - CUBE_DISPLAY_LIMIT} more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats Row */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${project === 'all' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {[
            { iconColor: '#7c3aed', bgColor: '#f5f3ff', darkBgColor: 'rgba(124,58,237,0.14)', value: (0.68 / 365).toFixed(4), label: 'Fractional Credit (1 Cow·Day)' },
            { iconColor: '#0f766e', bgColor: '#f0fdfa', darkBgColor: 'rgba(15,118,110,0.14)', value: '1.0000', label: `= 1 Full Offset (${Math.round(COW_DAYS_PER_CC)} Cow·Days)` },
            ...(project !== 'mm'
              ? [{
                  iconColor: '#9A60A8', bgColor: '#faf5fb', darkBgColor: 'rgba(154,96,168,0.14)',
                  value: (npLive?.totalOffsetValueTons ?? 0).toFixed(4),
                  label: `NainarPalayam — ${npLive?.fullOffsets ?? 0} Full Offsets`,
                }]
              : []),
            ...(project !== 'np'
              ? [{
                  iconColor: '#4a6274', bgColor: '#eaeef0', darkBgColor: 'rgba(74,98,116,0.18)',
                  value: (mmLive?.totalCC ?? 0).toFixed(4),
                  label: `Milky Mist — ${mmLive?.fullOffsets ?? 0} Full Offsets`,
                }]
              : []),
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isDark ? s.darkBgColor : s.bgColor }}>
                <CowIcon size={16} color={s.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 dark:text-[#e6edf3]">{s.value}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#636e7b] truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Insights: By Project / By Society / By Location / Monthly Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            {projectSlices.length > 0 && (
              <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">By Project</h3>
                <OffsetDonut slices={projectSlices} colors={PROJECT_COLORS} valueFormat={(v) => v.toFixed(4)} />
              </div>
            )}

            {societyItems.length > 0 && (
              <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">By Society</h3>
                <div className="space-y-2.5">
                  {societyItems.map((item, i) => {
                    const max = societyItems[0].value || 1;
                    const pct = Math.max((item.value / max) * 100, 4);
                    return (
                      <div key={`${item.name}-${i}`} className="flex items-center gap-2.5">
                        <span className="text-xs text-gray-500 dark:text-[#768390] w-24 flex-shrink-0 truncate">{item.name}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-[#21262d] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: PLACE_COLORS[i % PLACE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {locationMarkers.length > 0 && (
            <div className="isolate bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5]">By Location (All {locationMarkers.length})</h3>
                <button
                  onClick={() => setShowLocationMap(true)}
                  className="text-gray-400 dark:text-[#636e7b] hover:text-gray-600 dark:hover:text-[#adbac7] p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                  title="Enlarge map"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
              <OffsetLocationMap markers={locationMarkers} color={PROJECT_COLORS[0]} heightClassName="h-48" />
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {societyItems.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PLACE_COLORS[i % PLACE_COLORS.length] }} />
                    <span className="text-gray-600 dark:text-[#adbac7] truncate flex-1">{item.name}</span>
                    <span className="text-gray-400 dark:text-[#636e7b] tabular-nums flex-shrink-0">{item.value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project !== 'mm' && npLive && npLive.monthlyStatus && npLive.monthlyStatus.length > 0 && (
            <div className="bg-white dark:bg-[#161b22] rounded-xl border border-gray-100 dark:border-[#30363d] p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#cdd9e5] mb-4">Monthly Status</h3>
              <div className="grid grid-cols-4 gap-2.5">
                {npLive.monthlyStatus.map((m) => (
                  <div
                    key={`${m.year}-${m.month}`}
                    className={`rounded-xl border p-2.5 text-center ${STATUS_STYLES[m.status]}`}
                    title={`${m.daysLogged}/${m.daysInMonth} days logged`}
                  >
                    {m.status === 'ON_TRACK' ? (
                      <CheckCircle2 size={13} className="mx-auto mb-1" />
                    ) : (
                      <span className="block w-[13px] h-[13px] mx-auto mb-1 rounded-full border-2 border-current" />
                    )}
                    <p className="text-xs font-semibold">{MONTH_NAMES[m.month - 1]}</p>
                    <p className="text-[10px] opacity-70">{m.year}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4 text-[11px] text-gray-500 dark:text-[#768390] flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> On Track</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-[#636e7b] inline-block" /> Pending</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel — Offset Details ───────────────────────────────────── */}
      {(selectedCube || isPanelClosing) && selectedCube && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={closePanel} />
          <div className={`${isPanelClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'} fixed bottom-0 inset-x-0 z-40 lg:static lg:inset-auto lg:z-auto w-full lg:w-72 lg:flex-shrink-0 bg-white dark:bg-[#161b22] rounded-t-2xl lg:rounded-xl border border-gray-100 dark:border-[#30363d] p-5 space-y-4 max-h-[85vh] lg:max-h-[calc(100vh-6rem)] overflow-y-auto lg:sticky lg:top-4`}>
            <div className="flex justify-center -mt-1 mb-2 lg:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-[#30363d]" />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:text-[#e6edf3]">Offset Details</p>
              <button onClick={closePanel} className="text-gray-400 dark:text-[#636e7b] hover:text-gray-600 dark:hover:text-[#adbac7] p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">
                <X size={15} />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: selectedIsMm ? C.mm_full.bg : C.np_full.bg }}>
              <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <CowIcon size={24} color="#ffffff" />
                <span className="text-[8px] font-bold mt-0.5 text-white">{selectedCube.value.toFixed(4)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: selectedIsMm ? C.mm_acc.bg : C.np_acc.bg }}>Offset ID</p>
                <p className="text-xl font-bold leading-none text-white">#{offsetIdNum}</p>
              </div>
              <span className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedIsMm ? C.mm_acc.bg : C.np_acc.bg, color: '#0c3a3f' }}>
                {isFull ? 'Verified' : 'In Progress'}
              </span>
            </div>

            <div className="space-y-3">
              <DetailRow icon={<FolderKanban size={13} />} label="Project" value={selectedIsMm ? 'Milky Mist Low Carbon Milk Program' : 'NainarPalayam Low Carbon Dairy'} />
              <DetailRow
                icon={<Building2 size={13} />}
                label="Society / Cooperative"
                value={selectedIsMm ? selectedMcc?.mccName ?? '—' : 'NainarPalayam Farm'}
                action={
                  mapMarkers.length > 0 ? (
                    <button
                      onClick={() => setShowMap((v) => !v)}
                      className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-0.5"
                    >
                      <MapPin size={11} />
                      {showMap ? 'Hide Map' : 'View on Map'}
                    </button>
                  ) : undefined
                }
              />
              {generatedOn && <DetailRow icon={<Calendar size={13} />} label="Generated On" value={generatedOn} />}
              <DetailRow icon={<Droplet size={13} />} label="CH4OW Used" value={`${ch4owUsedKg.toFixed(1)} kg`} />
              {selectedIsMm ? (
                <>
                  <DetailRow icon={<Calendar size={13} />} label="Animals (latest month)" value={String(mmLive?.animals ?? 0)} />
                  <DetailRow icon={<Users size={13} />} label="Farmers Using CH4OW (latest month)" value={String(mmLive?.farmers ?? 0)} />
                  <DetailRow
                    icon={<Leaf size={13} />}
                    label="Milk Collected (latest month)"
                    value={`${(mmLive?.latestMilkCollectedLit ?? 0).toLocaleString('en-IN')} L · FAT ${(mmLive?.latestFatPercent ?? 0).toFixed(2)}% · SNF ${(mmLive?.latestSnfPercent ?? 0).toFixed(2)}%`}
                  />
                </>
              ) : (
                <>
                  <DetailRow icon={<Calendar size={13} />} label="Animals (program)" value={String(npLive?.animals ?? 0)} />
                  <DetailRow icon={<Users size={13} />} label="Total Farmers (program)" value={String(npLive?.farmers ?? 0)} />
                  <DetailRow icon={<Calendar size={13} />} label="Active Days (program)" value={String(npLive?.activeDays ?? 0)} />
                </>
              )}
              <DetailRow icon={<Leaf size={13} />} label="Reduction" value={`${selectedCube.value.toFixed(4)} tCO₂e`} />
              <DetailRow icon={<CheckCircle2 size={13} />} label="Status" value={isFull ? 'Available for Retirement' : (selectedCube.status === 'np_acc' || selectedCube.status === 'mm_acc') ? 'Accumulating' : 'Fractional — In Progress'} green />
            </div>

            <Link
              href="/dashboard/offset-stats"
              className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-white py-2.5 rounded-xl transition-opacity hover:opacity-90"
              style={{ backgroundColor: selectedIsMm ? C.mm_full.bg : C.np_full.bg }}
            >
              View Full Details
              <ChevronRight size={15} />
            </Link>

            {compositionSlices.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-[#e6edf3] mb-2">Offset Composition</p>
                <OffsetDonut slices={compositionSlices} />
              </div>
            )}

            {sparklinePoints.length >= 2 && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-[#e6edf3]">Recent Activity</p>
                  <p className="text-xs font-semibold" style={{ color: selectedIsMm ? C.mm_full.bg : C.np_full.bg }}>
                    {selectedCube.value.toFixed(4)} <span className="text-[9px] font-normal text-gray-400 dark:text-[#636e7b]">TONS CO₂e</span>
                  </p>
                </div>
                <Sparkline points={sparklinePoints} color={selectedIsMm ? C.mm_full.bg : C.np_full.bg} />
              </div>
            )}

          </div>
        </>
      )}

      {showMap && mapMarkers.length > 0 && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowMap(false)}>
          <div className="bg-white dark:bg-[#161b22] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#30363d]">
              <p className="text-sm font-bold text-gray-900 dark:text-[#e6edf3]">Society / Cooperative Locations</p>
              <button onClick={() => setShowMap(false)} className="text-gray-400 dark:text-[#636e7b] hover:text-gray-600 dark:hover:text-[#adbac7] p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <OffsetLocationMap markers={mapMarkers} color={selectedIsMm ? C.mm_full.bg : C.np_full.bg} />
            </div>
          </div>
        </div>
      )}

      {showLocationMap && locationMarkers.length > 0 && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowLocationMap(false)}>
          <div className="bg-white dark:bg-[#161b22] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#30363d]">
              <p className="text-sm font-bold text-gray-900 dark:text-[#e6edf3]">By Location (All {locationMarkers.length})</p>
              <button onClick={() => setShowLocationMap(false)} className="text-gray-400 dark:text-[#636e7b] hover:text-gray-600 dark:hover:text-[#adbac7] p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <OffsetLocationMap markers={locationMarkers} color={PROJECT_COLORS[0]} heightClassName="h-96" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
