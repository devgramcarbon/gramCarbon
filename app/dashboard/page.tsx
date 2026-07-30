'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Info, CheckCircle2, X, Leaf, Users, Calendar } from 'lucide-react';
import { useProjectFilter } from './ProjectFilterContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type OffsetStatus = 'np_full' | 'np_acc' | 'np_frac';

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
};

// Carbon credit conversion: 1 cow × 365 days = 0.68 tCO₂e  →  1 tCO₂e ≈ 536.76 cow·days
const COW_DAYS_PER_CC = 365 / 0.68;

interface MonthlyStatus {
  year: number;
  month: number;
  daysLogged: number;
  daysInMonth: number;
  status: 'ON_TRACK' | 'PARTIAL' | 'PENDING';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_STYLES: Record<MonthlyStatus['status'], string> = {
  ON_TRACK: 'bg-teal-50 text-teal-600 border-teal-100',
  PARTIAL: 'bg-amber-50 text-amber-600 border-amber-100',
  PENDING: 'bg-gray-50 text-gray-400 border-gray-100',
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
function LegendItem({ status }: { status: OffsetStatus }) {
  const cfg = C[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.bg }} />
      <span className="text-[11px] text-gray-600 whitespace-nowrap">{cfg.label}</span>
    </div>
  );
}

function OffsetCube({ cube, onClick, isSelected }: { cube: Cube; onClick: () => void; isSelected: boolean }) {
  const cfg = C[cube.status];
  const isFull = cube.value >= 1.0;
  const emptyBg   = cfg.emptyBg   ?? cfg.bg;
  const fillColor = cfg.fillColor ?? cfg.bg;
  const loaded = useCowLoaded();

  if (!loaded) {
    return <div className="rounded-lg aspect-square animate-pulse bg-gray-200" />;
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

function DetailRow({ icon, label, value, green }: { icon: React.ReactNode; label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium ${green ? 'text-teal-600' : 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function Sk({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />;
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

      <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-4">
        <div className="offset-matrix-grid">
          {Array.from({ length: 40 }).map((_, i) => (
            <Sk key={i} className="aspect-square w-full rounded" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <Sk className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Sk className="h-6 w-24 rounded" />
              <Sk className="h-2.5 w-40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const cowLoaded = useCowLoaded();
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const { project } = useProjectFilter();
  const [npLive, setNpLive] = useState<{
    animals: number;
    farmers: number;
    activeDays: number;
    fullOffsets: number;
    fractionalRemainderValue: number;
    totalOffsetValueTons: number;
    monthlyStatus: MonthlyStatus[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    axios.get<{ success: boolean; data: {
      animals: number; farmers: number; activeDays: number;
      fullOffsets: number; fractionalRemainderValue: number; totalOffsetValueTons: number;
      monthlyStatus: MonthlyStatus[];
    } }>('/api/carbon-offsets')
      .then(({ data }) => { if (data.success) setNpLive(data.data); else setLoadError(true); })
      .catch(() => setLoadError(true));
  }, []);

  if (!cowLoaded || (!npLive && !loadError)) return <DashboardSkeleton />;

  function closePanel() {
    setIsPanelClosing(true);
    setTimeout(() => { setSelectedCubeId(null); setIsPanelClosing(false); }, 350);
  }

  const gridLive: Cube[] = project === 'mm' || !npLive
    ? []
    : [
        ...Array.from({ length: npLive.fullOffsets }, (_, i): Cube => ({ id: `npf${i + 1}`, value: 1.0, status: 'np_full' })),
        ...(npLive.fractionalRemainderValue > 0
          ? [{
              id: 'npa1',
              value: parseFloat(npLive.fractionalRemainderValue.toFixed(4)),
              status: (npLive.fractionalRemainderValue >= 0.5 ? 'np_acc' : 'np_frac') as OffsetStatus,
            }]
          : []),
      ];

  const selectedCube = gridLive.find((c) => c.id === selectedCubeId) ?? null;
  const isFull = selectedCube?.value === 1.0;

  const LEGEND_ORDER: OffsetStatus[] = ['np_full', 'np_acc', 'np_frac'];

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header row */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">Offset Matrix</h1>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Info size={15} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {LEGEND_ORDER.map((s) => <LegendItem key={s} status={s} />)}
          </div>
          <p className="text-xs text-gray-400">
            {Math.round(COW_DAYS_PER_CC)} cow·days combine to form a full offset (1 tCO₂e)
          </p>
        </div>

        {/* Offset Matrix Grid */}
        <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-4" style={{ overflow: 'visible' }}>
          {gridLive.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No offset data available yet.</p>
          ) : (
            <div className={`offset-matrix-grid${selectedCubeId ? ' panel-open' : ''}`} style={{ overflow: 'visible' }}>
              {gridLive.map((cube) => (
                <OffsetCube
                  key={cube.id}
                  cube={cube}
                  isSelected={cube.id === selectedCubeId}
                  onClick={() => setSelectedCubeId(cube.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { iconColor: '#7c3aed', bgColor: '#f5f3ff', value: (0.68 / 365).toFixed(4), label: 'Fractional Credit (1 Cow·Day)' },
            { iconColor: '#0f766e', bgColor: '#f0fdfa', value: '1.0000', label: `= 1 Full Offset (${Math.round(COW_DAYS_PER_CC)} Cow·Days)` },
            {
              iconColor: '#9A60A8', bgColor: '#faf5fb',
              value: (npLive?.totalOffsetValueTons ?? 0).toFixed(4),
              label: `NainarPalayam — ${npLive?.fullOffsets ?? 0} Full Offsets`,
            },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bgColor }}>
                <CowIcon size={16} color={s.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-400 truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly Status */}
        {project !== 'mm' && npLive && npLive.monthlyStatus && npLive.monthlyStatus.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Status</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {npLive.monthlyStatus.map((m) => (
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
          </div>
        )}
      </div>

      {/* ── Right Panel — Offset Details ───────────────────────────────────── */}
      {(selectedCube || isPanelClosing) && selectedCube && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={closePanel} />
          <div className={`${isPanelClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'} fixed bottom-0 inset-x-0 z-40 lg:static lg:inset-auto lg:z-auto w-full lg:w-72 lg:flex-shrink-0 bg-white rounded-t-2xl lg:rounded-xl border border-gray-100 p-5 space-y-4 max-h-[85vh] lg:max-h-[calc(100vh-6rem)] overflow-y-auto lg:sticky lg:top-4`}>
            <div className="flex justify-center -mt-1 mb-2 lg:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Offset Details</p>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: C.np_full.bg }}>
              <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <CowIcon size={24} color="#ffffff" />
                <span className="text-[8px] font-bold mt-0.5 text-white">{selectedCube.value.toFixed(4)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.np_acc.bg }}>Offset</p>
                <p className="text-xl font-bold leading-none text-white">NainarPalayam</p>
              </div>
              <span className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: C.np_acc.bg, color: '#0c3a3f' }}>
                {isFull ? 'Verified' : 'In Progress'}
              </span>
            </div>

            <div className="space-y-3">
              <DetailRow icon={<Leaf size={13} />} label="Reduction" value={`${selectedCube.value.toFixed(4)} tCO₂e`} />
              <DetailRow icon={<CheckCircle2 size={13} />} label="Status" value={isFull ? 'Available for Retirement' : selectedCube.status === 'np_acc' ? 'Accumulating' : 'Fractional — In Progress'} green />
              <DetailRow icon={<Users size={13} />} label="Total Farmers (program)" value={String(npLive?.farmers ?? 0)} />
              <DetailRow icon={<Calendar size={13} />} label="Active Days (program)" value={String(npLive?.activeDays ?? 0)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
