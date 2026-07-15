import mongoose, { Schema } from 'mongoose';

export type PurchaseOrderStatus = 'REQUESTED' | 'RECEIVED' | 'ACKNOWLEDGED';

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
    status: { type: String, enum: ['REQUESTED', 'RECEIVED', 'ACKNOWLEDGED'], default: 'REQUESTED' },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
