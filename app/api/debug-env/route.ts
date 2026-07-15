import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    SEED_SECRET_len: process.env.SEED_SECRET?.length ?? null,
    SEED_SECRET_last8: process.env.SEED_SECRET?.slice(-8) ?? null,
  });
}
