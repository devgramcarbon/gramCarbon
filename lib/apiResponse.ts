import { NextResponse } from 'next/server';

interface ErrorBody {
  success: false;
  message: string;
  error?: string;
}

export function success(data: unknown, message = 'Success', status = 200): NextResponse {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function created(data: unknown, message = 'Created successfully'): NextResponse {
  return success(data, message, 201);
}

export function error(message = 'An error occurred', status = 500, err: unknown = null): NextResponse {
  const body: ErrorBody = { success: false, message };
  if (process.env.NODE_ENV !== 'production' && err) {
    body.error = err instanceof Error ? err.message : String(err);
  }
  return NextResponse.json(body, { status });
}

export function validationError(errors: { field: string; message: string }[]): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Validation failed', errors },
    { status: 422 }
  );
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 404 });
}
