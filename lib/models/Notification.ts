import mongoose, { Schema } from 'mongoose';

export type NotificationType =
  | 'STOCK_LOW' | 'WHATSAPP_DELIVERY_FAILED' | 'WEBHOOK_ERROR'
  | 'SYSTEM_ERROR' | 'NEW_DISTRIBUTOR' | 'NEW_FARMER'
  | 'SALE_RECORDED' | 'INFO'
  | 'QAQC_REQUESTED' | 'APPROVAL_REQUESTED' | 'PO_ACK_REJECTED'
  | 'PRODUCTION_STARTED' | 'PO_CLOSED';

export interface INotification {
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  userId?: mongoose.Types.ObjectId;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'STOCK_LOW', 'WHATSAPP_DELIVERY_FAILED', 'WEBHOOK_ERROR',
        'SYSTEM_ERROR', 'NEW_DISTRIBUTOR', 'NEW_FARMER',
        'SALE_RECORDED', 'INFO',
        'QAQC_REQUESTED', 'APPROVAL_REQUESTED', 'PO_ACK_REJECTED',
        'PRODUCTION_STARTED', 'PO_CLOSED',
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
