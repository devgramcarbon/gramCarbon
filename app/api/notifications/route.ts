import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Notification from '@/lib/models/Notification';
import { getUserFromRequest } from '@/lib/auth';
import { unauthorized, success, error } from '@/lib/apiResponse';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  await connectDB();
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

  const query: Record<string, unknown> = {};
  if (unreadOnly) query.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ isRead: false }),
  ]);

  return success({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json() as { ids?: string[]; markAll?: boolean };
    const { ids, markAll } = body;

    await connectDB();
    if (markAll) {
      await Notification.updateMany({}, { isRead: true });
    } else if (ids?.length) {
      await Notification.updateMany({ _id: { $in: ids } }, { isRead: true });
    }

    return success(null, 'Notifications marked as read');
  } catch (err) {
    return error('Failed to update notifications', 500, err);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json() as { ids?: string[] };
    const { ids } = body;
    if (ids?.length) await Notification.deleteMany({ _id: { $in: ids } });
    return success(null, 'Notifications deleted');
  } catch (err) {
    return error('Failed to delete notifications', 500, err);
  }
}
