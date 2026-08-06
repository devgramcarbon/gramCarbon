import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MmMonthlyData from '@/lib/models/MmMonthlyData';
import { getUserFromRequest } from '@/lib/auth';
import { success, unauthorized } from '@/lib/apiResponse';
import { MM_MCC_LOCATIONS } from '@/lib/mmMccLocations';

const TONS_PER_OFFSET = 1;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();

  const allRows = await MmMonthlyData.find().sort({ year: 1, month: 1, mccCode: 1 }).lean();
  const summaryRow = allRows.find((r) => r.isSummaryRow);
  const rows = allRows.filter((r) => !r.isSummaryRow);

  // Prefer the sheet's own "Total / Average" row — it's the source's authoritative
  // aggregate and doesn't necessarily equal a straight sum of the per-MCC rows.
  const totalCC = summaryRow?.cc ?? rows.reduce((sum, r) => sum + (r.cc || 0), 0);
  const totalFractionalCredits = summaryRow?.fractionalCreditsGenerated ?? rows.reduce((sum, r) => sum + (r.fractionalCreditsGenerated || 0), 0);
  const totalLowCarbonFeedTons = summaryRow?.tonsLowCarbonFeed ?? rows.reduce((sum, r) => sum + (r.tonsLowCarbonFeed || 0), 0);
  const totalMonthlyCollectionLit = summaryRow?.totalMonthlyCollectionLit ?? rows.reduce((sum, r) => sum + (r.totalMonthlyCollectionLit || 0), 0);

  const fullOffsets = Math.floor(totalCC / TONS_PER_OFFSET);
  const fractionalRemainderValue = totalCC - fullOffsets * TONS_PER_OFFSET;

  // Latest month present in the data — used for "current" farmer/animal counts (cumulative rows aren't meaningful to sum across months).
  const latestKey = rows.length ? `${rows[rows.length - 1].year}-${rows[rows.length - 1].month}` : null;
  const latestRows = latestKey ? rows.filter((r) => `${r.year}-${r.month}` === latestKey) : [];
  const latestFarmers = latestRows.reduce((sum, r) => sum + (r.noOfProducersUsingCH4OW || 0), 0);
  const latestAnimals = latestRows.reduce((sum, r) => sum + (r.noOfAnimals || 0), 0);

  const monthOrder = Array.from(
    new Map(rows.map((r) => [`${r.year}-${r.month}`, { year: r.year, month: r.month, monthLabel: r.monthLabel }])).values()
  );

  const monthlyBreakdown = monthOrder.map(({ year, month, monthLabel }) => {
    const monthRows = rows.filter((r) => r.year === year && r.month === month);
    return {
      year,
      month,
      monthLabel,
      cc: monthRows.reduce((sum, r) => sum + (r.cc || 0), 0),
      fractionalCreditsGenerated: monthRows.reduce((sum, r) => sum + (r.fractionalCreditsGenerated || 0), 0),
      farmers: monthRows.reduce((sum, r) => sum + (r.noOfProducersUsingCH4OW || 0), 0),
      animals: monthRows.reduce((sum, r) => sum + (r.noOfAnimals || 0), 0),
      mccs: monthRows.map((r) => r.mccName),
    };
  });

  const byMcc = Object.values(
    rows.reduce((acc: Record<string, { mccCode: string; mccName: string; cc: number; fractionalCreditsGenerated: number; animals: number; farmers: number; lat: number | null; lng: number | null }>, r) => {
      const key = r.mccCode;
      if (!acc[key]) {
        const loc = MM_MCC_LOCATIONS[r.mccCode];
        acc[key] = { mccCode: r.mccCode, mccName: r.mccName, cc: 0, fractionalCreditsGenerated: 0, animals: 0, farmers: 0, lat: loc?.lat ?? null, lng: loc?.lng ?? null };
      }
      acc[key].cc += r.cc || 0;
      acc[key].fractionalCreditsGenerated += r.fractionalCreditsGenerated || 0;
      acc[key].animals = r.noOfAnimals || acc[key].animals;
      acc[key].farmers = r.noOfProducersUsingCH4OW || acc[key].farmers;
      return acc;
    }, {})
  ).sort((a, b) => b.cc - a.cc);

  // Latest month's per-MCC quality stats, used for the "generated on" style detail view.
  const latestMonthLabel = latestRows[0]?.monthLabel ?? null;
  const latestMilkCollectedLit = latestRows.reduce((sum, r) => sum + (r.totalMonthlyCollectionLit || 0), 0);
  const latestCh4owTons = latestRows.reduce((sum, r) => sum + (r.tonsLowCarbonFeed || 0), 0);
  const latestMilkWeight = latestRows.reduce((sum, r) => sum + (r.totalMonthlyCollectionLit || 0), 0) || 1;
  const latestFatPercent = latestRows.reduce((sum, r) => sum + (r.fatPercent || 0) * (r.totalMonthlyCollectionLit || 0), 0) / latestMilkWeight;
  const latestSnfPercent = latestRows.reduce((sum, r) => sum + (r.snfPercent || 0) * (r.totalMonthlyCollectionLit || 0), 0) / latestMilkWeight;

  return success({
    farmers: latestFarmers,
    animals: latestAnimals,
    totalCC,
    fullOffsets,
    fractionalRemainderValue,
    totalFractionalCredits,
    totalLowCarbonFeedTons,
    totalMonthlyCollectionLit,
    monthlyBreakdown,
    byMcc,
    latestMonthLabel,
    latestMilkCollectedLit,
    latestCh4owTons,
    latestFatPercent,
    latestSnfPercent,
  });
}
