'use client';

import { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, Tooltip as RechartTooltip,
} from 'recharts';
import {
  Info, Grid3X3, List, ChevronRight, X, CheckCircle2, Star,
  MapPin, Calendar, Building2, Users, Leaf, Droplets, Factory,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
// Two project families × 3 states + selected
type OffsetStatus =
  | 'mm_full'   // Milky Mist — full offset     → grey dark blue
  | 'mm_acc'    // Milky Mist — accumulating     → green light blue
  | 'mm_frac'   // Milky Mist — fractional       → very light blue
  | 'np_full'   // NP project — full offset      → mustard
  | 'np_acc'    // NP project — accumulating     → lighter mustard
  | 'np_frac'   // NP project — fractional       → very light / cream
  | 'selected'; // currently highlighted cube    → blue

interface Cube {
  id: string;
  value: number;
  status: OffsetStatus;
  badge?: 'check' | 'star';
}

// ─── Color palette ────────────────────────────────────────────────────────────
const C: Record<OffsetStatus, { bg: string; color: string; label: string }> = {
  mm_full:  { bg: '#15803d', color: '#ffffff', label: 'Mm Full Offset'    },
  mm_acc:   { bg: '#4ade80', color: '#14532d', label: 'Mm Accumulating'   },
  mm_frac:  { bg: '#dcfce7', color: '#166534', label: 'Mm Fractional'     },
  np_full:  { bg: '#c9870e', color: '#ffffff', label: 'NP Full'           },
  np_acc:   { bg: '#e8c45a', color: '#7a4f10', label: 'ACC'               },
  np_frac:  { bg: '#f7f0dc', color: '#8a6820', label: 'Fractional'        },
  selected: { bg: '#2563eb', color: '#ffffff', label: 'Selected'          },
};

// ─── Cow Icon ────────────────────────────────────────────────────────────────
function CowIcon({ size = 32, color, className }: { size?: number; color?: string; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: className ? undefined : size,
        height: className ? undefined : size,
        flexShrink: 0,
        backgroundColor: color ?? 'currentColor',
        WebkitMaskImage: 'url(/cow.png)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: 'url(/cow.png)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}

// ─── Hardcoded Grid Data ──────────────────────────────────────────────────────
// Rows 1–4: Milky Mist project  |  Rows 5–6: mix with NP project
const GRID: Cube[] = [
  // ── Row 1 — Mm ───────────────────────────────────────────────────────────
  { id: 'r1c1',  value: 0.0025, status: 'mm_frac' },
  { id: 'r1c2',  value: 0.0041, status: 'mm_frac' },
  { id: 'r1c3',  value: 0.0030, status: 'mm_frac' },
  { id: 'r1c4',  value: 0.0012, status: 'mm_frac' },
  { id: 'r1c5',  value: 0.7132, status: 'mm_acc'  },
  { id: 'r1c6',  value: 0.0028, status: 'mm_frac' },
  { id: 'r1c7',  value: 0.0024, status: 'mm_frac' },
  { id: 'r1c8',  value: 0.0034, status: 'mm_frac' },
  { id: 'r1c9',  value: 1.0000, status: 'mm_full' },
  { id: 'r1c10', value: 0.0016, status: 'mm_frac' },
  { id: 'r1c11', value: 0.0029, status: 'mm_frac' },
  { id: 'r1c12', value: 0.0038, status: 'mm_frac' },
  { id: 'r1c13', value: 1.0000, status: 'mm_full', badge: 'check' },
  { id: 'r1c14', value: 0.0011, status: 'mm_frac' },
  // ── Row 2 — Mm ───────────────────────────────────────────────────────────
  { id: 'r2c1',  value: 0.0035, status: 'mm_frac' },
  { id: 'r2c2',  value: 0.0039, status: 'mm_frac' },
  { id: 'r2c3',  value: 0.0024, status: 'mm_frac' },
  { id: 'r2c4',  value: 1.0000, status: 'mm_full' },
  { id: 'r2c5',  value: 0.0028, status: 'mm_frac' },
  { id: 'r2c6',  value: 0.0028, status: 'mm_frac' },
  { id: 'r2c7',  value: 0.9233, status: 'mm_acc'  },
  { id: 'r2c8',  value: 0.0028, status: 'mm_frac' },
  { id: 'r2c9',  value: 0.0028, status: 'mm_frac' },
  { id: 'r2c10', value: 0.0033, status: 'mm_frac' },
  { id: 'r2c11', value: 0.0033, status: 'mm_frac' },
  { id: 'r2c12', value: 0.0028, status: 'mm_frac' },
  { id: 'r2c13', value: 0.0028, status: 'mm_frac' },
  { id: 'r2c14', value: 0.0028, status: 'mm_frac' },
  // ── Row 3 — Mm ───────────────────────────────────────────────────────────
  { id: 'r3c1',  value: 0.8439, status: 'mm_acc',  badge: 'check' },
  { id: 'r3c2',  value: 0.0019, status: 'mm_frac' },
  { id: 'r3c3',  value: 0.0024, status: 'mm_frac' },
  { id: 'r3c4',  value: 0.0024, status: 'mm_frac' },
  { id: 'r3c5',  value: 0.0028, status: 'mm_frac' },
  { id: 'r3c6',  value: 0.0028, status: 'mm_frac' },
  { id: 'r3c7',  value: 1.0000, status: 'mm_full' },
  { id: 'r3c8',  value: 0.0022, status: 'mm_frac' },
  { id: 'r3c9',  value: 0.0028, status: 'mm_frac' },
  { id: 'r3c10', value: 0.0032, status: 'mm_frac' },
  { id: 'r3c11', value: 0.0033, status: 'mm_frac' },
  { id: 'r3c12', value: 0.0028, status: 'mm_frac' },
  { id: 'r3c13', value: 0.0028, status: 'mm_frac' },
  { id: 'r3c14', value: 0.0026, status: 'mm_frac' },
  // ── Row 4 — Mm ───────────────────────────────────────────────────────────
  { id: 'r4c1',  value: 0.0025, status: 'mm_frac' },
  { id: 'r4c2',  value: 0.0009, status: 'mm_frac' },
  { id: 'r4c3',  value: 0.0024, status: 'mm_frac' },
  { id: 'r4c4',  value: 0.0023, status: 'mm_frac' },
  { id: 'r4c5',  value: 0.7785, status: 'mm_acc'  },
  { id: 'r4c6',  value: 0.0028, status: 'mm_frac' },
  { id: 'r4c7',  value: 0.0028, status: 'mm_frac' },
  { id: 'r4c8',  value: 0.0028, status: 'mm_frac' },
  { id: 'r4c9',  value: 0.0035, status: 'mm_frac' },
  { id: 'r4c10', value: 0.0028, status: 'mm_frac' },
  { id: 'r4c11', value: 0.0028, status: 'mm_frac' },
  { id: 'r4c12', value: 0.0028, status: 'mm_frac' },
  { id: 'r4c13', value: 1.0000, status: 'selected', badge: 'star' },
  { id: 'r4c14', value: 0.0028, status: 'mm_frac' },
  // ── Row 5 — NP project starts ────────────────────────────────────────────
  { id: 'r5c1',  value: 0.0023, status: 'np_frac' },
  { id: 'r5c2',  value: 1.0000, status: 'np_full', badge: 'check' },
  { id: 'r5c3',  value: 0.0028, status: 'np_frac' },
  { id: 'r5c4',  value: 0.0022, status: 'np_frac' },
  { id: 'r5c5',  value: 0.0028, status: 'np_frac' },
  { id: 'r5c6',  value: 1.0000, status: 'np_full' },
  { id: 'r5c7',  value: 0.6812, status: 'np_acc'  },
  { id: 'r5c8',  value: 0.0028, status: 'np_frac' },
  { id: 'r5c9',  value: 0.0028, status: 'np_frac' },
  { id: 'r5c10', value: 0.0028, status: 'np_frac' },
  { id: 'r5c11', value: 0.0028, status: 'np_frac' },
  { id: 'r5c12', value: 0.8140, status: 'np_acc'  },
  { id: 'r5c13', value: 0.0028, status: 'np_frac' },
  { id: 'r5c14', value: 0.0026, status: 'np_frac' },
  // ── Row 6 — NP project ───────────────────────────────────────────────────
  { id: 'r6c1',  value: 0.0025, status: 'np_frac' },
  { id: 'r6c2',  value: 0.0030, status: 'np_frac' },
  { id: 'r6c3',  value: 0.0028, status: 'np_frac' },
  { id: 'r6c4',  value: 0.0030, status: 'np_frac' },
  { id: 'r6c5',  value: 0.0028, status: 'np_frac' },
  { id: 'r6c6',  value: 0.0028, status: 'np_frac' },
  { id: 'r6c7',  value: 0.0028, status: 'np_frac' },
  { id: 'r6c8',  value: 0.0028, status: 'np_frac' },
  { id: 'r6c9',  value: 0.0030, status: 'np_frac' },
  { id: 'r6c10', value: 0.0027, status: 'np_frac' },
  { id: 'r6c11', value: 1.0000, status: 'np_full' },
  { id: 'r6c12', value: 0.0028, status: 'np_frac' },
  { id: 'r6c13', value: 0.0020, status: 'np_frac' },
  { id: 'r6c14', value: 0.7390, status: 'np_acc'  },
];

// ─── Other hardcoded data ─────────────────────────────────────────────────────
const TODAY_FLOW_VALS = [0.0025, 0.0031, 0.0018, 0.0040, 0.0022];
const FLOW_ACCUMULATED = 0.2475;

const BY_PROJECT = [
  { name: 'Milky Mist',   value: 4.521,  color: '#22c55e' },
  { name: 'Milma',        value: 3.2142, color: '#3d5a73' },
  { name: 'Akshayakalpa', value: 2.1044, color: '#22c55e' },
  { name: 'Heritage',     value: 1.0025, color: '#c9870e' },
];

const TOP_LOCATIONS = [
  { name: 'Erode, TN',     value: 2.521,  x: 90, y: 152 },
  { name: 'Palakkad, KL',  value: 1.8921, x: 83, y: 158 },
  { name: 'Alappuzha, KL', value: 1.213,  x: 79, y: 165 },
  { name: 'Hassan, KA',    value: 0.9912, x: 87, y: 144 },
  { name: 'Nagaur, RJ',    value: 0.7423, x: 68, y: 72  },
];

const ACTIVITY_DATA = Array.from({ length: 24 }, (_, i) => ({
  t: i,
  v: parseFloat((0.17 + Math.sin(i * 0.65) * 0.032 + i * 0.003).toFixed(4)),
}));

// ─── Per-cube offset detail derivation ───────────────────────────────────────
const MM_SOCIETIES = [
  'MM-024 - Erode Dairy Union',
  'MM-011 - Palakkad Cooperative',
  'MM-036 - Hassan Dairy Society',
  'MM-019 - Alappuzha Milk Union',
];
const NP_SOCIETIES = [
  'NP-007 - Nagaur Dairy Federation',
  'NP-015 - Jodhpur Cooperative',
  'NP-022 - Bikaner Milk Society',
];
const MM_LOCATIONS = ['Erode, Tamil Nadu, India', 'Palakkad, Kerala, India', 'Hassan, Karnataka, India'];
const NP_LOCATIONS = ['Nagaur, Rajasthan, India', 'Jodhpur, Rajasthan, India', 'Bikaner, Rajasthan, India'];

function hashNum(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

function deriveOffsetDetails(cube: Cube) {
  const isMM = cube.status.startsWith('mm') || cube.status === 'selected';
  const h = hashNum(cube.id, 1000);
  const societies = isMM ? MM_SOCIETIES : NP_SOCIETIES;
  const locations  = isMM ? MM_LOCATIONS  : NP_LOCATIONS;
  const isFull = cube.value === 1.0;
  const isAcc  = cube.value >= 0.5 && cube.value < 1.0;
  return {
    id: `#${3400 + h}`,
    project: isMM ? 'Milky Mist Low Carbon Milk Program' : 'NP Dairy Low-Emission Program',
    society: societies[h % societies.length],
    location: locations[h % locations.length],
    generatedOn: `${(h % 28) + 1} ${['Jan','Feb','Mar','Apr','May','Jun'][h % 6]} 2025`,
    ch4owUsed: isFull ? 245 : isAcc ? Math.round(cube.value * 245) : Math.round(cube.value * 245),
    animals: isFull ? 112 : isAcc ? Math.round(cube.value * 112) : Math.max(1, Math.round(cube.value * 112)),
    farmers: isFull ? 38 : isAcc ? Math.round(cube.value * 38) : Math.max(1, Math.round(cube.value * 38)),
    reduction: cube.value,
    status: isFull ? 'Available for Retirement' : isAcc ? 'Accumulating' : 'Fractional — In Progress',
    isMM,
  };
}

const OFFSET_COMPOSITION = [
  { name: 'Society A', value: 18, color: '#93c5fd' },
  { name: 'Society B', value: 12, color: '#4ade80' },
  { name: 'Society C', value: 25, color: '#22c55e' },
  { name: 'Society D', value: 45, color: '#c9870e' },
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
  return (
    <button
      onClick={onClick}
      title={`${cube.id} — ${cube.value.toFixed(4)} tCO₂e`}
      className="relative flex flex-col items-center justify-center rounded-lg p-1 aspect-square hover:opacity-90 hover:scale-105 transition-all duration-100"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        outline: isSelected ? '2.5px solid #2563eb' : undefined,
        outlineOffset: isSelected ? '1px' : undefined,
      }}
    >
      {cube.badge === 'check' && (
        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <CheckCircle2 size={9} />
        </div>
      )}
      {cube.badge === 'star' && (
        <div className="absolute top-0.5 right-0.5">
          <Star size={8} className="fill-yellow-300 text-yellow-300" />
        </div>
      )}
      <CowIcon className="w-5 h-5 sm:w-8 sm:h-8" color={cfg.color} />
      <span className="hidden sm:block text-[7px] font-mono leading-none mt-0.5 tabular-nums" style={{ opacity: 0.85 }}>
        {cube.value.toFixed(4)}
      </span>
    </button>
  );
}

function DetailRow({
  icon, label, value, link, green,
}: {
  icon: React.ReactNode; label: string; value: string; link?: boolean; green?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium ${green ? 'text-green-600' : 'text-gray-800'}`}>
          {value}
          {link && (
            <span className="ml-2 text-green-600 hover:underline cursor-pointer text-[10px]">
              View on Map
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function MilestoneItem({
  label, emoji, name, done, progress,
}: {
  label: string; emoji: string; name: string; done?: boolean; progress?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center min-w-0">
      <div className={`text-xl ${done ? '' : 'opacity-40 grayscale'}`}>{emoji}</div>
      <p className="text-[8px] text-gray-400 leading-none">{label}</p>
      <p className="text-[9px] font-semibold text-gray-600 leading-none">{name}</p>
      {done ? (
        <CheckCircle2 size={11} className="text-green-500" />
      ) : (
        <p className="text-[8px] text-gray-400 leading-none">{progress?.toLocaleString()}</p>
      )}
    </div>
  );
}

function IndiaMapSVG() {
  return (
    <svg viewBox="0 0 160 210" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M62,12 L75,8 L92,9 L108,14 L122,22 L133,34 L140,46 L144,58 L143,72
           L139,84 L141,96 L138,108 L133,120 L127,131 L120,140 L113,149 L108,156
           L103,161 L98,165 L93,167 L89,165 L84,159 L78,150 L71,138 L65,124
           L60,110 L56,96 L54,83 L56,70 L60,57 L62,44 L60,31 Z"
        fill="#dcfce7"
        stroke="#86efac"
        strokeWidth="1.2"
        fillOpacity="0.7"
      />
      {TOP_LOCATIONS.map((loc, i) => (
        <g key={i}>
          <circle cx={loc.x} cy={loc.y} r={6} fill="#22c55e" opacity={0.2} />
          <circle cx={loc.x} cy={loc.y} r={3} fill="#16a34a" />
          <circle cx={loc.x} cy={loc.y} r={1.5} fill="white" />
        </g>
      ))}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isPanelClosing, setIsPanelClosing] = useState(false);

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
              Each cube represents a fractional offset. Cubes combine to form 1 full offset (1 ton CO₂e).
            </p>
          </div>

          {/* Legend + view toggle */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {LEGEND_ORDER.map((s) => <LegendItem key={s} status={s} />)}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <Grid3X3 size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Today's Fractional Flow */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Today's Fractional Flow
          </p>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {TODAY_FLOW_VALS.map((v, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded-lg px-2 py-1.5 border"
                style={{ backgroundColor: C.mm_frac.bg, borderColor: '#b8d4ec' }}
              >
                <CowIcon size={13} color={C.mm_frac.color} />
                <span className="text-[9px] font-mono mt-0.5" style={{ color: C.mm_frac.color }}>
                  {v.toFixed(4)}
                </span>
              </div>
            ))}
            <span className="text-gray-300 px-1">···</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-2xl font-bold text-green-600">{FLOW_ACCUMULATED.toFixed(4)}</span>
            <span className="text-xs text-gray-400">/ 1.0000 tCO₂e</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${FLOW_ACCUMULATED * 100}%`, backgroundColor: C.mm_acc.bg }}
              />
            </div>
            <span className="text-gray-400 text-sm">→</span>
            <div className="text-[10px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-snug max-w-[130px] flex-shrink-0">
              When it reaches 1.0000 tCO₂e it becomes 1 Full Offset
            </div>
          </div>
        </div>

        {/* Offset Matrix Grid */}
        <div className="bg-white rounded-xl border border-gray-100 p-2 sm:p-4">
          <div className="offset-matrix-grid">
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
            { iconColor: '#6b7280', bgColor: '#f3f4f6', value: '0.0025', label: 'Smallest Fraction' },
            { iconColor: C.mm_full.color, bgColor: C.mm_full.bg + '22', value: '1.0000', label: '= 1 Full Offset (1 Ton CO₂e)' },
            { iconColor: '#0d9488', bgColor: '#f0fdfa', value: '8.5396', label: 'In Progress (Tons CO₂e)' },
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
            <button className="mt-2 text-[10px] text-green-600 hover:underline w-full text-left">
              View All Projects
            </button>
          </div>

          {/* By Location */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">By Location (Top 5)</p>
              <button className="text-[10px] text-green-600 hover:underline">View Map</button>
            </div>
            <div className="h-28 mb-2">
              <IndiaMapSVG />
            </div>
            <div className="space-y-0.5">
              {TOP_LOCATIONS.map((loc, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-gray-600 truncate">{loc.name}</span>
                  </div>
                  <span className="text-gray-400 font-mono ml-1 flex-shrink-0">{loc.value.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Milestones</p>
            <div className="flex items-end justify-between gap-1">
              <MilestoneItem label="100 t"     emoji="🌱" name="Sapling"   done />
              <MilestoneItem label="500 t"     emoji="🌳" name="Tree"      done />
              <MilestoneItem label="1,000 t"   emoji="🌲" name="Grove"     done />
              <MilestoneItem label="10,000 t"  emoji="🌿" name="Forest"    progress={5287} />
              <MilestoneItem label="100,000 t" emoji="⛰️" name="Landscape" progress={12842} />
            </div>
          </div>

          {/* Today's Activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">Today's Activity</p>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-gray-900">0.2475</span>
            </div>
            <p className="text-[10px] text-gray-400 mb-0.5">TONS CO₂e</p>
            <p className="text-[10px] text-green-600 font-semibold mb-2">↑ 12.4% vs yesterday</p>
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
                { val: '124',  lbl: 'Cows'    },
                { val: '38',   lbl: 'Farmers' },
                { val: '18K L',lbl: 'Water'   },
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
            <DetailRow icon={<Building2 size={13} />}  label="Society / Cooperative" value={offsetDetails.society} />
            <DetailRow icon={<MapPin size={13} />}     label="Location"              value={offsetDetails.location} link />
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
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">Offset Composition</p>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 flex-shrink-0">
                <PieChart width={80} height={80}>
                  <Pie
                    data={OFFSET_COMPOSITION}
                    cx="50%" cy="50%"
                    innerRadius={20} outerRadius={36}
                    dataKey="value" paddingAngle={1}
                  >
                    {OFFSET_COMPOSITION.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                </PieChart>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {OFFSET_COMPOSITION.map((c, i) => (
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

          {/* Today's Activity (panel) */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Today's Activity</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-lg font-bold text-gray-900">0.2475</span>
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
    </div>
  );
}
