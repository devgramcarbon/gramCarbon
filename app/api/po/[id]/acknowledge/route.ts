import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, acknowledgePurchaseOrderSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, notFound, validationError } from '@/lib/apiResponse';
import { notifyMmProdForAcknowledge } from '@/lib/poWorkflow';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden('Only ZE Admins can acknowledge purchase orders');

  try {
    const body = await request.json();
    const parsed = parseBody(acknowledgePurchaseOrderSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const order = await PurchaseOrder.findById(id);
    if (!order) return notFound('Purchase order not found');
    if (order.status !== 'RECEIVED') return error('Only received purchase orders can be acknowledged', 400);

    order.finalValues = { ...order.finalValues, ...parsed.data };
    order.status = 'ACKNOWLEDGED';
    order.acknowledgedAt = new Date();
    await order.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_ACKNOWLEDGED', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    logger.info('Purchase order acknowledged', { poNumber: order.poNumber, by: user.email });

    try {
      await notifyMmProdForAcknowledge(order);
    } catch (notifyErr) {
      logger.error('Failed to notify MM Production for acknowledge', {
        poNumber: order.poNumber,
        error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }

    return success(order, 'Purchase order acknowledged');
  } catch (err) {
    logger.error('Failed to acknowledge purchase order', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to acknowledge purchase order', 500, err);
  }
}
