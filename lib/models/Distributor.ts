import mongoose, { Schema } from 'mongoose';

export interface IDistributor {
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  district?: string;
  state?: string;
  project: 'np' | 'mm';
  createdAt: Date;
}

const DistributorSchema = new Schema<IDistributor>({
  phone: { type: String, unique: true, required: true },
  name: { type: String },
  email: { type: String },
  address: { type: String },
  district: { type: String },
  state: { type: String },
  project: { type: String, enum: ['np', 'mm'], default: 'np' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Distributor || mongoose.model<IDistributor>('Distributor', DistributorSchema);
