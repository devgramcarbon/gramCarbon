import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyRefreshToken, signAccessToken, setAuthCookies, signRefreshToken } from '@/lib/auth';
import { unauthorized, error } from '@/lib/apiResponse';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    const refreshToken = cookies.refreshToken;
    if (!refreshToken) return unauthorized('No refresh token');

    const payload = await verifyRefreshToken(refreshToken);
    const tokenPayload = { userId: payload.userId, email: payload.email, role: payload.role };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    const response = NextResponse.json({ success: true, message: 'Tokens refreshed' });
    setAuthCookies(response, newAccessToken, newRefreshToken);
    return response;
  } catch {
    return unauthorized('Invalid or expired refresh token');
  }
}
