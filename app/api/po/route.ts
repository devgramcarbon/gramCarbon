import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createPurchaseOrderSchema } from '@/lib/validations';
import { validateFile, uploadToS3 } from '@/lib/s3';
import { broadcastText } from '@/lib/poWorkflow';
import { logAudit, getAuditContext } from '@/lib/audit';
import { withRetry } from '@/lib/retry';
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

    const order = await withRetry(() => PurchaseOrder.create(orderData), { retries: 3, delayMs: 300, label: `PO create (${orderData.poNumber})` });

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'PO_CREATED', entity: 'PurchaseOrder', entityId: order._id.toString(), newData: order.toObject() });

    const lines = [
      'Hi,',
      '',
      'A new Purchase Order has been logged.',
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
    const message = lines.join('\n');

    await Promise.all(NOTIFY_TARGETS.map((t) => broadcastText(t.org, t.department, message)));

    logger.info('Purchase order logged', { poNumber: order.poNumber, by: user.email, withFile: !!fileMeta });
    return created(order, 'Purchase order created and notifications sent');
  } catch (err) {
    logger.error('Failed to create purchase order', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create purchase order', 500, err);
  }
}
