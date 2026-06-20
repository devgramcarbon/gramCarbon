import type { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { unauthorized, forbidden, success, error } from '@/lib/apiResponse';
import { getMemoryLogs } from '@/lib/logger';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return forbidden();

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || '';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '500'));
    const offset = (page - 1) * limit;

    const { logs, total } = getMemoryLogs({ level, search, limit, offset });

    return success({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return error('Failed to fetch server logs', 500, err);
  }
}
