'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, Tooltip as RechartTooltip,
} from 'recharts';
import {
  Info, Grid3X3, List, ChevronRight, X, CheckCircle2,
  Calendar, Building2, Users, Leaf, Droplets, Factory, Maximize2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
// Two project families × 3 states
type OffsetStatus =
  | 'mm_full'   // Milky Mist — full offset     → grey dark blue
  | 'mm_acc'    // Milky Mist — accumulating     → green light blue
  | 'mm_frac'   // Milky Mist — fractional       → very light blue
  | 'np_full'   // NP project — full offset      → mustard
  | 'np_acc'    // NP project — accumulating     → lighter mustard
  | 'np_frac';  // NP project — fractional       → very light / cream

interface Cube {
  id: string;
  value: number;
  status: OffsetStatus;
  badge?: 'check';
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C: Record<OffsetStatus, { bg: string; color: string; label: string; emptyBg?: string; fillColor?: string }> = {
  mm_full:  { bg: '#9A60A8', color: '#ffffff', label: 'MM Full Offset'    },
  mm_acc:   { bg: '#5cb8c4', color: '#ffffff', label: 'MM Accumulating',   emptyBg: '#daf4f8', fillColor: '#5cb8c4' },
  mm_frac:  { bg: '#daf4f8', color: '#1e4a5f', label: 'MM Fractional',     emptyBg: '#daf4f8', fillColor: '#5cb8c4' },
  np_full:  { bg: '#9A60A8', color: '#ffffff', label: 'NP Full'           },
  np_acc:   { bg: '#e8c45a', color: '#ffffff', label: 'NP Accumulating',   emptyBg: '#f7f0dc', fillColor: '#e8c45a' },
  np_frac:  { bg: '#f7f0dc', color: '#8a6820', label: 'NP Fractional',     emptyBg: '#f7f0dc', fillColor: '#e8c45a' },
};

// ─── Today's Fractional Flow Data ────────────────────────────────────────────
const TODAY_FLOW_TABLE = [
  { mmNo: 504, name: 'Attur',         flow: 1.24, pct: 13.50 },
  { mmNo: 507, name: 'Kabilarmalai',  flow: 0.63, pct:  6.86 },
  { mmNo: 526, name: 'Kallakurichi',  flow: 0.89, pct:  9.78 },
  { mmNo: 508, name: 'Kattuputhur',   flow: 1.00, pct: 10.96 },
  { mmNo: 537, name: 'Namakkal',      flow: 0.36, pct:  3.97 },
  { mmNo: 512, name: 'Rasipuram',     flow: 0.62, pct:  6.79 },
  { mmNo: 520, name: 'Thuraiyur',     flow: 4.42, pct: 48.10 },
];
const TODAY_TOTAL_FLOW = TODAY_FLOW_TABLE.reduce((s, r) => s + r.flow, 0);

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

// ─── Offset Tile ─────────────────────────────────────────────────────────────
function OffsetTile({
  value,
  bg,
  fillColor,
  border,
  iconFilter,
  tooltipBg,
  tooltipColor = '#ffffff',
  progress = 1,
  index,
}: {
  value: string;
  bg: string;
  fillColor?: string;
  border: string;
  iconFilter?: string;
  tooltipBg: string;
  tooltipColor?: string;
  progress?: number;
  index?: number;
}) {
  const loaded = useCowLoaded();
  const fill = fillColor ?? bg;
  return (
    <div className="relative group flex flex-col items-center" style={{ overflow: 'visible' }}>
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
        style={{ backgroundColor: tooltipBg, color: tooltipColor }}
      >
        {value} tCO₂e
      </div>
      <div
        className="relative flex items-center justify-center rounded-xl p-4 border cursor-default overflow-hidden"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        {/* Water fill */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
          style={{ height: `${progress * 100}%`, backgroundColor: progress >= 1 ? fill : undefined }}
        >
          {progress < 1 && (
            <>
              <div className="wave-tile" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, marginTop: -8 }}>
                <svg
                  viewBox="0 0 200 16"
                  preserveAspectRatio="none"
                  className="wave-svg"
                  style={{
                    position: 'absolute',
                    width: '200%',
                    height: '100%',
                    animation: 'wave-flow 1.8s linear infinite',
                  }}
                >
                  <path
                    d="M0,8 C20,0 30,16 50,8 C70,0 80,16 100,8 C120,0 130,16 150,8 C170,0 180,16 200,8 L200,16 L0,16 Z"
                    fill={fill}
                  />
                </svg>
              </div>
              <div style={{ position: 'absolute', top: 8, left: 0, right: 0, bottom: 0, backgroundColor: fill }} />
            </>
          )}
        </div>
        {!loaded ? (
          <div className="w-16 h-16 rounded-xl animate-pulse bg-white/30 relative z-10" />
        ) : (
          <img
            src="/cownew.png"
            alt="cow"
            className="w-16 h-16 object-contain relative z-10"
            style={iconFilter ? { filter: iconFilter } : undefined}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid Data ────────────────────────────────────────────────────────────────
// MM: 65 full (all Kattuputhur) + 2 accumulating + 11 fractional = 78
// NP: 5 full + 1 accumulating (450 cow·days → 0.7397) = 6
// Total: 84 tiles  (6 rows × 14 cols)
const GRID: Cube[] = [
  // ── MM — 65 full credits (Kattuputhur) ───────────────────────────────────
  ...Array.from({ length: 65 }, (_, i): Cube => ({ id: `mmf${i + 1}`, value: 1.0, status: 'mm_full' })),
  // ── MM — 2 accumulating ───────────────────────────────────────────────────
  { id: 'mma1', value: 0.7132, status: 'mm_acc' },
  { id: 'mma2', value: 0.9233, status: 'mm_acc' },
  // ── MM — 11 fractional ───────────────────────────────────────────────────
  { id: 'mmfr1',  value: 0.0025, status: 'mm_frac' },
  { id: 'mmfr2',  value: 0.0041, status: 'mm_frac' },
  { id: 'mmfr3',  value: 0.0030, status: 'mm_frac' },
  { id: 'mmfr4',  value: 0.0012, status: 'mm_frac' },
  { id: 'mmfr5',  value: 0.0028, status: 'mm_frac' },
  { id: 'mmfr6',  value: 0.0024, status: 'mm_frac' },
  { id: 'mmfr7',  value: 0.0034, status: 'mm_frac' },
  { id: 'mmfr8',  value: 0.0016, status: 'mm_frac' },
  { id: 'mmfr9',  value: 0.0029, status: 'mm_frac' },
  { id: 'mmfr10', value: 0.0038, status: 'mm_frac' },
  { id: 'mmfr11', value: 0.0011, status: 'mm_frac' },
  // ── NP — 5 full credits (NainarPalayam) ──────────────────────────────────
  ...Array.from({ length: 5 }, (_, i): Cube => ({ id: `npf${i + 1}`, value: 1.0, status: 'np_full' })),
  // ── NP — 1 accumulating (450 cow·days) ───────────────────────────────────
  { id: 'npa1', value: parseFloat((450 / (365 / 0.6)).toFixed(4)), status: 'np_acc' },
];

// Carbon credit conversion: 1 cow × 365 days = 0.6 tCO₂e  →  1 tCO₂e = 365/0.6 ≈ 608.33 cow·days
const COW_DAYS_PER_CC = 365 / 0.6; // 608.333...

// NainarPalayam farm (separate from Milky Mist MCCs)
const COWS_NAINAR    = 102;
const DAYS_NAINAR    = 275;

// Milky Mist MCCs aggregate (Oct 2025 – May 2026 from spreadsheet)
const MM_TOTAL_FRAC_CREDITS = 370336; // total cow·days across all MCCs
const FULL_CC_TOTAL  = Math.floor(MM_TOTAL_FRAC_CREDITS / COW_DAYS_PER_CC); // 608
const FRAC_CC_TOTAL  = Math.round(MM_TOTAL_FRAC_CREDITS % COW_DAYS_PER_CC); // ~469

// Daily tCO₂e flow based on May 2026 animal count (5590 animals × 0.6 / 365)
const FLOW_ACCUMULATED = parseFloat((5590 * 0.6 / 365).toFixed(4));

// Actual monthly tCO₂e from spreadsheet (cow·days × 0.6 / 365)
const MONTHLY_STATUS = [
  { month: "Oct '25", tCO2: parseFloat((21607           * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Nov '25", tCO2: parseFloat((21750           * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Dec '25", tCO2: parseFloat(((16151 + 15314) * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Jan '26", tCO2: parseFloat(((20646 + 22103) * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Feb '26", tCO2: parseFloat(((20580 + 21140) * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Mar '26", tCO2: parseFloat((19995           * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Apr '26", tCO2: parseFloat((17760           * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "May '26", tCO2: parseFloat((173290          * 0.6 / 365).toFixed(3)), status: 'full'    },
  { month: "Jun '26", tCO2: 0,                                                     status: 'partial' },
  { month: "Jul '26", tCO2: 0,                                                     status: 'pending' },
  { month: "Aug '26", tCO2: 0,                                                     status: 'pending' },
  { month: "Sep '26", tCO2: 0,                                                     status: 'pending' },
];

const BY_PROJECT = [
  { name: 'Milky Mist MCCs', value: parseFloat((370336 * 0.6 / 365).toFixed(4)), color: '#0d9488' },
  { name: 'NainarPalayam',   value: parseFloat((COWS_NAINAR * DAYS_NAINAR * 0.6 / 365).toFixed(4)), color: '#9A60A8' },
];

// All 7 Milky Mist MCCs + NainarPalayam — cow·days × 0.6 / 365 = tCO₂e
const TOP_LOCATIONS = [
  { name: 'Kattuputhur, TN',   value: parseFloat((158672                         * 0.6 / 365).toFixed(4)), lat: 11.10, lon: 77.90 },
  { name: 'Thuraiyur, TN',     value: parseFloat((83359                          * 0.6 / 365).toFixed(4)), lat: 11.15, lon: 78.59 },
  { name: 'Attur, TN',         value: parseFloat((80782                          * 0.6 / 365).toFixed(4)), lat: 11.60, lon: 78.60 },
  { name: 'NainarPalayam, TN', value: parseFloat((COWS_NAINAR * DAYS_NAINAR      * 0.6 / 365).toFixed(4)), lat: 11.38, lon: 77.72 },
  { name: 'Kallakurichi, TN',  value: parseFloat((16957                          * 0.6 / 365).toFixed(4)), lat: 11.74, lon: 78.96 },
  { name: 'Rasipuram, TN',     value: parseFloat((11780                          * 0.6 / 365).toFixed(4)), lat: 11.46, lon: 78.17 },
  { name: 'Kabilarmalai, TN',  value: parseFloat((11904                          * 0.6 / 365).toFixed(4)), lat: 11.40, lon: 78.50 },
  { name: 'Namakkal, TN',      value: parseFloat((6882                           * 0.6 / 365).toFixed(4)), lat: 11.22, lon: 78.17 },
];

// SVG path extents (from in.svg): M-coord range x 173.4–840.5, y 173.8–941.1 within 1000×1000 viewBox
const INDIA_BOUNDS = {
  lonMin: 68, lonMax: 97.5, latMin: 8, latMax: 37.6,
  svgXMin: 173.4, svgXMax: 840.5,
  svgYMin: 173.8, svgYMax: 941.1,
};

// Monthly daily-average tCO₂e (animals × 0.6 / 365)
const ACTIVITY_DATA = [
  { t: 0, v: parseFloat((697  * 0.6 / 365).toFixed(4)) }, // Oct 2025 — 697 animals
  { t: 1, v: parseFloat((725  * 0.6 / 365).toFixed(4)) }, // Nov 2025 — 725
  { t: 2, v: parseFloat((1015 * 0.6 / 365).toFixed(4)) }, // Dec 2025 — 521+494
  { t: 3, v: parseFloat((1379 * 0.6 / 365).toFixed(4)) }, // Jan 2026 — 666+713
  { t: 4, v: parseFloat((1490 * 0.6 / 365).toFixed(4)) }, // Feb 2026 — 735+755
  { t: 5, v: parseFloat((645  * 0.6 / 365).toFixed(4)) }, // Mar 2026 — 645
  { t: 6, v: parseFloat((592  * 0.6 / 365).toFixed(4)) }, // Apr 2026 — 592
  { t: 7, v: parseFloat((5590 * 0.6 / 365).toFixed(4)) }, // May 2026 — 5590 (7 MCCs active)
];

// ─── Per-cube offset detail derivation ───────────────────────────────────────
// Join dates aligned to MM_SOCIETIES order
const MM_JOIN_DATES = [
  { month: 'Oct', year: '2025' }, // Kattuputhur
  { month: 'Dec', year: '2025' }, // Attur
  { month: 'May', year: '2026' }, // Kabilarmalai
  { month: 'May', year: '2026' }, // Kallakurichi
  { month: 'May', year: '2026' }, // Namakkal
  { month: 'May', year: '2026' }, // Rasipuram
  { month: 'May', year: '2026' }, // Thuraiyur
];

// Ordered by join date (Oct → Dec → May)
const MM_SOCIETIES = [
  'MCC-508, Kattuputhur',   // Oct 2025
  'MCC-504, Attur',         // Dec 2025
  'MCC-507, Kabilarmalai',  // May 2026
  'MCC-526, Kallakurichi',  // May 2026
  'MCC-537, Namakkal',      // May 2026
  'MCC-512, Rasipuram',     // May 2026
  'MCC-520, Thuraiyur',     // May 2026
];
const NP_SOCIETIES = ['NainarPalayam Farm'];
const MM_LOCATIONS = [
  'Kattuputhur, TN',
  'Attur, TN',
  'Kabilarmalai, TN',
  'Kallakurichi, TN',
  'Namakkal, TN',
  'Rasipuram, TN',
  'Thuraiyur, TN',
];
const NP_LOCATIONS = ['NainarPalayam, TN'];

const PLACE_COORDS: Record<string, [number, number]> = {
  'Kattuputhur, TN':          [11.10, 77.90],
  'Thuraiyur, TN':            [11.15, 78.59],
  'Attur, TN':                [11.60, 78.60],
  'Kallakurichi, TN':         [11.74, 78.96],
  'Rasipuram, TN':            [11.46, 78.17],
  'Kabilarmalai, TN':         [11.40, 78.50],
  'Namakkal, TN':             [11.22, 78.17],
  'NainarPalayam, TN':        [11.38, 77.72],
  'Nagaur, Rajasthan, India': [27.20, 73.73],
  'Jodhpur, Rajasthan, India':[26.29, 73.02],
  'Bikaner, Rajasthan, India':[28.02, 73.31],
};

function hashNum(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function deriveOffsetDetails(cube: Cube) {
  const isMM = cube.status.startsWith('mm');
  const h = hashNum(cube.id, 1000);
  const isFull = cube.value === 1.0;
  const isAcc  = cube.value >= 0.5 && cube.value < 1.0;

  // ── Society / location resolution ────────────────────────────────────────
  // NP: always NainarPalayam
  // MM full: always Kattuputhur (index 0, joined Oct 2025)
  // MM non-full: cycle through the 6 later-joining MCCs in join-date order
  //   (Attur Dec 2025 first, then the 5 May 2026 MCCs)
  let societyGlobalIdx: number;
  if (!isMM) {
    societyGlobalIdx = 0; // NP_SOCIETIES only has NainarPalayam
  } else if (isFull) {
    societyGlobalIdx = 0; // Kattuputhur
  } else {
    societyGlobalIdx = 1 + (h % 6); // Attur (1) → Thuraiyur (6)
  }

  const society  = isMM ? MM_SOCIETIES[societyGlobalIdx] : NP_SOCIETIES[0];
  const location = isMM ? MM_LOCATIONS[societyGlobalIdx] : NP_LOCATIONS[0];
  const coords   = PLACE_COORDS[location] ?? [20.5937, 78.9629];
  const joinDate = isMM ? MM_JOIN_DATES[societyGlobalIdx] : { month: 'Jan', year: '2025' };

  return {
    id: `#${3400 + h}`,
    project: isMM ? 'Milky Mist Low Carbon Milk Program' : 'NainarPalayam Low Carbon Dairy',
    society,
    location,
    lat: coords[0],
    lon: coords[1],
    generatedOn: `${(h % 28) + 1} ${joinDate.month} ${joinDate.year}`,
    ch4owUsed: isFull ? 245 : Math.round(cube.value * 245),
    animals:   isFull ? 112 : Math.max(1, Math.round(cube.value * 112)),
    farmers:   isFull ? 38  : Math.max(1, Math.round(cube.value * 38)),
    reduction: cube.value,
    status: isFull ? 'Available for Retirement' : isAcc ? 'Accumulating' : 'Fractional — In Progress',
    isMM,
  };
}

const MM_TOTAL_COWDAYS = 370336;
const MM_OFFSET_COMPOSITION = [
  { name: 'MCC-508, Kattuputhur',  cowDays: 158672, color: '#0d9488' },
  { name: 'MCC-520, Thuraiyur',    cowDays: 83359,  color: '#5cb8c4' },
  { name: 'MCC-504, Attur',        cowDays: 80782,  color: '#7c3aed' },
  { name: 'MCC-526, Kallakurichi', cowDays: 16957,  color: '#c9870e' },
  { name: 'MCC-507, Kabilarmalai', cowDays: 11904,  color: '#9A60A8' },
  { name: 'MCC-512, Rasipuram',    cowDays: 11780,  color: '#e8c45a' },
  { name: 'MCC-537, Namakkal',     cowDays: 6882,   color: '#ef4444' },
].map((s) => ({ name: s.name, value: parseFloat((s.cowDays / MM_TOTAL_COWDAYS * 100).toFixed(1)), color: s.color }));

const NP_OFFSET_COMPOSITION = [
  { name: 'NainarPalayam', value: 100, color: '#9A60A8' },
];

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

  return (
    <div className="group relative" style={{ overflow: 'visible' }}>
      {/* Tooltip — above the tile */}
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
        {/* Wave fill for non-full tiles */}
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

        <CowIcon className="cow-icon w-9 h-9 sm:w-14 sm:h-14 relative z-10" color={cfg.color} />

        {/* Project badge — bottom-left */}
        <span
          className="absolute bottom-1 left-1 text-[9px] font-bold leading-none px-1 py-0.5 rounded z-20"
          style={{ color: cfg.color }}
        >
          {cube.status.startsWith('mm') ? 'MM' : 'NP'}
        </span>
      </button>
    </div>
  );
}

function DetailRow({
  icon, label, value, onMapClick, green,
}: {
  icon: React.ReactNode; label: string; value: string; onMapClick?: () => void; green?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium ${green ? 'text-teal-600' : 'text-gray-800'}`}>
          {value}
          {onMapClick && (
            <button
              onClick={onMapClick}
              className="ml-2 text-teal-600 hover:underline text-[10px]"
            >
              View on Map
            </button>
          )}
        </p>
      </div>
    </div>
  );
}


// ─── Map Modal ────────────────────────────────────────────────────────────────
function MapModal({ name, lat, lon, onClose }: { name: string; lat: number; lon: number; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Back-button closes modal
    window.history.pushState({ modal: 'map' }, '');
    const handlePop = () => onClose();
    window.addEventListener('popstate', handlePop);

    // Inject Leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      // Guard against StrictMode double-invoke
      if ((containerRef.current as any)._leaflet_id) return;

      map = L.map(containerRef.current, { center: [lat, lon], zoom: 14, zoomControl: true });

      // CartoDB Positron — clean, light, modern tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      // Custom marker — teal circle with white ring + shadow
      const icon = L.divIcon({
        html: `<div style="width:18px;height:18px;background:#0d9488;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        className: '',
      });
      L.marker([lat, lon], { icon }).addTo(map);
    });

    return () => {
      cancelled = true;
      window.removeEventListener('popstate', handlePop);
      map?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() { window.history.back(); }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#0d9488', boxShadow: '0 0 0 3px rgba(13,148,136,0.15)' }} />
            <p className="text-sm font-bold text-gray-900">{name}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Map container */}
        <div ref={containerRef} style={{ height: 420, width: '100%' }} />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-gray-400 font-mono">
            {lat.toFixed(4)}° N &nbsp;{lon.toFixed(4)}° E
          </span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-teal-600 hover:underline"
          >
            Open full map ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function IndiaMapSVG() {
  return (
    <div className="relative w-full h-full">
      <img src="/in.svg" className="w-full h-full object-fill" alt="India" />
      {TOP_LOCATIONS.map((loc, i) => {
        const svgX = INDIA_BOUNDS.svgXMin + ((loc.lon - INDIA_BOUNDS.lonMin) / (INDIA_BOUNDS.lonMax - INDIA_BOUNDS.lonMin)) * (INDIA_BOUNDS.svgXMax - INDIA_BOUNDS.svgXMin);
        const svgY = INDIA_BOUNDS.svgYMax - ((loc.lat - INDIA_BOUNDS.latMin) / (INDIA_BOUNDS.latMax - INDIA_BOUNDS.latMin)) * (INDIA_BOUNDS.svgYMax - INDIA_BOUNDS.svgYMin);
        const left = `${(svgX / 1000) * 100}%`;
        const top  = `${(svgY / 1000) * 100}%`;
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-default"
            style={{ left, top }}
          >
            <span className="absolute inline-flex h-3.5 w-3.5 -translate-x-[2px] -translate-y-[2px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
            </span>
            <div className="relative w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-md" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
              <div className="bg-gray-900 text-white rounded-lg px-2 py-1.5 whitespace-nowrap text-[9px] shadow-xl">
                <p className="font-semibold leading-tight">{loc.name}</p>
                <p className="text-teal-300 font-mono leading-tight mt-0.5">{loc.value.toFixed(4)} tCO₂e</p>
              </div>
              <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [mapEnlarged, setMapEnlarged] = useState(false);
  const [mapInfo, setMapInfo] = useState<{ name: string; lat: number; lon: number } | null>(null);

  function closePanel() {
    setIsPanelClosing(true);
    setTimeout(() => { setSelectedCubeId(null); setIsPanelClosing(false); }, 350);
  }

  const selectedCube = GRID.find((c) => c.id === selectedCubeId) ?? null;
  const offsetDetails = selectedCube ? deriveOffsetDetails(selectedCube) : null;
  const panelBg = offsetDetails?.isMM ? C.mm_full.bg : C.np_full.bg;
  const panelAccent = offsetDetails?.isMM ? C.mm_acc.bg : C.np_acc.bg;

  // Legend order matches the spreadsheet exactly
  const LEGEND_ORDER: OffsetStatus[] = ['mm_full', 'mm_acc', 'mm_frac', 'np_full', 'np_acc', 'np_frac'];

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ── Left / Main ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Offset Matrix</h1>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <Info size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
             <span className="font-medium text-gray-600">Full</span>, <span className="font-medium text-gray-600">Accumulating</span>, <span className="font-medium text-gray-600">Fractional</span> &nbsp;·&nbsp; 609 cubes combine to form a full offset · Accumulating: &gt; 300 cubes · Fractional: ≤ 300 cubes
            </p>
          </div>

          {/* Legend + view toggle */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {LEGEND_ORDER.map((s) => <LegendItem key={s} status={s} />)}

          </div>
        </div>

        {/* Today's Fractional Flow */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Today's Fractional Flow
          </p>
          <div className="flex items-center gap-2 mb-3 flex-wrap" style={{ overflow: 'visible' }}>
            {Array.from({ length: Math.floor(TODAY_TOTAL_FLOW) }).map((_, i) => (
              <OffsetTile
                key={i}
                value="1.00"
                bg="#e8d5f0"
                fillColor="#9A60A8"
                border="#7a4a88"
                iconFilter="brightness(0) invert(1)"
                tooltipBg="#7a4a88"
                progress={1}
              />
            ))}
            <OffsetTile
              value={(TODAY_TOTAL_FLOW % 1).toFixed(2)}
              bg={C.mm_frac.bg}
              fillColor={C.mm_acc.bg}
              border="#b8d4ec"
              tooltipBg={C.mm_acc.bg}
              tooltipColor={C.mm_frac.color}
              progress={TODAY_TOTAL_FLOW % 1}
            />
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-2xl font-bold text-teal-600">{TODAY_TOTAL_FLOW.toFixed(4)}</span>
            <span className="text-xs text-gray-400">tCO₂e today</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(TODAY_TOTAL_FLOW % 1) * 100}%`, backgroundColor: C.mm_acc.bg }}
              />
            </div>
            <span className="text-gray-400 text-sm">→</span>
            <div className="text-[10px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug max-w-[130px] flex-shrink-0">
              When it reaches 1.0000 tCO₂e it becomes 1 Full Offset
            </div>
          </div>
        </div>

        {/* Offset Matrix Grid */}
        <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-4" style={{ overflow: 'visible' }}>
          <div className={`offset-matrix-grid${selectedCubeId ? ' panel-open' : ''}`} style={{ overflow: 'visible' }}>
            {GRID.map((cube) => (
              <OffsetCube
                key={cube.id}
                cube={cube}
                isSelected={cube.id === selectedCubeId}
                onClick={() => setSelectedCubeId(cube.id)}
              />
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { iconColor: '#7c3aed', bgColor: '#f5f3ff', value: (0.6 / 365).toFixed(4), label: 'Fractional Credit (1 Cow·Day)' },
            { iconColor: '#0f766e', bgColor: '#f0fdfa', value: '1.0000', label: '= 1 Full Offset (609 Cow·Days)' },
            { iconColor: '#b45309', bgColor: '#fffbeb', value: (FULL_CC_TOTAL + FRAC_CC_TOTAL / COW_DAYS_PER_CC).toFixed(4), label: `All MCCs — ${FULL_CC_TOTAL} Full + ${FRAC_CC_TOTAL} Frac CC` },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: s.bgColor }}>
                <CowIcon size={16} color={s.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-400 truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Charts Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* By Project */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">By Project</p>
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie
                  data={BY_PROJECT} cx="50%" cy="50%"
                  innerRadius={30} outerRadius={50}
                  dataKey="value" paddingAngle={2}
                >
                  {BY_PROJECT.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <RechartTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f3f4f6' }}
                  formatter={(v) => [`${v} tCO₂e`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 space-y-1">
              {BY_PROJECT.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-600 truncate">{p.name}</span>
                  </div>
                  <span className="text-gray-400 font-mono ml-1 flex-shrink-0">{p.value.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Location */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">By Location (All 8)</p>
              <button onClick={() => setMapEnlarged(true)} className="text-gray-400 hover:text-teal-600 transition-colors" title="Enlarge map">
                <Maximize2 size={13} />
              </button>
            </div>
            <div className="h-52 mb-2">
              <IndiaMapSVG />
            </div>
            <div className="space-y-0.5">
              {TOP_LOCATIONS.map((loc, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-gray-600 truncate">{loc.name}</span>
                  </div>
                  <span className="text-gray-400 font-mono ml-1 flex-shrink-0">{loc.value.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Status */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Monthly Status</p>
            <div className="grid grid-cols-4 gap-2">
              {MONTHLY_STATUS.map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5" title={m.status !== 'pending' ? `${m.tCO2.toFixed(3)} tCO₂e` : 'Pending'}>
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor:
                        m.status === 'full'    ? '#ccfbf1' :
                        m.status === 'partial' ? '#fef3c7' : '#f3f4f6',
                    }}
                  >
                    {m.status === 'full'    && <CheckCircle2 size={13} className="text-teal-600" />}
                    {m.status === 'partial' && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                    {m.status === 'pending' && <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                  </div>
                  <span className="text-[10px] text-gray-400 leading-none">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[9px] text-gray-400">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-teal-100" /><span>On Track</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-100" /><span>Partial</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-gray-100" /><span>Pending</span></div>
            </div>
          </div>

          {/* Today's Activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">Today's Activity</p>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-gray-900">{TODAY_TOTAL_FLOW.toFixed(4)}</span>
            </div>
            <p className="text-[10px] text-gray-400 mb-0.5">TONS CO₂e</p>
            <p className="text-[10px] text-teal-600 font-semibold mb-2">↑ 12.4% vs yesterday</p>
            <ResponsiveContainer width="100%" height={55}>
              <AreaChart data={ACTIVITY_DATA} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.mm_acc.bg} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.mm_acc.bg} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={C.mm_acc.bg} strokeWidth={1.5} fill="url(#actGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center">
              {[
                { val: '5,590',   lbl: 'Animals'  },
                { val: '2,323',   lbl: 'Farmers'  },
                { val: '34.5K L', lbl: 'Milk/Day' },
              ].map((s, i) => (
                <div key={i}>
                  <p className="text-sm font-bold text-gray-900 leading-none">{s.val}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{s.lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Offset Details ───────────────────────────────────── */}
      {(selectedCube || isPanelClosing) && offsetDetails && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={closePanel}
          />
          <div className={`${isPanelClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'} fixed bottom-0 inset-x-0 z-40 lg:static lg:inset-auto lg:z-auto w-full lg:w-72 lg:flex-shrink-0 bg-white rounded-t-2xl lg:rounded-xl border border-gray-100 p-5 space-y-4 max-h-[85vh] lg:max-h-[calc(100vh-6rem)] overflow-y-auto lg:sticky lg:top-4`}>
          {/* Mobile drag handle */}
          <div className="flex justify-center -mt-1 mb-2 lg:hidden">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Panel header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Offset Details</p>
            <button
              onClick={closePanel}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-100"
            >
              <X size={15} />
            </button>
          </div>

          {/* Offset ID card */}
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: panelBg }}>
            <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <CowIcon size={24} color="#ffffff" />
              <span className="text-[8px] font-bold mt-0.5 text-white">{selectedCube?.value.toFixed(4)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: panelAccent }}>
                Offset ID
              </p>
              <p className="text-xl font-bold leading-none text-white">
                {offsetDetails.id}
              </p>
            </div>
            <span
              className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: panelAccent, color: '#0c3a3f' }}
            >
              {selectedCube?.value === 1.0 ? 'Verified' : 'In Progress'}
            </span>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            <DetailRow icon={<Factory size={13} />}    label="Project"               value={offsetDetails.project} />
            <DetailRow
              icon={<Building2 size={13} />}
              label="Society / Cooperative"
              value={offsetDetails.society}
              onMapClick={() => setMapInfo({ name: offsetDetails.society, lat: offsetDetails.lat, lon: offsetDetails.lon })}
            />
            <DetailRow icon={<Calendar size={13} />}   label="Generated On"          value={offsetDetails.generatedOn} />
            <DetailRow icon={<Droplets size={13} />}   label="CH₄OW Used"            value={`${offsetDetails.ch4owUsed} kg`} />
            <DetailRow icon={<CowIcon size={13} />}    label="Animals"               value={String(offsetDetails.animals)} />
            <DetailRow icon={<Users size={13} />}      label="Farmers"               value={String(offsetDetails.farmers)} />
            <DetailRow icon={<Leaf size={13} />}       label="Reduction"             value={`${offsetDetails.reduction.toFixed(4)} tCO₂e`} />
            <DetailRow icon={<CheckCircle2 size={13} />} label="Status"              value={offsetDetails.status} green />
          </div>

          {/* View Full Details */}
          <button
            className="w-full text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ backgroundColor: panelBg }}
          >
            View Full Details
            <ChevronRight size={14} />
          </button>

          {/* Offset Composition */}
          {(() => {
            const composition = offsetDetails.isMM ? MM_OFFSET_COMPOSITION : NP_OFFSET_COMPOSITION;
            return (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Offset Composition</p>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 flex-shrink-0">
                    <PieChart width={80} height={80}>
                      <Pie
                        data={composition}
                        cx="50%" cy="50%"
                        innerRadius={20} outerRadius={36}
                        dataKey="value" paddingAngle={1}
                      >
                        {composition.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    {composition.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-gray-600 truncate">{c.name}</span>
                        </div>
                        <span className="text-gray-500 font-mono ml-1 flex-shrink-0">{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Today's Activity (panel) */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Today's Activity</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-lg font-bold text-gray-900">{TODAY_TOTAL_FLOW.toFixed(4)}</span>
              <span className="text-[10px] text-gray-400">TONS CO₂e</span>
            </div>
            <ResponsiveContainer width="100%" height={48}>
              <AreaChart data={ACTIVITY_DATA.slice(-14)} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={panelAccent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={panelAccent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={panelAccent} strokeWidth={1.5} fill="url(#panelGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>
      )}

      {/* ── Society Map Modal ──────────────────────────────────────────────── */}
      {mapInfo && (
        <MapModal
          name={mapInfo.name}
          lat={mapInfo.lat}
          lon={mapInfo.lon}
          onClose={() => setMapInfo(null)}
        />
      )}

      {/* ── Map Enlarged Modal ─────────────────────────────────────────────── */}
      {mapEnlarged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setMapEnlarged(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">By Location (All 8)</p>
              <button onClick={() => setMapEnlarged(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row">
              <div className="flex-1 p-4" style={{ minHeight: 380 }}>
                <IndiaMapSVG />
              </div>
              <div className="sm:w-56 border-t sm:border-t-0 sm:border-l border-gray-100 px-5 py-4 flex flex-col justify-center space-y-3">
                {TOP_LOCATIONS.map((loc, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{loc.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{loc.value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
