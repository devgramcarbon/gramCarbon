import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MessageTemplate from '@/lib/models/MessageTemplate';
import { listPoWorkflowTemplates, getUnknownPlaceholders, extractVars, PO_WORKFLOW_TEMPLATE_DEFAULTS } from '@/lib/templates';
import { getUserFromRequest } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import { success, error, unauthorized, forbidden, validationError, notFound } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN', 'ADMIN'];
const DEFAULT_KEYS = new Set(PO_WORKFLOW_TEMPLATE_DEFAULTS.map((t) => t.key));

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const templates = await listPoWorkflowTemplates();
    return success({ templates });
  } catch (err) {
    logger.error('Failed to list message templates', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to list message templates', 500, err);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden();

  try {
    const body = await request.json();
    const { key, message } = body as { key?: string; message?: string };

    if (!key || !DEFAULT_KEYS.has(key)) return validationError([{ field: 'key', message: 'Unknown template key' }]);
    if (!message || typeof message !== 'string' || !message.trim()) {
      return validationError([{ field: 'message', message: 'Message is required' }]);
    }

    await connectDB();
    const existing = await MessageTemplate.findOne({ key });
    if (!existing) return notFound('Template not found');

    // Backfill for docs seeded before availableVariables existed on the schema.
    if (!existing.availableVariables || existing.availableVariables.length === 0) {
      const fallback = PO_WORKFLOW_TEMPLATE_DEFAULTS.find((d) => d.key === key);
      existing.availableVariables = fallback ? extractVars(fallback.message) : [];
    }

    const unknown = getUnknownPlaceholders(message, existing.availableVariables);
    if (unknown.length) {
      return validationError([{
        field: 'message',
        message: `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.map((v) => `{{${v}}}`).join(', ')}. Available: ${existing.availableVariables.map((v: string) => `{{${v}}}`).join(', ')}`,
      }]);
    }

    const oldData = existing.toObject();
    existing.message = message;
    existing.variables = extractVars(message);
    await existing.save();

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'MESSAGE_TEMPLATE_UPDATED', entity: 'MessageTemplate', entityId: key, oldData, newData: existing.toObject() });

    logger.info('Message template updated', { key, by: user.email });
    return success(existing, 'Template updated');
  } catch (err) {
    logger.error('Failed to update message template', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to update message template', 500, err);
  }
}
