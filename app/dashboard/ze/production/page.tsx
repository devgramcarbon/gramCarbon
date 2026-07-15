'use client';

import PageHeader from '../../../components/PageHeader';
import Breadcrumbs from '../../../components/Breadcrumbs';

const REGISTER = [
  { member: '0001', days: 8, shifts: 15, totalQty: 54.2, avgQty: 3.61, avgFat: 6.25, avgSnf: 8.13 },
  { member: '0002', days: 8, shifts: 16, totalQty: 159.2, avgQty: 9.95, avgFat: 3.61, avgSnf: 7.58 },
  { member: '0005', days: 1, shifts: 1, totalQty: 17.3, avgQty: 17.3, avgFat: 3.9, avgSnf: 7.6 },
  { member: '0007', days: 30, shifts: 59, totalQty: 789.1, avgQty: 13.37, avgFat: 3.55, avgSnf: 7.85 },
  { member: '0008', days: 27, shifts: 48, totalQty: 415.6, avgQty: 8.66, avgFat: 4.71, avgSnf: 8.06 },
  { member: '0009', days: 1, shifts: 1, totalQty: 3, avgQty: 3, avgFat: 5.4, avgSnf: 7.6 },
  { member: '0012', days: 30, shifts: 60, totalQty: 959.7, avgQty: 15.99, avgFat: 4.24, avgSnf: 7.87 },
  { member: '0013', days: 1, shifts: 1, totalQty: 6.6, avgQty: 6.6, avgFat: 3, avgSnf: 8 },
  { member: '0014', days: 30, shifts: 60, totalQty: 297.7, avgQty: 4.96, avgFat: 4, avgSnf: 7.85 },
  { member: '0015', days: 30, shifts: 59, totalQty: 907.6, avgQty: 15.38, avgFat: 4.52, avgSnf: 7.81 },
  { member: '0022', days: 19, shifts: 26, totalQty: 61.4, avgQty: 2.36, avgFat: 6.01, avgSnf: 7.8 },
  { member: '0029', days: 30, shifts: 60, totalQty: 420, avgQty: 7, avgFat: 3.99, avgSnf: 8.01 },
  { member: '0031', days: 30, shifts: 60, totalQty: 471.4, avgQty: 7.86, avgFat: 4.52, avgSnf: 7.78 },
  { member: '0032', days: 21, shifts: 21, totalQty: 52.3, avgQty: 2.49, avgFat: 8.9, avgSnf: 8.63 },
  { member: '0035', days: 30, shifts: 60, totalQty: 257.9, avgQty: 4.3, avgFat: 5.01, avgSnf: 8.07 },
  { member: '0036', days: 30, shifts: 60, totalQty: 1574.1, avgQty: 26.23, avgFat: 4.41, avgSnf: 7.77 },
  { member: '0037', days: 30, shifts: 60, totalQty: 312.8, avgQty: 5.21, avgFat: 7.96, avgSnf: 8.96 },
  { member: '0038', days: 19, shifts: 37, totalQty: 139.4, avgQty: 3.77, avgFat: 3.88, avgSnf: 7.75 },
  { member: '0039', days: 30, shifts: 60, totalQty: 659.3, avgQty: 10.99, avgFat: 3.92, avgSnf: 8.11 },
  { member: '0040', days: 30, shifts: 60, totalQty: 364.9, avgQty: 6.08, avgFat: 4.87, avgSnf: 8.32 },
  { member: '0041', days: 30, shifts: 60, totalQty: 643.3, avgQty: 10.72, avgFat: 4.23, avgSnf: 8 },
  { member: '0043', days: 30, shifts: 60, totalQty: 226.3, avgQty: 3.77, avgFat: 7.15, avgSnf: 9.22 },
  { member: '0044', days: 30, shifts: 60, totalQty: 346.8, avgQty: 5.78, avgFat: 6.63, avgSnf: 8.44 },
  { member: '0047', days: 30, shifts: 60, totalQty: 193.9, avgQty: 3.23, avgFat: 4.51, avgSnf: 7.75 },
  { member: '0048', days: 30, shifts: 60, totalQty: 281, avgQty: 4.68, avgFat: 3.97, avgSnf: 8.22 },
  { member: '0049', days: 30, shifts: 55, totalQty: 175.4, avgQty: 3.19, avgFat: 4.73, avgSnf: 7.77 },
  { member: '0050', days: 30, shifts: 59, totalQty: 597, avgQty: 10.12, avgFat: 4.21, avgSnf: 7.92 },
  { member: '0051', days: 30, shifts: 39, totalQty: 233.4, avgQty: 5.98, avgFat: 6.08, avgSnf: 8.43 },
  { member: '0052', days: 30, shifts: 60, totalQty: 416.4, avgQty: 6.94, avgFat: 7.44, avgSnf: 9.11 },
  { member: '0053', days: 30, shifts: 60, totalQty: 161.6, avgQty: 2.69, avgFat: 7.04, avgSnf: 8.44 },
  { member: '0054', days: 30, shifts: 60, totalQty: 287.2, avgQty: 4.79, avgFat: 4.25, avgSnf: 7.74 },
  { member: '0055', days: 8, shifts: 14, totalQty: 62, avgQty: 4.43, avgFat: 3.84, avgSnf: 7.7 },
  { member: '0777', days: 30, shifts: 60, totalQty: 2441.3, avgQty: 40.69, avgFat: 4.11, avgSnf: 7.82 },
];

const GRAND_TOTAL_QTY = REGISTER.reduce((s, r) => s + r.totalQty, 0);
const GRAND_TOTAL_SHIFTS = REGISTER.reduce((s, r) => s + r.shifts, 0);

export default function ZeProductionPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: 'Production Oversight', href: '/dashboard/ze/production' }]} />
      <PageHeader title="Production Oversight" description="Milk Collection Register — BMC 508, Society 5080505 (Nov 2025)" />
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="py-2 pr-3 font-semibold">Member</th>
                <th className="py-2 pr-3 font-semibold text-right">Days Collected</th>
                <th className="py-2 pr-3 font-semibold text-right">Shifts</th>
                <th className="py-2 pr-3 font-semibold text-right">Total Qty (L)</th>
                <th className="py-2 pr-3 font-semibold text-right">Avg Qty / Shift (L)</th>
                <th className="py-2 pr-3 font-semibold text-right">Avg FAT%</th>
                <th className="py-2 pr-3 font-semibold text-right">Avg SNF%</th>
              </tr>
            </thead>
            <tbody>
              {REGISTER.map((r) => (
                <tr key={r.member} className="border-b border-gray-50 text-gray-700">
                  <td className="py-2 pr-3 font-mono text-xs bg-gray-50">{r.member}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.days}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.shifts}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.totalQty.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.avgQty}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.avgFat}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.avgSnf}</td>
                </tr>
              ))}
              <tr className="text-gray-900 font-semibold border-t border-gray-200">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-right font-mono">{GRAND_TOTAL_SHIFTS.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono">{GRAND_TOTAL_QTY.toFixed(1).toLocaleString()}</td>
                <td className="py-2 pr-3" colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
