import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CarbonFarmer from '@/lib/models/CarbonFarmer';
import Cattle from '@/lib/models/Cattle';
import FeedBatch from '@/lib/models/FeedBatch';
import FeedLog from '@/lib/models/FeedLog';
import OffsetFormulaVersion from '@/lib/models/OffsetFormulaVersion';
import { getUserFromRequest } from '@/lib/auth';
import { success, unauthorized } from '@/lib/apiResponse';

const TONS_PER_OFFSET = 1;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();

  const [farmerCount, cattleCount, feedLogAgg, dateRange, feedBatches, activeFormula, dailySeries, byPlaceAgg, monthlyStatusAgg, farmerLocations] = await Promise.all([
    CarbonFarmer.countDocuments({ isActive: true }),
    Cattle.countDocuments({ isActive: true }),
    FeedLog.aggregate([
      { $match: { feedGiven: true } },
      {
        $group: {
          _id: null,
          totalFractionalOffsets: { $sum: 1 },
          totalOffsetValue: { $sum: '$offsetValue' },
          verifiedCount: { $sum: { $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0] } },
        },
      },
    ]),
    FeedLog.aggregate([
      { $match: { feedGiven: true } },
      { $group: { _id: null, minDate: { $min: '$logDate' }, maxDate: { $max: '$logDate' } } },
    ]),
    FeedBatch.find().sort({ supplyDate: 1 }).lean(),
    OffsetFormulaVersion.findOne({ isActive: true }).lean<{ offsetPerCowPerDay?: number }>(),
    FeedLog.aggregate([
      { $match: { feedGiven: true } },
      {
        $group: {
          _id: '$logDate',
          dayOffset: { $sum: '$offsetValue' },
          cowDays: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    FeedLog.aggregate([
      { $match: { feedGiven: true } },
      { $lookup: { from: 'carbonfarmers', localField: 'farmer', foreignField: '_id', as: 'farmerDoc' } },
      { $unwind: '$farmerDoc' },
      {
        $group: {
          _id: { $ifNull: ['$farmerDoc.place', 'Unspecified'] },
          offsetValue: { $sum: '$offsetValue' },
          cowDays: { $sum: 1 },
        },
      },
      { $sort: { offsetValue: -1 } },
    ]),
    FeedLog.aggregate([
      { $match: { feedGiven: true } },
      {
        $group: {
          _id: { year: { $year: '$logDate' }, month: { $month: '$logDate' }, day: { $dayOfMonth: '$logDate' } },
        },
      },
      {
        $group: {
          _id: { year: '$_id.year', month: '$_id.month' },
          daysLogged: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    CarbonFarmer.find({ isActive: true, 'location.lat': { $exists: true } })
      .select('name place location')
      .lean<{ name: string; place?: string; location: { lat: number; lng: number } }[]>(),
  ]);

  const agg = feedLogAgg[0] || { totalFractionalOffsets: 0, totalOffsetValue: 0, verifiedCount: 0 };
  const range = dateRange[0] || { minDate: null, maxDate: null };

  const totalOffsetValue = agg.totalOffsetValue || 0;
  const fullOffsets = Math.floor(totalOffsetValue / TONS_PER_OFFSET);
  const fractionalRemainderValue = totalOffsetValue - fullOffsets * TONS_PER_OFFSET;

  const activeDays =
    range.minDate && range.maxDate
      ? Math.round((new Date(range.maxDate).getTime() - new Date(range.minDate).getTime()) / 86400000) + 1
      : 0;

  let cumulative = 0;
  const timeline = dailySeries.map((d: { _id: Date; dayOffset: number; cowDays: number }) => {
    cumulative += d.dayOffset;
    return {
      date: d._id,
      dayOffset: d.dayOffset,
      cowDays: d.cowDays,
      cumulativeOffset: cumulative,
    };
  });

  const byPlace = byPlaceAgg.map((p: { _id: string; offsetValue: number; cowDays: number }) => ({
    place: p._id,
    offsetValue: p.offsetValue || 0,
    cowDays: p.cowDays,
  }));

  const dosedBatches = feedBatches.filter((b) => typeof b.gramsPerAnimalPerDay === 'number');
  const avgGramsPerAnimalPerDay =
    dosedBatches.length > 0
      ? dosedBatches.reduce((sum, b) => sum + (b.gramsPerAnimalPerDay || 0), 0) / dosedBatches.length
      : 0;

  const now = new Date();
  const monthlyStatus = monthlyStatusAgg.map((m: { _id: { year: number; month: number }; daysLogged: number }) => {
    const { year, month } = m._id;
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const isPastMonth = new Date(year, month - 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
    const coverage = daysElapsed > 0 ? m.daysLogged / daysElapsed : 0;
    let status: 'ON_TRACK' | 'PARTIAL' | 'PENDING' = 'PENDING';
    if (isPastMonth || isCurrentMonth) {
      status = coverage >= 0.9 ? 'ON_TRACK' : coverage > 0 ? 'PARTIAL' : 'PENDING';
    }
    return { year, month, daysLogged: m.daysLogged, daysInMonth, status };
  });

  return success({
    animals: cattleCount,
    farmers: farmerCount,
    activeDays,
    dateRange: { from: range.minDate, to: range.maxDate },
    totalFractionalOffsets: agg.totalFractionalOffsets,
    verifiedFractionalOffsets: agg.verifiedCount,
    totalOffsetValueTons: totalOffsetValue,
    fullOffsets,
    fractionalRemainderValue,
    offsetPerCowPerDay: activeFormula?.offsetPerCowPerDay ?? null,
    feedBatches,
    timeline,
    byPlace,
    monthlyStatus,
    avgGramsPerAnimalPerDay,
    farmerLocations: farmerLocations.map((f) => ({ lat: f.location.lat, lng: f.location.lng, label: f.name, place: f.place })),
  });
}
