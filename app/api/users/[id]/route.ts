import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, updateUserSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, notFound, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role) && user.userId !== id) return forbidden();

  await connectDB();
  const found = await User.findById(id).select('-password');
  if (!found) return notFound('User not found');
  return success(found);
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  try {
    const body = await request.json();
    const parsed = parseBody(updateUserSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const target = await User.findById(id);
    if (!target) return notFound('User not found');

    const oldData = target.toSafeObject();
    Object.assign(target, parsed.data);
    await target.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'USER_UPDATED', entity: 'User', entityId: id, oldData, newData: target.toSafeObject() });

    logger.info('User updated', { id, by: user.email });
    return success(target.toSafeObject(), 'User updated');
  } catch (err) {
    logger.error('Failed to update user', { id, error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update user', 500, err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden();
  if (user.userId === id) return error('Cannot delete your own account', 400);

  await connectDB();
  const target = await User.findByIdAndDelete(id);
  if (!target) return notFound('User not found');

  const ctx = getAuditContext(request, user);
  await logAudit({ ...ctx, action: 'USER_DELETED', entity: 'User', entityId: id, oldData: target.toSafeObject() });

  return success(null, 'User deleted');
}
