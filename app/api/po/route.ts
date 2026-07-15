import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createPurchaseOrderSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, created, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden();

  try {
    await connectDB();
    const orders = await PurchaseOrder.find().sort({ createdAt: -1 }).lean();
    return success({ orders });
  } catch (err) {
    logger.error('Failed to load purchase orders', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to load purchase orders', 500, err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden('Only ZE Admins can log purchase orders');

  try {
    const body = await request.json();
    const parsed = parseBody(createPurchaseOrderSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await PurchaseOrder.findOne({ poNumber: parsed.data.poNumber });
    if (existing) return error('A purchase order with this number already exists', 409);

    const order = await PurchaseOrder.create({ ...parsed.data, createdBy: user.userId });

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_CREATED', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    logger.info('Purchase order logged', { poNumber: order.poNumber, by: user.email });
    return created(order, 'Purchase order logged successfully');
  } catch (err) {
    logger.error('Failed to create purchase order', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create purchase order', 500, err);
  }
}
