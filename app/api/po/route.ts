import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import BusinessContact from '@/lib/models/BusinessContact';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createPurchaseOrderSchema } from '@/lib/validations';
import { validateFile, uploadToS3 } from '@/lib/s3';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, created, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

// Notified whenever a PO is created: ZE Prod, MM Prod, MM Accounts
const NOTIFY_TARGETS: Array<{ org: 'MILKY_MIST' | 'ZEROEARTH'; department: 'PRODUCTION' | 'ACCOUNTS' }> = [
  { org: 'ZEROEARTH', department: 'PRODUCTION' },
  { org: 'MILKY_MIST', department: 'PRODUCTION' },
  { org: 'MILKY_MIST', department: 'ACCOUNTS' },
];

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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const body = {
      poNumber: formData.get('poNumber'),
      client: formData.get('client'),
      batch: formData.get('batch') || undefined,
      qty: formData.get('qty') || undefined,
      rate: formData.get('rate') || undefined,
      amount: formData.get('amount') || undefined,
      notes: formData.get('notes') || undefined,
    };

    const parsed = parseBody(createPurchaseOrderSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await PurchaseOrder.findOne({ poNumber: parsed.data.poNumber });
    if (existing) return error('A purchase order with this number already exists', 409);

    const { rate, amount, ...poFields } = parsed.data;
    const orderData: Record<string, unknown> = { ...poFields, createdBy: user.userId };

    let fileMeta: { key: string; url: string; name: string } | null = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateFile(buffer, file.type);
      if (!validation.ok) return error(validation.error || 'Invalid file', 400);

      const { key, url } = await uploadToS3(buffer, file.type, 'purchase-orders');
      fileMeta = { key, url, name: file.name };

      orderData.fileKey = key;
      orderData.fileUrl = url;
      orderData.fileName = file.name;
      orderData.status = 'RECEIVED';
      orderData.receivedAt = new Date();
      if (rate !== undefined || amount !== undefined || parsed.data.qty !== undefined) {
        orderData.finalValues = { qty: parsed.data.qty, rate, amount };
      }
    }

    const order = await PurchaseOrder.create(orderData);

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_CREATED', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    const contacts = await BusinessContact.find({ $or: NOTIFY_TARGETS, isActive: true }).lean();
    const buildMessage = (contactName: string) => {
      const lines = [
        `Hi *${contactName}*,`,
        '',
        `A new Purchase Order has been logged.`,
        '',
        `*PO Number:* ${order.poNumber}`,
        `*Client:* ${order.client}`,
      ];
      if (order.batch) lines.push(`*Batch:* ${order.batch}`);
      if (order.qty !== undefined) lines.push(`*Qty:* ${order.qty}`);
      if (order.finalValues?.rate !== undefined) lines.push(`*Rate:* ${order.finalValues.rate}`);
      if (order.finalValues?.amount !== undefined) lines.push(`*Amount:* ₹${order.finalValues.amount}`);
      lines.push('');
      lines.push(fileMeta ? '📄 Document attached — available in the dashboard.' : '_No document attached yet._');
      return lines.join('\n');
    };

    const notifyResults = await Promise.allSettled(
      contacts.map((c) => sendWhatsAppText(c.phone, buildMessage(c.name)))
    );
    const failed = contacts.filter((_, i) => notifyResults[i].status === 'rejected');
    const notifiedCount = contacts.length - failed.length;
    if (failed.length) {
      logger.error('PO created notification failed for some contacts', {
        poNumber: order.poNumber,
        failed: failed.map((c) => `${c.org}/${c.department}`),
      });
    }

    logger.info('Purchase order logged', { poNumber: order.poNumber, by: user.email, withFile: !!fileMeta, notified: notifiedCount });
    return created(order, `Purchase order created — notified ${notifiedCount} contact(s)`);
  } catch (err) {
    logger.error('Failed to create purchase order', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create purchase order', 500, err);
  }
}
