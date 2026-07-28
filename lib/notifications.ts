import connectDB from './mongodb';
import Notification from './models/Notification';
import logger from './logger';
import type { NotificationType } from './models/Notification';
import type { Document } from 'mongoose';

interface CreateNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams): Promise<Document | null> {
  try {
    await connectDB();
    const notification = await Notification.create({
      type: params.type,
      title: params.title,
      message: params.message,
      userId: params.userId ?? null,
      metadata: params.metadata ?? {},
    });
    return notification;
  } catch (err) {
    logger.error('Failed to create notification', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function notifyStockLow(distributorName: string, balanceKg: number): Promise<Document | null> {
  return createNotification({
    type: 'STOCK_LOW',
    title: 'Low Stock Alert',
    message: `${distributorName} has only ${balanceKg}kg remaining.`,
    metadata: { distributorName, balanceKg },
  });
}

export async function notifyWhatsAppFailed(phone: string, errorMsg: string): Promise<Document | null> {
  return createNotification({
    type: 'WHATSAPP_DELIVERY_FAILED',
    title: 'WhatsApp Delivery Failed',
    message: `Failed to deliver message to ${phone}: ${errorMsg}`,
    metadata: { phone, error: errorMsg },
  });
}

export async function notifySystemError(context: string, errMsg: string): Promise<Document | null> {
  return createNotification({
    type: 'SYSTEM_ERROR',
    title: 'System Error',
    message: `Error in ${context}: ${errMsg}`,
    metadata: { context, error: errMsg },
  });
}

export async function notifyQaqcRequested(poNumber: string, poId: string): Promise<Document | null> {
  return createNotification({
    type: 'QAQC_REQUESTED',
    title: 'QAQC Report Requested',
    message: `Production completed for PO ${poNumber}. QAQC report has been requested from ZE Production.`,
    metadata: { poId, poNumber },
  });
}

export async function notifyApprovalRequested(poNumber: string, poId: string): Promise<Document | null> {
  return createNotification({
    type: 'APPROVAL_REQUESTED',
    title: 'Approval Requested',
    message: `PO ${poNumber} requires approval for Invoice, E-Way Bill and Delivery Note.`,
    metadata: { poId, poNumber },
  });
}

export async function notifyPoAckRejected(poNumber: string, poId: string): Promise<Document | null> {
  return createNotification({
    type: 'PO_ACK_REJECTED',
    title: 'PO Values Marked Incorrect',
    message: `Milky Mist marked the final values for PO ${poNumber} as incorrect. Please review and re-send for acknowledgement.`,
    metadata: { poId, poNumber },
  });
}
