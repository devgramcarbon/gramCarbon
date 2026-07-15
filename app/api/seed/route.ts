import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import { created, error, unauthorized, forbidden } from '@/lib/apiResponse';
import logger from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.SEED_SECRET;
  if (!secret) return forbidden('SEED_SECRET is not configured');

  const provided = request.headers.get('x-seed-secret');
  if (provided !== secret) return unauthorized();

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
    if (existingAdmin) return error('A Super Admin already exists', 409);

    const email = process.env.SEED_EMAIL || 'admin@gramcarbon.in';
    const password = process.env.SEED_PASSWORD || 'admin@123';
    const name = process.env.SEED_NAME || 'Super Admin';

    const existing = await User.findOne({ email });
    if (existing) return error('Email already in use', 409);

    const newUser = await User.create({ name, email, password, role: 'SUPER_ADMIN', isActive: true });

    logger.info('Admin user seeded via API', { email: newUser.email });
    return created(newUser.toSafeObject(), 'Admin user created successfully');
  } catch (err) {
    logger.error('Failed to seed admin user', { error: err instanceof Error ? err.message : String(err) });
    return error('Failed to seed admin user', 500, err);
  }
}
