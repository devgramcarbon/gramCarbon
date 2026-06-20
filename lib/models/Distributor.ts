import mongoose, { Schema } from 'mongoose';

export interface IDistributor {
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  district?: string;
  state?: string;
  createdAt: Date;
}

const DistributorSchema = new Schema<IDistributor>({
  phone: { type: String, unique: true, required: true },
  name: { type: String },
  email: { type: String },
  address: { type: String },
  district: { type: String },
  state: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Distributor || mongoose.model<IDistributor>('Distributor', DistributorSchema);
