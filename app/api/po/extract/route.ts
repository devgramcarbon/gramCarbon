import type { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { validateFile } from '@/lib/s3';
import { extractPoFields } from '@/lib/poExtract';
import { success, error, unauthorized, forbidden } from '@/lib/apiResponse';
import logger from '@/lib/logger';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ZE_ADMIN'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return error('No file provided', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateFile(buffer, file.type);
    if (!validation.ok) return error(validation.error || 'Invalid file', 400);

    if (file.type !== 'application/pdf') {
      return success({ fields: {} }, 'Field extraction only supports PDF files; please fill in details manually');
    }

    const fields = await extractPoFields(buffer);
    return success({ fields });
  } catch (err) {
    logger.error('Failed to extract PO fields', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to extract PO fields', 500, err);
  }
}
