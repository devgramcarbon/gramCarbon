import mongoose, { Schema } from 'mongoose';

export type AuditAction =
  | 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED'
  | 'STOCK_ADDED' | 'STOCK_UPDATED' | 'STOCK_DELETED'
  | 'SALE_RECORDED' | 'SALE_DELETED'
  | 'FARMER_CREATED' | 'FARMER_UPDATED' | 'FARMER_DELETED'
  | 'DISTRIBUTOR_CREATED' | 'DISTRIBUTOR_UPDATED' | 'DISTRIBUTOR_DELETED'
  | 'BUSINESS_CONTACT_CREATED' | 'BUSINESS_CONTACT_UPDATED' | 'BUSINESS_CONTACT_DELETED'
  | 'PO_CREATED' | 'PO_RECEIVED' | 'PO_ACKNOWLEDGED' | 'PO_PAYMENT_DONE'
  | 'MESSAGE_SENT' | 'SETTINGS_CHANGED' | 'REPORT_GENERATED';

export interface IAuditLog {
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: String,
    action: {
      type: String,
      required: true,
      enum: [
        'USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'STOCK_ADDED', 'STOCK_UPDATED', 'STOCK_DELETED',
        'SALE_RECORDED', 'SALE_DELETED',
        'FARMER_CREATED', 'FARMER_UPDATED', 'FARMER_DELETED',
        'DISTRIBUTOR_CREATED', 'DISTRIBUTOR_UPDATED', 'DISTRIBUTOR_DELETED',
        'BUSINESS_CONTACT_CREATED', 'BUSINESS_CONTACT_UPDATED', 'BUSINESS_CONTACT_DELETED',
        'PO_CREATED', 'PO_RECEIVED', 'PO_ACKNOWLEDGED', 'PO_PAYMENT_DONE',
        'MESSAGE_SENT', 'SETTINGS_CHANGED', 'REPORT_GENERATED',
      ],
    },
    entity: String,
    entityId: String,
    oldData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ entity: 1, entityId: 1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
