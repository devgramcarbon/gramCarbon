import type { JWTPayload } from 'jose';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'ZE_ADMIN' | 'ZE_ACC';

export interface AuthPayload extends JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: { field: string; message: string }[] };

export interface MemoryLog {
  level: string;
  message: string;
  timestamp?: string;
  stack?: string;
  service?: string;
  meta?: Record<string, unknown>;
}

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
}
