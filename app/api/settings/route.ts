import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/lib/models/Settings';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, settingsSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { unauthorized, forbidden, success, error, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  const query = category ? { category } : {};
  const settings = await Settings.find(query).sort({ category: 1, key: 1 });

  const grouped = settings.reduce<Record<string, unknown[]>>((acc, s) => {
    const cat = s.category || 'system';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return success(grouped);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    const results = [];

    await connectDB();
    for (const item of items) {
      const parsed = parseBody(settingsSchema, item);
      if (!parsed.ok) return validationError(parsed.errors);

      const existing = await Settings.findOne({ key: parsed.data.key });
      const oldData = existing?.toObject();

      const setting = await Settings.findOneAndUpdate(
        { key: parsed.data.key },
        { $set: parsed.data },
        { upsert: true, new: true }
      );
      results.push(setting);

      const ctx = getAuditContext(request, user);
      await logAudit({ ...ctx, action: 'SETTINGS_CHANGED', entity: 'Settings', entityId: parsed.data.key, oldData, newData: setting?.toObject() });
    }

    logger.info('Settings saved', { count: results.length, by: user.email });
    return success(results, 'Settings saved');
  } catch (err) {
    logger.error('Failed to save settings', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to save settings', 500, err);
  }
}
