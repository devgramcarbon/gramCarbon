import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/lib/models/Sale';
import Stock from '@/lib/models/Stock';
import type { IStock } from '@/lib/models/Stock';
import Farmer from '@/lib/models/Farmer';
import Distributor from '@/lib/models/Distributor';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, recordSaleSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import { success, created, error, unauthorized, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const search = searchParams.get('search') || '';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const distributor = searchParams.get('distributor');
  const project = searchParams.get('project');

  const query: Record<string, unknown> = {};
  if (search) query.$or = [{ farmerName: new RegExp(search, 'i') }, { batchNo: new RegExp(search, 'i') }];
  if (distributor) query.distributorPhone = distributor;
  if (project === 'np' || project === 'mm') {
    const distributors = await Distributor.find({ project }).select('phone').lean();
    query.distributorPhone = { $in: distributors.map((d) => d.phone) };
  }
  if (from || to) {
    const saleDate: Record<string, Date> = {};
    if (from) saleDate.$gte = new Date(from);
    if (to) saleDate.$lte = new Date(to);
    query.saleDate = saleDate;
  }

  const [sales, total] = await Promise.all([
    Sale.find(query).sort({ saleDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Sale.countDocuments(query),
  ]);

  return success({ sales, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(recordSaleSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();

    const farmer = await Farmer.findOne({ mobile: parsed.data.farmerMobile, isActive: true }).lean();
    if (!farmer) return error('Farmer is not registered. Please register the farmer first before recording a sale.', 400);

    const stock = await Stock.findOne({ distributorPhone: parsed.data.distributorPhone }).lean<IStock>();
    if (!stock) return error('Distributor not found', 404);

    const balance = stock.receivedKg - stock.soldKg;
    if (balance < parsed.data.qtyKg) {
      return error(`Insufficient stock. Available: ${balance}kg, Requested: ${parsed.data.qtyKg}kg`, 400);
    }

    const [sale] = await Promise.all([
      Sale.create({ ...parsed.data, saleDate: parsed.data.saleDate || new Date() }),
      Stock.findOneAndUpdate(
        { distributorPhone: parsed.data.distributorPhone },
        { $inc: { soldKg: parsed.data.qtyKg } }
      ),
    ]);

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'SALE_RECORDED', entity: 'Sale', entityId: sale._id.toString(), newData: sale.toObject() });

    emitEvent(EVENTS.SALE_RECORDED, { sale: sale.toObject() });
    emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'sale_recorded' });

    logger.info('Sale recorded', { farmerName: sale.farmerName, qtyKg: sale.qtyKg, distributor: sale.distributorPhone, by: user.email });
    return created(sale, 'Sale recorded successfully');
  } catch (err) {
    logger.error('Failed to record sale', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to record sale', 500, err);
  }
}
