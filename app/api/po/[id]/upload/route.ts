import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import BusinessContact from '@/lib/models/BusinessContact';
import { getUserFromRequest } from '@/lib/auth';
import { validateFile, uploadToS3 } from '@/lib/s3';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, notFound } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

// Recipients notified once the PO is received: ZE Prod, MM Prod, MM Accounts
const NOTIFY_TARGETS: Array<{ org: 'MILKY_MIST' | 'ZEROEARTH'; department: 'PRODUCTION' | 'ACCOUNTS' }> = [
  { org: 'ZEROEARTH', department: 'PRODUCTION' },
  { org: 'MILKY_MIST', department: 'PRODUCTION' },
  { org: 'MILKY_MIST', department: 'ACCOUNTS' },
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden('Only ZE Admins can upload purchase orders');

  try {
    await connectDB();
    const order = await PurchaseOrder.findById(id);
    if (!order) return notFound('Purchase order not found');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return error('No file provided', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateFile(buffer, file.type);
    if (!validation.ok) return error(validation.error || 'Invalid file', 400);

    const { key, url } = await uploadToS3(buffer, file.type, 'purchase-orders');

    order.fileKey = key;
    order.fileUrl = url;
    order.fileName = file.name;
    order.status = 'RECEIVED';
    order.receivedAt = new Date();
    await order.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_RECEIVED', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    const contacts = await BusinessContact.find({ $or: NOTIFY_TARGETS, isActive: true }).lean();
    const message = `PO Received: ${order.poNumber} (${order.client})${order.batch ? ` — Batch ${order.batch}` : ''}. Document has been uploaded and is available in the dashboard.`;

    const notifyResults = await Promise.allSettled(
      contacts.map((c) => sendWhatsAppText(c.phone, message))
    );
    const failed = contacts.filter((_, i) => notifyResults[i].status === 'rejected');
    if (failed.length) {
      logger.error('PO received notification failed for some contacts', {
        poNumber: order.poNumber,
        failed: failed.map((c) => `${c.org}/${c.department}`),
      });
    }

    logger.info('Purchase order received', { poNumber: order.poNumber, by: user.email, notified: contacts.length - failed.length });
    return success(order, 'PO marked as received and notifications sent');
  } catch (err) {
    logger.error('Failed to upload purchase order', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to upload purchase order', 500, err);
  }
}
