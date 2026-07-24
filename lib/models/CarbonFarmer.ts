import mongoose, { Schema, Types } from 'mongoose';

export interface ICarbonFarmer {
  farmerCustomId: string;
  name: string;
  aadharEncrypted: string;
  mobile?: string;
  location?: { lat: number; lng: number };
  place?: string;
  state?: string;
  district?: string;
  pincode?: string;
  onboardingDate?: Date;
  programSite: 'NAINARPALAYAM';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CarbonFarmerSchema = new Schema<ICarbonFarmer>(
  {
    farmerCustomId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    aadharEncrypted: { type: String, required: true },
    mobile: { type: String, trim: true },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    place: { type: String, trim: true },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    pincode: { type: String, trim: true },
    onboardingDate: { type: Date },
    programSite: { type: String, enum: ['NAINARPALAYAM'], default: 'NAINARPALAYAM' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CarbonFarmerSchema.index({ mobile: 1 });
CarbonFarmerSchema.index({ district: 1, state: 1 });
CarbonFarmerSchema.index({ programSite: 1 });

export type CarbonFarmerId = Types.ObjectId;

export default mongoose.models.CarbonFarmer ||
  mongoose.model<ICarbonFarmer>('CarbonFarmer', CarbonFarmerSchema);
