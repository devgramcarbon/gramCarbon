import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { success, unauthorized } from '@/lib/apiResponse';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const payload = await getUserFromRequest(request);
  if (!payload) return unauthorized();

  await connectDB();
  const user = await User.findById(payload.userId).select('-password');
  if (!user || !user.isActive) return unauthorized('Account not found or inactive');

  return success(user);
}
