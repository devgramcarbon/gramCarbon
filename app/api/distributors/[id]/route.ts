import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Distributor from '@/lib/models/Distributor';
import Stock from '@/lib/models/Stock';
import Sale from '@/lib/models/Sale';
import { getUserFromRequest } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import { normalizeIndianPhone } from '@/lib/validations';
import { success, error, unauthorized, forbidden, notFound } from '@/lib/apiResponse';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const distributor = await Distributor.findById(id);
  if (!distributor) return notFound('Distributor not found');

  const [stock, recentSales] = await Promise.all([
    Stock.findOne({ distributorPhone: distributor.phone }),
    Sale.find({ distributorPhone: distributor.phone }).sort({ saleDate: -1 }).limit(20),
  ]);

  return success({ distributor, stock, recentSales });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    if (body.phone) body.phone = normalizeIndianPhone(String(body.phone));
    await connectDB();
    const dist = await Distributor.findById(id);
    if (!dist) return notFound('Distributor not found');

    const oldData = dist.toObject();
    Object.assign(dist, body);
    await dist.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'DISTRIBUTOR_UPDATED', entity: 'Distributor', entityId: id, oldData, newData: dist.toObject() });

    logger.info('Distributor updated', { id, by: user.email });
    return success(dist, 'Distributor updated');
  } catch (err) {
    logger.error('Failed to update distributor', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update distributor', 500, err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  await connectDB();
  const dist = await Distributor.findByIdAndDelete(id);
  if (!dist) return notFound('Distributor not found');

  const ctx = getAuditContext(request, user);
  await logAudit({ ...ctx, action: 'DISTRIBUTOR_DELETED', entity: 'Distributor', entityId: id, oldData: dist.toObject() });

  return success(null, 'Distributor deleted');
}
