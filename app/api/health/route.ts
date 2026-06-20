import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

const START_TIME = Date.now();

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, string | number> = {
    database: 'unknown',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
  };

  try {
    await connectDB();
    checks.database = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
  } catch {
    checks.database = 'unhealthy';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'healthy' || typeof v === 'number');
  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      memory: {
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
    },
    { status }
  );
}
