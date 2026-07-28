import mongoose, { Schema, Types } from 'mongoose';

export interface ICattle {
  cattleId: string;
  farmer: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CattleSchema = new Schema<ICattle>(
  {
    cattleId: { type: String, required: true, unique: true, trim: true },
    farmer: { type: Schema.Types.ObjectId, ref: 'CarbonFarmer', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CattleSchema.index({ farmer: 1, isActive: 1 });

export default mongoose.models.Cattle || mongoose.model<ICattle>('Cattle', CattleSchema);
