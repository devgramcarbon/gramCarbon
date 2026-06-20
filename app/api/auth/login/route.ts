import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth';
import { parseBody, loginSchema } from '@/lib/validations';
import { logAudit, getAuditContext } from '@/lib/audit';
import { rateLimit, rateLimitHeaders } from '@/lib/rateLimiter';
import { error, validationError, unauthorized } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    logger.warn('Login rate limit exceeded', { ip });
    return NextResponse.json(
      { success: false, message: 'Too many login attempts' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const body = await request.json();
    const parsed = parseBody(loginSchema, body);
    if (!parsed.ok) return validationError(parsed.errors);

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email, isActive: true });
    if (!user) {
      logger.warn('Login failed: user not found', { email: parsed.data.email, ip });
      return unauthorized('Invalid email or password');
    }

    const valid = await user.comparePassword(parsed.data.password);
    if (!valid) {
      logger.warn('Login failed: wrong password', { email: parsed.data.email, ip });
      return unauthorized('Invalid email or password');
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const tokenPayload = { userId: user._id.toString(), email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    const ctx = getAuditContext(request, tokenPayload as Parameters<typeof getAuditContext>[1]);
    await logAudit({ ...ctx, action: 'USER_LOGIN', entity: 'User', entityId: user._id.toString() });

    logger.info('User logged in', { email: user.email, role: user.role, ip });

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      data: { user: user.toSafeObject() },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    logger.error('Login error', { error: err instanceof Error ? err.message : String(err) });
    return error('Login failed', 500, err);
  }
}
