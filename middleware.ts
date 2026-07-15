import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from './lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/webhook',
  '/api/health',
  '/api/status',
  '/api/seed',
  '/api/debug-env',
  '/_next',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function getTokens(request: NextRequest): { accessToken: string | null; refreshToken: string | null } {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  return {
    accessToken: cookies.accessToken || null,
    refreshToken: cookies.refreshToken || null,
  };
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const { accessToken, refreshToken } = getTokens(request);

  if (accessToken) {
    try {
      await verifyAccessToken(accessToken);
      return NextResponse.next();
    } catch {
      // Access token expired — fall through to refresh
    }
  }

  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      const newAccessToken = await signAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      // Forward the new token in the request so API route handlers can read it
      const requestHeaders = new Headers(request.headers);
      const existingCookie = requestHeaders.get('cookie') || '';
      const updatedCookie = existingCookie.includes('accessToken=')
        ? existingCookie.replace(/\baccessToken=[^;]*/g, `accessToken=${newAccessToken}`)
        : existingCookie ? `${existingCookie}; accessToken=${newAccessToken}` : `accessToken=${newAccessToken}`;
      requestHeaders.set('cookie', updatedCookie);

      const response = NextResponse.next({ request: { headers: requestHeaders } });

      response.headers.append(
        'Set-Cookie',
        `accessToken=${newAccessToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Lax${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`
      );
      return response;
    } catch {
      // Refresh token invalid
    }
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf|otf)).*)'],
};

export default proxy;
