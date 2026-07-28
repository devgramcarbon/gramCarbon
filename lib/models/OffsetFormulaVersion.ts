import mongoose, { Schema, Types } from 'mongoose';

export interface IOffsetFormulaVersion {
  version: number;
  offsetPerCowPerDay: number;
  label?: string;
  effectiveFrom: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OffsetFormulaVersionSchema = new Schema<IOffsetFormulaVersion>(
  {
    version: { type: Number, required: true, unique: true },
    offsetPerCowPerDay: { type: Number, required: true },
    label: { type: String, trim: true },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

OffsetFormulaVersionSchema.index({ isActive: 1 });

export default mongoose.models.OffsetFormulaVersion ||
  mongoose.model<IOffsetFormulaVersion>('OffsetFormulaVersion', OffsetFormulaVersionSchema);
