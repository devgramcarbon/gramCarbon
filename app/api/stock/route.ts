import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Distributor from '@/lib/models/Distributor';
import Stock from '@/lib/models/Stock';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, addStockSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { notifyStockLow } from '@/lib/notifications';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import { success, error, unauthorized, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  const query = phone ? { distributorPhone: phone } : {};
  const stocks = await Stock.find(query).lean();
  return success(stocks);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(addStockSchema, {
      phone: body.distributorPhone || body.phone,
      name: body.distributorName || body.name,
      receivedKg: Number(body.receivedKg),
      batchNo: body.batchNo,
    });
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();

    const distributor = await Distributor.findOneAndUpdate(
      { phone: parsed.data.phone },
      { phone: parsed.data.phone, ...(parsed.data.name && { name: parsed.data.name }) },
      { upsert: true, new: true }
    );

    const stock = await Stock.findOneAndUpdate(
      { distributorPhone: parsed.data.phone },
      { $inc: { receivedKg: parsed.data.receivedKg } },
      { upsert: true, new: true }
    );

    const ctx = getAuditContext(request, user);
    await logAudit({
      ...ctx,
      action: 'STOCK_ADDED',
      entity: 'Stock',
      entityId: parsed.data.phone,
      newData: { receivedKg: parsed.data.receivedKg, batchNo: parsed.data.batchNo },
    });

    if (stock) {
      const balance = stock.receivedKg - stock.soldKg;
      if (balance > 0 && balance < 50) {
        await notifyStockLow(distributor?.name || parsed.data.phone, balance);
      }

      emitEvent(EVENTS.STOCK_UPDATED, { phone: parsed.data.phone, stock });
    }
    emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'stock_added' });

    logger.info('Stock updated', { phone: parsed.data.phone, receivedKg: parsed.data.receivedKg, batchNo: parsed.data.batchNo, by: user.email });
    return success(
      { stock, distributor },
      `Stock updated: +${parsed.data.receivedKg}kg for ${parsed.data.phone}`
    );
  } catch (err) {
    logger.error('Failed to update stock', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update stock', 500, err);
  }
}
