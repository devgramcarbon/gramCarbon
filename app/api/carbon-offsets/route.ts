import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CarbonFarmer from '@/lib/models/CarbonFarmer';
import Cattle from '@/lib/models/Cattle';
import FeedBatch from '@/lib/models/FeedBatch';
import FeedLog from '@/lib/models/FeedLog';
import Settings from '@/lib/models/Settings';
import { getUserFromRequest } from '@/lib/auth';
import { success, unauthorized } from '@/lib/apiResponse';

const TONS_PER_OFFSET = 1;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();

  const [farmerCount, cattleCount, feedLogAgg, dateRange, feedBatches, offsetConstant] = await Promise.all([
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
    Settings.findOne({ key: 'carbon.offsetPerCowPerDay' }).lean(),
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
    offsetPerCowPerDay: ((offsetConstant as { value?: number } | null)?.value) ?? null,
    feedBatches,
  });
}
