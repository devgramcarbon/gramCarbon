import connectDB from './mongodb';
import AuditLog from './models/AuditLog';
import logger from './logger';
import type { AuditAction } from './models/AuditLog';
import type { AuthPayload, AuditContext } from '@/types';

interface LogAuditParams extends Partial<AuditContext> {
  action: AuditAction;
  entity?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  metadata?: unknown;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create(params);
  } catch (err) {
    logger.error('Failed to write audit log', {
      err: err instanceof Error ? err.message : String(err),
      action: params.action,
    });
  }
}

export function getAuditContext(request: Request, user: AuthPayload | null): AuditContext {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
  return {
    userId: user?.userId,
    userEmail: user?.email,
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}
