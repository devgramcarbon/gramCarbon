import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Farmer from '@/lib/models/Farmer';
import CarbonFarmer from '@/lib/models/CarbonFarmer';
import Cattle from '@/lib/models/Cattle';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createFarmerSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import { success, error, unauthorized, validationError } from '@/lib/apiResponse';
import { encryptField } from '@/lib/utils/encryption';
import { z } from 'zod';
import logger from '@/lib/logger';

const bulkSchema = z.object({
  farmers: z.array(createFarmerSchema).min(1).max(1000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(bulkSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();

    const results = { created: 0, skipped: 0, errors: [] as Array<{ row: number; mobile?: string; reason: string }> };
    const ctx = getAuditContext(request, user);

    for (let i = 0; i < parsed.data.farmers.length; i++) {
      const row = parsed.data.farmers[i];
      try {
        const existing = await Farmer.findOne({ mobile: row.mobile });
        if (existing) {
          results.skipped++;
          results.errors.push({ row: i + 1, mobile: row.mobile, reason: 'Mobile already registered' });
          continue;
        }
        const farmer = await Farmer.create(row);

        if (row.project === 'np') {
          try {
            const carbonFarmer = await CarbonFarmer.create({
              farmerCustomId: farmer.farmerId,
              name: farmer.name,
              aadharEncrypted: encryptField(row.aadhar!),
              mobile: farmer.mobile,
              place: farmer.village,
              district: farmer.district,
              state: farmer.state,
              programSite: 'NAINARPALAYAM',
            });
            const cattleDocs = Array.from({ length: farmer.animalCount }, (_, i) => ({
              cattleId: `${farmer.farmerId}-A${i + 1}`,
              farmer: carbonFarmer._id,
            }));
            await Cattle.insertMany(cattleDocs);
          } catch (carbonErr) {
            await Farmer.deleteOne({ _id: farmer._id });
            results.skipped++;
            results.errors.push({ row: i + 1, mobile: row.mobile, reason: carbonErr instanceof Error ? carbonErr.message : 'Failed to create carbon-program record' });
            continue;
          }
        }

        await logAudit({ ...ctx, action: 'FARMER_CREATED', entity: 'Farmer', entityId: farmer._id.toString(), newData: farmer.toObject() });
        results.created++;
      } catch (rowErr) {
        results.skipped++;
        results.errors.push({ row: i + 1, mobile: row.mobile, reason: rowErr instanceof Error ? rowErr.message : 'Unknown error' });
      }
    }

    if (results.created > 0) {
      await createNotification({ type: 'NEW_FARMER', title: 'Bulk Farmers Added', message: `${results.created} farmer(s) were imported via CSV.` });
      emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'farmer_added' });
    }

    logger.info('Bulk farmers import', { created: results.created, skipped: results.skipped, by: user.email });
    return success(results, `${results.created} farmer(s) created, ${results.skipped} skipped`);
  } catch (err) {
    logger.error('Failed to bulk import farmers', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to import farmers', 500, err);
  }
}
