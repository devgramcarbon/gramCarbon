import { SignJWT, jwtVerify } from 'jose';
import type { AuthPayload, UserRole } from '@/types';
import type { NextResponse } from 'next/server';

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || 'gramcarbon-access-secret-change-in-production'
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || 'gramcarbon-refresh-secret-change-in-production'
);

type TokenPayload = Pick<AuthPayload, 'userId' | 'email' | 'role'>;

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET);
  return payload as AuthPayload;
}

export async function verifyRefreshToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload as AuthPayload;
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  if (cookies.accessToken) return cookies.accessToken;

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export async function getUserFromRequest(request: Request): Promise<AuthPayload | null> {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  response.headers.append(
    'Set-Cookie',
    `accessToken=${accessToken}; HttpOnly; Path=/; Max-Age=900; SameSite=Lax${secure}`
  );
  response.headers.append(
    'Set-Cookie',
    `refreshToken=${refreshToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${secure}`
  );
}

export function clearAuthCookies(response: NextResponse): void {
  response.headers.append(
    'Set-Cookie',
    'accessToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );
  response.headers.append(
    'Set-Cookie',
    'refreshToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'dashboard:read',
    'distributors:read', 'distributors:write',
    'farmers:read', 'farmers:write',
    'stock:read', 'stock:write',
    'sales:read', 'sales:write',
    'messages:send',
    'reports:read',
    'audit-logs:read',
    'settings:read', 'settings:write',
    'notifications:read',
  ],
  OPERATOR: [
    'dashboard:read',
    'distributors:read',
    'farmers:read',
    'stock:read', 'stock:write',
    'sales:read', 'sales:write',
    'messages:send',
    'notifications:read',
  ],
  ZE_ADMIN: [
    'dashboard:read',
    'ze:tickets:read',
    'ze:po:read', 'ze:po:write',
    'ze:production:read',
    'ze:documents:read',
    'ze:dispatch:read',
    'ze:payments:read',
    'ze:closure:read', 'ze:closure:write',
  ],
  ZE_ACC: [
    'dashboard:read',
    'ze:tickets:read',
    'ze:qaqc-weighbridge:read', 'ze:qaqc-weighbridge:write',
    'ze:invoices:read', 'ze:invoices:write',
    'ze:pending-bills:read',
    'ze:payment-console:read', 'ze:payment-console:write',
    'ze:closed-tickets:read',
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}
