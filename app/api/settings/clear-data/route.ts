import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import { unauthorized, forbidden, success, error } from '@/lib/apiResponse';
import logger from '@/lib/logger';

import Sale from '@/lib/models/Sale';
import Stock from '@/lib/models/Stock';
import Notification from '@/lib/models/Notification';
import BotSession from '@/lib/models/BotSession';
import BusinessContact from '@/lib/models/BusinessContact';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import AuditLog from '@/lib/models/AuditLog';
import CampLead from '@/lib/models/CampLead';
import CarbonFarmer from '@/lib/models/CarbonFarmer';
import FeedBatch from '@/lib/models/FeedBatch';
import OffsetBatch from '@/lib/models/OffsetBatch';
import Distributor from '@/lib/models/Distributor';
import Farmer from '@/lib/models/Farmer';
import OffsetFormulaVersion from '@/lib/models/OffsetFormulaVersion';
import FeedLog from '@/lib/models/FeedLog';
import Cattle from '@/lib/models/Cattle';

const CONFIRM_PHRASE = 'DELETE ALL DATA';

// Settings and User are intentionally excluded so the app remains configured and usable after a wipe.
const MODELS_TO_CLEAR = [
  { name: 'Sale', model: Sale },
  { name: 'Stock', model: Stock },
  { name: 'Notification', model: Notification },
  { name: 'BotSession', model: BotSession },
  { name: 'BusinessContact', model: BusinessContact },
  { name: 'PurchaseOrder', model: PurchaseOrder },
  { name: 'AuditLog', model: AuditLog },
  { name: 'CampLead', model: CampLead },
  { name: 'CarbonFarmer', model: CarbonFarmer },
  { name: 'FeedBatch', model: FeedBatch },
  { name: 'OffsetBatch', model: OffsetBatch },
  { name: 'Distributor', model: Distributor },
  { name: 'Farmer', model: Farmer },
  { name: 'OffsetFormulaVersion', model: OffsetFormulaVersion },
  { name: 'FeedLog', model: FeedLog },
  { name: 'Cattle', model: Cattle },
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden();

  let confirm: string | undefined;
  try {
    const body = await request.json();
    confirm = body?.confirm;
  } catch {
    return error('Invalid request body', 400);
  }

  if (confirm !== CONFIRM_PHRASE) {
    return error(`Confirmation phrase mismatch. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`, 400);
  }

  await connectDB();

  const results: Record<string, number> = {};
  for (const { name, model } of MODELS_TO_CLEAR) {
    const res = await model.deleteMany({});
    results[name] = res.deletedCount ?? 0;
  }

  const ctx = getAuditContext(request, user);
  await logAudit({ ...ctx, action: 'SETTINGS_CHANGED', entity: 'Database', entityId: 'clear-all-data', newData: results });

  logger.warn('All application data cleared', { by: user.email, results });

  return success(results, 'All data cleared (Settings and Users preserved)');
}
