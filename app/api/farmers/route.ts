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
import { success, created, error, unauthorized, validationError } from '@/lib/apiResponse';
import { encryptField } from '@/lib/utils/encryption';
import logger from '@/lib/logger';

async function syncCarbonFarmer(farmer: { _id: unknown; farmerId?: string; name: string; mobile: string; village?: string; district?: string; state?: string; animalCount: number }, aadhar: string) {
  const carbonFarmer = await CarbonFarmer.create({
    farmerCustomId: farmer.farmerId,
    name: farmer.name,
    aadharEncrypted: encryptField(aadhar),
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
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const search = searchParams.get('search') || '';
  const district = searchParams.get('district') || '';
  const state = searchParams.get('state') || '';
  const project = searchParams.get('project');

  const query: Record<string, unknown> = { isActive: true };
  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') },
      { farmerId: new RegExp(search, 'i') },
    ];
  }
  if (district) query.district = new RegExp(district, 'i');
  if (state) query.state = new RegExp(state, 'i');
  if (project === 'np' || project === 'mm') query.project = project;

  const [farmers, total] = await Promise.all([
    Farmer.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Farmer.countDocuments(query),
  ]);

  return success({ farmers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const parsed = parseBody(createFarmerSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await Farmer.findOne({ mobile: parsed.data.mobile });
    if (existing) return error('Farmer with this mobile already exists', 409);

    const farmer = await Farmer.create(parsed.data);

    if (parsed.data.project === 'np') {
      try {
        await syncCarbonFarmer(farmer, parsed.data.aadhar!);
      } catch (carbonErr) {
        await Farmer.deleteOne({ _id: farmer._id });
        logger.error('Failed to create carbon-program record for farmer', { error: carbonErr instanceof Error ? carbonErr.message : String(carbonErr) });
        return error('Failed to register carbon-program record for this farmer', 500, carbonErr);
      }
    }

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'FARMER_CREATED', entity: 'Farmer', entityId: farmer._id.toString(), newData: farmer.toObject() });

    await createNotification({ type: 'NEW_FARMER', title: 'New Farmer Added', message: `${farmer.name} (${farmer.farmerId}) was registered.` });
    emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'farmer_added' });

    logger.info('Farmer created', { name: farmer.name, farmerId: farmer.farmerId, by: user.email });
    return created(farmer, 'Farmer created successfully');
  } catch (err) {
    logger.error('Failed to create farmer', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create farmer', 500, err);
  }
}
