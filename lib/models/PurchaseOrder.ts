import mongoose, { Schema } from 'mongoose';

export type PurchaseOrderStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'ACKNOWLEDGED'
  | 'MM_ACK_PENDING'
  | 'PRODUCTION_STARTED'
  | 'PRODUCTION_IN_PROGRESS'
  | 'PRODUCTION_COMPLETED'
  | 'QAQC_REQUESTED'
  | 'QAQC_READY'
  | 'WEIGHT_REQUESTED'
  | 'WEIGHBRIDGE_READY'
  | 'WEIGHBRIDGE_PAID'
  | 'DISPATCHED'
  | 'INVOICE_APPROVED'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_DONE';

export type ProductionStatus = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface IPurchaseOrder {
  poNumber: string;
  client: string;
  batch?: string;
  qty?: number;
  notes?: string;
  status: PurchaseOrderStatus;
  fileKey?: string;
  fileUrl?: string;
  fileName?: string;
  receivedAt?: Date;
  finalValues?: { qty?: number; rate?: number; amount?: number };
  acknowledgedAt?: Date;
  mmAcknowledgedAt?: Date;
  productionStatus?: ProductionStatus;
  productionStatusUpdatedAt?: Date;
  lastStatusPollAt?: Date;
  qaqcReportUrl?: string;
  dnUrl?: string;
  invoiceUrl?: string;
  ewayBillUrl?: string;
  weighBridgeReportUrl?: string;
  weightKg?: number;
  weighBridgePaidAt?: Date;
  dispatchedAt?: Date;
  paymentRequestedAt?: Date;
  paymentDoneAt?: Date;
  stageHistory: Array<{ stage: string; at: Date }>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, trim: true },
    client: { type: String, required: true, trim: true },
    batch: { type: String, trim: true },
    qty: { type: Number },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        'REQUESTED', 'RECEIVED', 'ACKNOWLEDGED', 'MM_ACK_PENDING',
        'PRODUCTION_STARTED', 'PRODUCTION_IN_PROGRESS', 'PRODUCTION_COMPLETED',
        'QAQC_REQUESTED', 'QAQC_READY', 'WEIGHT_REQUESTED', 'WEIGHBRIDGE_READY',
        'WEIGHBRIDGE_PAID', 'DISPATCHED', 'INVOICE_APPROVED', 'PAYMENT_REQUESTED', 'PAYMENT_DONE',
      ],
      default: 'REQUESTED',
    },
    fileKey: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    receivedAt: { type: Date },
    finalValues: {
      qty: { type: Number },
      rate: { type: Number },
      amount: { type: Number },
    },
    acknowledgedAt: { type: Date },
    mmAcknowledgedAt: { type: Date },
    productionStatus: { type: String, enum: ['STARTED', 'IN_PROGRESS', 'COMPLETED'] },
    productionStatusUpdatedAt: { type: Date },
    lastStatusPollAt: { type: Date },
    qaqcReportUrl: { type: String },
    dnUrl: { type: String },
    invoiceUrl: { type: String },
    ewayBillUrl: { type: String },
    weighBridgeReportUrl: { type: String },
    weightKg: { type: Number },
    weighBridgePaidAt: { type: Date },
    dispatchedAt: { type: Date },
    paymentRequestedAt: { type: Date },
    paymentDoneAt: { type: Date },
    stageHistory: {
      type: [{ stage: { type: String, required: true }, at: { type: Date, required: true } }],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
