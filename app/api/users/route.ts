import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { parseBody, createUserSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, created, error, unauthorized, forbidden, validationError } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
  const search = searchParams.get('search') || '';

  const query = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
    : {};

  const [users, total] = await Promise.all([
    User.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  return success({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden('Only Super Admins can create users');

  try {
    const body = await request.json();
    const parsed = parseBody(createUserSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const existing = await User.findOne({ email: parsed.data.email });
    if (existing) return error('Email already in use', 409);

    const newUser = await User.create(parsed.data);
    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'USER_CREATED', entity: 'User', entityId: newUser._id.toString(), newData: newUser.toSafeObject() });

    logger.info('User created', { email: newUser.email, role: newUser.role, by: user.email });
    return created(newUser.toSafeObject(), 'User created successfully');
  } catch (err) {
    logger.error('Failed to create user', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to create user', 500, err);
  }
}
