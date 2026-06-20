import mongoose, { Schema } from 'mongoose';

export interface ISale {
  distributorPhone: string;
  farmerName: string;
  farmerMobile?: string;
  cowCount: number;
  qtyKg: number;
  batchNo?: string;
  saleDate: Date;
}

const SaleSchema = new Schema<ISale>({
  distributorPhone: { type: String, required: true },
  farmerName: { type: String, required: true },
  farmerMobile: { type: String },
  cowCount: { type: Number, required: true },
  qtyKg: { type: Number, required: true },
  batchNo: { type: String },
  saleDate: { type: Date, default: Date.now },
});

export default mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);
