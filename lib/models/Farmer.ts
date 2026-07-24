import mongoose, { Document, Schema } from 'mongoose';

export interface IFarmer {
  farmerId?: string;
  name: string;
  mobile: string;
  village?: string;
  district?: string;
  state?: string;
  animalCount: number;
  animalType: 'Cow' | 'Buffalo' | 'Mixed' | 'Other';
  gender?: 'Male' | 'Female' | 'Other';
  distributorPhone?: string;
  project: 'np' | 'mm';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FarmerSchema = new Schema<IFarmer>(
  {
    farmerId: { type: String },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    village: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    animalCount: { type: Number, default: 0 },
    animalType: {
      type: String,
      enum: ['Cow', 'Buffalo', 'Mixed', 'Other'],
      default: 'Cow',
    },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    distributorPhone: { type: String },
    project: { type: String, enum: ['np', 'mm'], default: 'np' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FarmerSchema.pre('save', async function (next) {
  if (this.isNew && !this.farmerId) {
    const count = await mongoose.models.Farmer.countDocuments();
    this.farmerId = `F${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

FarmerSchema.index({ mobile: 1 });
FarmerSchema.index({ district: 1, state: 1 });
FarmerSchema.index({ farmerId: 1 });

export default mongoose.models.Farmer || mongoose.model<IFarmer>('Farmer', FarmerSchema);
