import type { RateLimitResult } from '@/types';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now > data.resetAt) store.delete(key);
  }
}

setInterval(cleanup, 60_000);

interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

export function rateLimit(key: string, { limit = 60, windowMs = 60_000 }: RateLimitOptions = {}): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const allowed = entry.count <= limit;
  const retryAfter = allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000);

  return { allowed, remaining, retryAfter };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.retryAfter > 0 ? { 'Retry-After': String(result.retryAfter) } : {}),
  };
}
