import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import BusinessContact from '@/lib/models/BusinessContact';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createBusinessContactSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, created, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

function resolveDashboardRole(org: string, department: string): 'ZE_ADMIN' | 'ZE_ACC' | 'OPERATOR' {
  if (org !== 'ZEROEARTH') return 'OPERATOR';
  if (department === 'ADMINISTRATION') return 'ZE_ADMIN';
  if (department === 'ACCOUNTS') return 'ZE_ACC';
  return 'OPERATOR';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden();

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
      : {};

    const contacts = await BusinessContact.find(query)
      .populate('userId', 'email isActive')
      .sort({ org: 1, department: 1 })
      .lean();
    return success({ contacts });
  } catch (err) {
    logger.error('Failed to load business contacts', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to load business contacts', 500, err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden('Only Super Admins can add business contacts');

  try {
    const body = await request.json();
    const parsed = parseBody(createBusinessContactSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await BusinessContact.findOne({ org: parsed.data.org, department: parsed.data.department });
    if (existing) return error('A contact for this organization and department already exists', 409);

    const { dashboardAccess, ...contactFields } = parsed.data;

    if (dashboardAccess) {
      const existingUser = await User.findOne({ email: dashboardAccess.email });
      if (existingUser) return error('Email already in use', 409);
    }

    const contact = await BusinessContact.create(contactFields);

    if (dashboardAccess) {
      const dashboardUser = await User.create({
        name: contact.name,
        email: dashboardAccess.email,
        password: dashboardAccess.password,
        role: resolveDashboardRole(contact.org, contact.department),
      });
      contact.userId = dashboardUser._id;
      await contact.save();
    }

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'BUSINESS_CONTACT_CREATED', entity: 'BusinessContact', entityId: contact._id.toString(), newData: contact.toObject() });

    logger.info('Business contact created', { name: contact.name, org: contact.org, department: contact.department, dashboardAccess: !!dashboardAccess, by: user.email });
    return created(contact, 'Business contact added successfully');
  } catch (err) {
    logger.error('Failed to create business contact', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create business contact', 500, err);
  }
}
