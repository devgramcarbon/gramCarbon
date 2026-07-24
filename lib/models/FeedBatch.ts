import mongoose, { Schema } from 'mongoose';

export interface IFeedBatch {
  feedBatchId: string;
  supplyDate?: Date;
  gramsPerAnimalPerDay?: number;
  totalKg?: number;
  activeFrom?: Date;
  activeTo?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedBatchSchema = new Schema<IFeedBatch>(
  {
    feedBatchId: { type: String, required: true, unique: true, trim: true },
    supplyDate: { type: Date },
    gramsPerAnimalPerDay: { type: Number },
    totalKg: { type: Number },
    activeFrom: { type: Date },
    activeTo: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.FeedBatch || mongoose.model<IFeedBatch>('FeedBatch', FeedBatchSchema);
