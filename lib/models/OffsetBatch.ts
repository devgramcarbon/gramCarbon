import mongoose, { Schema, Types } from 'mongoose';

export interface IOffsetBatch {
  offsetId: string;
  feedLogs: Types.ObjectId[];
  totalOffsetValue: number;
  createdBy?: Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OffsetBatchSchema = new Schema<IOffsetBatch>(
  {
    offsetId: { type: String, required: true, unique: true, trim: true },
    feedLogs: [{ type: Schema.Types.ObjectId, ref: 'FeedLog' }],
    totalOffsetValue: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.OffsetBatch ||
  mongoose.model<IOffsetBatch>('OffsetBatch', OffsetBatchSchema);
