import mongoose, { Schema } from 'mongoose';

export type BusinessOrg = 'MILKY_MIST' | 'ZEROEARTH';
export type BusinessDepartment = 'PRODUCTION' | 'ACCOUNTS' | 'ADMINISTRATION';

export interface IBusinessContact {
  name: string;
  org: BusinessOrg;
  department: BusinessDepartment;
  phone: string;
  isActive: boolean;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BusinessContactSchema = new Schema<IBusinessContact>({
  name: { type: String, required: true },
  org: { type: String, enum: ['MILKY_MIST', 'ZEROEARTH'], required: true },
  department: { type: String, enum: ['PRODUCTION', 'ACCOUNTS', 'ADMINISTRATION'], required: true },
  phone: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

BusinessContactSchema.index({ org: 1, department: 1 }, { unique: true });

export default mongoose.models.BusinessContact ||
  mongoose.model<IBusinessContact>('BusinessContact', BusinessContactSchema);
