import type { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import BusinessContact from '@/lib/models/BusinessContact';
import { getUserFromRequest } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { success, error, unauthorized, forbidden, notFound } from '@/lib/apiResponse';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();
  if (user.role !== 'SUPER_ADMIN') return forbidden('Only Super Admins can send test messages');

  await connectDB();
  const contact = await BusinessContact.findById(id).lean<{ name: string; phone: string } | null>();
  if (!contact) return notFound('Business contact not found');

  try {
    await sendWhatsAppText(
      contact.phone,
      `Hi ${contact.name},\n\nThis is a test message from gramCarbon to confirm this WhatsApp number is reachable. No action needed.`
    );
    logger.info('Business contact test message sent', { id, phone: contact.phone, by: user.email });
    return success({ delivered: true }, `Test message sent to ${contact.phone}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Business contact test message failed', { id, phone: contact.phone, error: errMsg });
    return error(`Test message failed to send to ${contact.phone}: ${errMsg}`, 502, err);
  }
}
