import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/lib/models/Sale';
import Stock from '@/lib/models/Stock';
import Distributor from '@/lib/models/Distributor';
import Farmer from '@/lib/models/Farmer';
import { getUserFromRequest } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import { unauthorized, success, error } from '@/lib/apiResponse';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 86400_000);
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
    const format = searchParams.get('format') || 'json';
    const distributorPhone = searchParams.get('distributor');
    const project = searchParams.get('project');
    const projectFilter = project === 'np' || project === 'mm' ? { project } : {};

    const dateFilter: Record<string, unknown> = { saleDate: { $gte: from, $lte: to } };
    if (distributorPhone) dateFilter.distributorPhone = distributorPhone;

    const distributors = await Distributor.find(projectFilter).lean();
    if (project === 'np' || project === 'mm') {
      dateFilter.distributorPhone = { $in: distributors.map((d) => d.phone) };
    }

    const [sales, farmers, stocks] = await Promise.all([
      Sale.find(dateFilter).sort({ saleDate: -1 }).lean(),
      Farmer.find({ isActive: true, ...projectFilter }).lean(),
      Stock.find(
        project === 'np' || project === 'mm' ? { distributorPhone: { $in: distributors.map((d) => d.phone) } } : {}
      ).lean(),
    ]);

    const stockMap = Object.fromEntries(stocks.map((s) => [s.distributorPhone, s]));

    const reportData = {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalSales: sales.length,
        totalKgSold: sales.reduce((s, sale) => s + sale.qtyKg, 0),
        totalAnimals: sales.reduce((s, sale) => s + sale.cowCount, 0),
        uniqueFarmers: new Set(sales.map((s) => s.farmerName)).size,
        activeDistributors: distributors.length,
        registeredFarmers: farmers.length,
      },
      byDistributor: distributors.map((d) => {
        const distSales = sales.filter((s) => s.distributorPhone === d.phone);
        const stock = stockMap[d.phone] || { receivedKg: 0, soldKg: 0 };
        return {
          name: d.name,
          phone: d.phone,
          totalSales: distSales.length,
          kgSold: distSales.reduce((s, sale) => s + sale.qtyKg, 0),
          stockBalance: stock.receivedKg - stock.soldKg,
          utilizationPct: stock.receivedKg > 0 ? Math.round((stock.soldKg / stock.receivedKg) * 100) : 0,
        };
      }),
      salesData: sales.map((s) => ({
        date: s.saleDate,
        distributor: s.distributorPhone,
        farmer: s.farmerName,
        animals: s.cowCount,
        kgSold: s.qtyKg,
        batchNo: s.batchNo,
      })),
    };

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'gramCarbon Console';

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 30 }, { header: 'Value', key: 'value', width: 20 }];
      Object.entries(reportData.summary).forEach(([k, v]) => summarySheet.addRow({ metric: k, value: v }));

      const salesSheet = workbook.addWorksheet('Sales');
      salesSheet.columns = [
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Distributor', key: 'distributor', width: 20 },
        { header: 'Farmer', key: 'farmer', width: 25 },
        { header: 'Animals', key: 'animals', width: 12 },
        { header: 'Qty (kg)', key: 'kgSold', width: 12 },
        { header: 'Batch No', key: 'batchNo', width: 15 },
      ];
      reportData.salesData.forEach((row) => salesSheet.addRow(row));

      const distSheet = workbook.addWorksheet('Distributors');
      distSheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Total Sales', key: 'totalSales', width: 15 },
        { header: 'Kg Sold', key: 'kgSold', width: 12 },
        { header: 'Balance (kg)', key: 'stockBalance', width: 15 },
        { header: 'Utilization %', key: 'utilizationPct', width: 15 },
      ];
      reportData.byDistributor.forEach((row) => distSheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const ctx = getAuditContext(request, user);
      await logAudit({ ...ctx, action: 'REPORT_GENERATED', entity: 'Report', metadata: { type, format, from, to } });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="gramCarbon Console-report-${Date.now()}.xlsx"`,
        },
      });
    }

    if (format === 'csv') {
      const rows = [
        ['Date', 'Distributor', 'Farmer', 'Animals', 'Qty (kg)', 'Batch No'],
        ...reportData.salesData.map((s) => [
          new Date(s.date as Date).toLocaleDateString(),
          s.distributor,
          s.farmer,
          String(s.animals),
          String(s.kgSold),
          s.batchNo || '',
        ]),
      ];
      const csv = rows.map((r) => r.join(',')).join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="gramCarbon Console-report-${Date.now()}.csv"`,
        },
      });
    }

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'REPORT_GENERATED', entity: 'Report', metadata: { type, format, from, to } });

    return success(reportData);
  } catch (err) {
    return error('Failed to generate report', 500, err);
  }
}
