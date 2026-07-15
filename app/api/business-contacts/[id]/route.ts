import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import BusinessContact from '@/lib/models/BusinessContact';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, updateBusinessContactSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, notFound, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function resolveDashboardRole(org: string, department: string): 'ZE_ADMIN' | 'ZE_ACC' | 'OPERATOR' {
  if (org !== 'ZEROEARTH') return 'OPERATOR';
  if (department === 'ADMINISTRATION') return 'ZE_ADMIN';
  if (department === 'ACCOUNTS') return 'ZE_ACC';
  return 'OPERATOR';
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden('Only Super Admins can update business contacts');

  try {
    const body = await request.json();
    const parsed = parseBody(updateBusinessContactSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const contact = await BusinessContact.findById(id);
    if (!contact) return notFound('Business contact not found');

    const oldData = contact.toObject();
    const { dashboardAccess, revokeDashboardAccess, ...contactFields } = parsed.data;
    Object.assign(contact, contactFields);

    if (revokeDashboardAccess && contact.userId) {
      await User.findByIdAndDelete(contact.userId);
      contact.userId = undefined;
    }

    if (dashboardAccess) {
      if (contact.userId) {
        const dashboardUser = await User.findById(contact.userId);
        if (!dashboardUser) return notFound('Linked dashboard user not found');
        const emailTaken = await User.findOne({ email: dashboardAccess.email, _id: { $ne: dashboardUser._id } });
        if (emailTaken) return error('Email already in use', 409);
        dashboardUser.email = dashboardAccess.email;
        dashboardUser.password = dashboardAccess.password;
        await dashboardUser.save();
      } else {
        const emailTaken = await User.findOne({ email: dashboardAccess.email });
        if (emailTaken) return error('Email already in use', 409);
        const dashboardUser = await User.create({
          name: contact.name,
          email: dashboardAccess.email,
          password: dashboardAccess.password,
          role: resolveDashboardRole(contact.org, contact.department),
        });
        contact.userId = dashboardUser._id;
      }
    }

    await contact.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'BUSINESS_CONTACT_UPDATED', entity: 'BusinessContact', entityId: id, oldData, newData: contact.toObject() });

    logger.info('Business contact updated', { id, by: user.email });
    return success(contact, 'Business contact updated');
  } catch (err) {
    logger.error('Failed to update business contact', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update business contact', 500, err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden('Only Super Admins can delete business contacts');

  await connectDB();
  const contact = await BusinessContact.findByIdAndDelete(id);
  if (!contact) return notFound('Business contact not found');
  if (contact.userId) await User.findByIdAndDelete(contact.userId);

  const ctx = getAuditContext(request, user);
  await logAudit({ ...ctx, action: 'BUSINESS_CONTACT_DELETED', entity: 'BusinessContact', entityId: id, oldData: contact.toObject() });

  return success(null, 'Business contact deleted');
}
