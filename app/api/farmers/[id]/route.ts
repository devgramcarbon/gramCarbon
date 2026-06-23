import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Farmer from '@/lib/models/Farmer';
import Sale from '@/lib/models/Sale';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createFarmerSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, notFound, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const farmer = await Farmer.findById(id);
  if (!farmer) return notFound('Farmer not found');

  const sales = await Sale.find({ farmerName: farmer.name }).sort({ saleDate: -1 }).limit(50).lean();
  return success({ farmer, salesHistory: sales });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(createFarmerSchema.partial(), body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const farmer = await Farmer.findById(id);
    if (!farmer) return notFound('Farmer not found');

    const oldData = farmer.toObject();
    Object.assign(farmer, parsed.data);
    await farmer.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'FARMER_UPDATED', entity: 'Farmer', entityId: id, oldData, newData: farmer.toObject() });

    logger.info('Farmer updated', { id, by: user.email });
    return success(farmer, 'Farmer updated');
  } catch (err) {
    logger.error('Failed to update farmer', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update farmer', 500, err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  await connectDB();
  const farmer = await Farmer.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!farmer) return notFound('Farmer not found');

  const ctx = getAuditContext(request, user);
  await logAudit({ ...ctx, action: 'FARMER_DELETED', entity: 'Farmer', entityId: id });

  return success(null, 'Farmer deactivated');
}
