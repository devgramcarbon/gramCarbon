import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Distributor from '@/lib/models/Distributor';
import Sale from '@/lib/models/Sale';
import Stock from '@/lib/models/Stock';
import Farmer from '@/lib/models/Farmer';
import AuditLog from '@/lib/models/AuditLog';
import type { IAuditLog } from '@/lib/models/AuditLog';
import { getUserFromRequest } from '@/lib/auth';
import { unauthorized, success, error } from '@/lib/apiResponse';
import logger from '@/lib/logger';

// kg feed sold → kg CH4 reduced (literature: ~5% reduction in enteric methane per kg supplement)
const METHANE_FACTOR = 0.05;
// 1 kg CH4 = 25 kg CO2e; convert to tonnes
const CO2E_PER_KG_CH4 = 25 / 1000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    await connectDB();

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);

    const [
      stocks,
      distributors,
      recentSales,
      recentFarmers,
      farmerCount,
      cowAgg,
      salesTrend,
      farmerGrowth,
      districtAgg,
      genderAgg,
      cooperativeAgg,
      recentAuditLogs,
    ] = await Promise.all([
      Stock.find({}).lean(),
      Distributor.find({}).lean(),
      Sale.find({}).sort({ saleDate: -1 }).limit(10).lean(),
      Farmer.find({ isActive: true }).sort({ createdAt: -1 }).limit(8).select('name farmerId district gender animalCount createdAt mobile').lean(),
      Farmer.countDocuments({ isActive: true }),
      Sale.aggregate([{ $group: { _id: null, total: { $sum: '$cowCount' } } }]),
      Sale.aggregate([
        { $match: { saleDate: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }, kgSold: { $sum: '$qtyKg' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Farmer.aggregate([
        { $match: { isActive: true, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Farmer.aggregate([
        { $match: { isActive: true, district: { $exists: true, $ne: '' } } },
        { $group: { _id: '$district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Farmer.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: { $ifNull: ['$gender', 'Unknown'] }, count: { $sum: 1 } } },
      ]),
      Farmer.aggregate([
        { $match: { isActive: true, distributorPhone: { $exists: true, $ne: '' } } },
        { $group: { _id: '$distributorPhone', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(10).select('action entity userEmail createdAt newData').lean<IAuditLog[]>(),
    ]);

    const totalDistributed = stocks.reduce((sum, s) => sum + (s.receivedKg || 0), 0);
    const totalSold = stocks.reduce((sum, s) => sum + (s.soldKg || 0), 0);
    const totalCows = (cowAgg[0] as { total?: number } | undefined)?.total ?? 0;
    const methaneReduced = Math.round(totalSold * METHANE_FACTOR * 100) / 100;
    const carbonCredits = Math.round(methaneReduced * CO2E_PER_KG_CH4 * 100) / 100;
    const totalCooperatives = distributors.length;

    const stockMap = Object.fromEntries(stocks.map((s) => [s.distributorPhone, s]));
    const distributorList = distributors.map((d) => {
      const s = stockMap[d.phone] || { receivedKg: 0, soldKg: 0 };
      return { _id: d._id, phone: d.phone, name: d.name || '—', receivedKg: s.receivedKg, soldKg: s.soldKg, balance: s.receivedKg - s.soldKg };
    });

    // Fill in missing months for farmer growth
    const monthLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const growthMap = Object.fromEntries((farmerGrowth as Array<{ _id: string; count: number }>).map((g) => [g._id, g.count]));
    const farmerGrowthData = monthLabels.map((m) => ({
      month: new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      farmers: growthMap[m] || 0,
    }));

    // Feed distribution trend (last 30 days grouped)
    const feedDistributionData = (salesTrend as Array<{ _id: string; kgSold: number; count: number }>).map((s) => ({
      date: new Date(s._id).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      kg: s.kgSold,
      sales: s.count,
    }));

    // Methane reduction trend (derived from feed distribution)
    const methaneReductionData = feedDistributionData.map((d) => ({
      date: d.date,
      methane: Math.round(d.kg * METHANE_FACTOR * 100) / 100,
    }));

    // District-wise farmers
    const districtData = (districtAgg as Array<{ _id: string; count: number }>).map((d) => ({
      district: d._id,
      farmers: d.count,
    }));

    // Gender distribution
    const genderData = (genderAgg as Array<{ _id: string; count: number }>).map((g) => ({
      name: g._id || 'Unknown',
      value: g.count,
    }));

    // Cooperative-wise farmers
    const distNameMap = Object.fromEntries(distributors.map((d) => [d.phone, d.name || d.phone]));
    const cooperativeData = (cooperativeAgg as Array<{ _id: string; count: number }>).map((c) => ({
      name: distNameMap[c._id] || c._id.slice(-4),
      farmers: c.count,
    }));

    // Alerts
    const alerts: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }> = [];
    distributorList.forEach((d) => {
      if (d.balance < 500 && d.balance >= 0) {
        alerts.push({ type: 'LOW_STOCK', message: `${d.name} has low feed inventory (${d.balance} kg remaining)`, severity: 'high' });
      }
    });
    const pendingVerification = await Farmer.countDocuments({ isActive: true, farmerId: { $exists: false } });
    if (pendingVerification > 0) {
      alerts.push({ type: 'PENDING_VERIFICATION', message: `${pendingVerification} farmer(s) pending ID verification`, severity: 'medium' });
    }

    // Recent activities from audit logs
    const recentActivities = recentAuditLogs.map((log) => ({
      action: log.action,
      entity: log.entity,
      user: log.userEmail,
      timestamp: log.createdAt,
      detail: (log.newData as { name?: string } | undefined)?.name,
    }));

    return success({
      stats: { totalDistributed, totalSold, totalFarmers: farmerCount, totalCows, totalCooperatives, methaneReduced, carbonCredits },
      distributors: distributorList,
      recentSales,
      recentFarmers,
      salesTrend,
      farmerGrowthData,
      feedDistributionData,
      methaneReductionData,
      districtData,
      genderData,
      cooperativeData,
      recentActivities,
      alerts,
    });
  } catch (err) {
    logger.error('Failed to load dashboard', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to load dashboard', 500, err);
  }
}
