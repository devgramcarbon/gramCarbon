import mongoose, { Schema } from 'mongoose';

export interface ICampLead {
  campLeadCustomId: string;
  name?: string;
  mobile?: string;
  location?: { lat: number; lng: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CampLeadSchema = new Schema<ICampLead>(
  {
    campLeadCustomId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true },
    mobile: { type: String, trim: true },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.CampLead || mongoose.model<ICampLead>('CampLead', CampLeadSchema);
