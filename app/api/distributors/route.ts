import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Distributor from '@/lib/models/Distributor';
import Stock from '@/lib/models/Stock';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createDistributorSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import { success, created, error, unauthorized, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const project = searchParams.get('project');

  const query: Record<string, unknown> = {};
  if (search) query.$or = [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }];
  if (project === 'np' || project === 'mm') query.project = project;

  const [distributors, total] = await Promise.all([
    Distributor.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Distributor.countDocuments(query),
  ]);

  const phones = distributors.map((d) => d.phone);
  const stocks = await Stock.find({ distributorPhone: { $in: phones } }).lean();
  const stockMap = Object.fromEntries(stocks.map((s) => [s.distributorPhone, s]));

  const data = distributors.map((d) => ({
    ...d,
    stock: stockMap[d.phone] || { receivedKg: 0, soldKg: 0 },
  }));

  return success({ distributors: data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(createDistributorSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await Distributor.findOne({ phone: parsed.data.phone });
    if (existing) return error('Distributor with this phone already exists', 409);

    const distributor = await Distributor.create(parsed.data);
    await Stock.create({ distributorPhone: parsed.data.phone, receivedKg: 0, soldKg: 0 });

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'DISTRIBUTOR_CREATED', entity: 'Distributor', entityId: distributor._id.toString(), newData: distributor.toObject() });

    await createNotification({ type: 'NEW_DISTRIBUTOR', title: 'New Distributor Added', message: `${distributor.name} (${distributor.phone}) was added.` });
    emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'distributor_added' });

    logger.info('Distributor created', { name: distributor.name, phone: distributor.phone, by: user.email });
    return created(distributor, 'Distributor created successfully');
  } catch (err) {
    logger.error('Failed to create distributor', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create distributor', 500, err);
  }
}
