import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { getUserFromRequest } from '@/lib/auth';
import { validateFile, uploadToS3 } from '@/lib/s3';
import { recordPaymentProof, closeTicket } from '@/lib/poWorkflow';
import { logAudit, getAuditContext } from '@/lib/audit';
import { withRetry } from '@/lib/retry';
import { success, error, unauthorized, forbidden, notFound } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden('Only ZE Admins can upload payment proof');

  try {
    await connectDB();
    const order = await PurchaseOrder.findById(id);
    if (!order) return notFound('Purchase order not found');
    if (order.status !== 'PAYMENT_REQUESTED') return error('Only POs awaiting payment can have proof uploaded', 400);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return error('No file provided', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateFile(buffer, file.type);
    if (!validation.ok) return error(validation.error || 'Invalid file', 400);

    const { key, url } = await uploadToS3(buffer, file.type, 'po-payment-proof');

    order.paymentProofKey = key;
    order.paymentProofUrl = url;
    order.paymentProofName = file.name;
    await withRetry(() => order.save(), { retries: 3, delayMs: 300, label: `PO save (${order.poNumber} -> payment proof)` });

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_PAYMENT_DONE', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    await recordPaymentProof(order);
    await closeTicket(order);

    logger.info('PO payment proof uploaded, ticket closed', { poNumber: order.poNumber, by: user.email });
    return success(order, 'Payment proof uploaded — PO marked as paid and ticket closed');
  } catch (err) {
    logger.error('Failed to upload PO payment proof', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to upload payment proof', 500, err);
  }
}
