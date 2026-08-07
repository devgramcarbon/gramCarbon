import mongoose, { Schema } from 'mongoose';

export interface IMmMonthlyData {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  mccCode: string;
  mccName: string;
  quantityPerDay: number;
  noOfProducers: number;
  noOfProducersUsingCH4OW: number;
  milkQuantityPerDayLit: number;
  totalMonthlyCollectionLit: number;
  fatPercent: number;
  snfPercent: number;
  noOfAnimals: number;
  productivityPerDayPerCow: number;
  tonsLowCarbonFeed: number;
  fractionalCreditsGenerated: number;
  cc: number;
  isSummaryRow: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MmMonthlyDataSchema = new Schema<IMmMonthlyData>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    monthLabel: { type: String, required: true },
    mccCode: { type: String, required: true, trim: true },
    mccName: { type: String, required: true, trim: true },
    quantityPerDay: { type: Number, default: 0 },
    noOfProducers: { type: Number, default: 0 },
    noOfProducersUsingCH4OW: { type: Number, default: 0 },
    milkQuantityPerDayLit: { type: Number, default: 0 },
    totalMonthlyCollectionLit: { type: Number, default: 0 },
    fatPercent: { type: Number, default: 0 },
    snfPercent: { type: Number, default: 0 },
    noOfAnimals: { type: Number, default: 0 },
    productivityPerDayPerCow: { type: Number, default: 0 },
    tonsLowCarbonFeed: { type: Number, default: 0 },
    fractionalCreditsGenerated: { type: Number, default: 0 },
    cc: { type: Number, default: 0 },
    isSummaryRow: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MmMonthlyDataSchema.index({ year: 1, month: 1, mccCode: 1 }, { unique: true });

export default mongoose.models.MmMonthlyData ||
  mongoose.model<IMmMonthlyData>('MmMonthlyData', MmMonthlyDataSchema);
