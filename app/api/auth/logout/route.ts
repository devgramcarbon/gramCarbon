import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserFromRequest, clearAuthCookies } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import logger from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);

  if (user) {
    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'USER_LOGOUT', entity: 'User', entityId: user.userId });
    logger.info('User logged out', { email: user.email, role: user.role });
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearAuthCookies(response);
  return response;
}
