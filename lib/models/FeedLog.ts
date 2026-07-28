import mongoose, { Schema, Types } from 'mongoose';

export interface IFeedLog {
  farmer: Types.ObjectId;
  cattle: Types.ObjectId;
  feedBatch: Types.ObjectId;
  logDate: Date;
  feedGiven: boolean;
  fractionalOffsetId: string;
  status: 'PENDING' | 'VERIFIED';
  offsetValue?: number;
  formulaVersion?: number;
  verification?: {
    campLead?: Types.ObjectId;
    verificationDate?: Date;
    verifiedLat?: number;
    verifiedLng?: number;
    verificationPic?: string;
    note?: string;
  };
  offsetBatch?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeedLogSchema = new Schema<IFeedLog>(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'CarbonFarmer', required: true },
    cattle: { type: Schema.Types.ObjectId, ref: 'Cattle', required: true },
    feedBatch: { type: Schema.Types.ObjectId, ref: 'FeedBatch', required: true },
    logDate: { type: Date, required: true },
    feedGiven: { type: Boolean, required: true, default: true },
    fractionalOffsetId: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ['PENDING', 'VERIFIED'], default: 'PENDING' },
    offsetValue: { type: Number, default: null },
    formulaVersion: { type: Number, default: null },
    verification: {
      campLead: { type: Schema.Types.ObjectId, ref: 'CampLead' },
      verificationDate: { type: Date },
      verifiedLat: { type: Number },
      verifiedLng: { type: Number },
      verificationPic: { type: String },
      note: { type: String },
    },
    offsetBatch: { type: Schema.Types.ObjectId, ref: 'OffsetBatch', default: null },
  },
  { timestamps: true }
);

// one feed log per cow per day
FeedLogSchema.index({ cattle: 1, logDate: 1 }, { unique: true });
FeedLogSchema.index({ farmer: 1, logDate: 1 });
FeedLogSchema.index({ status: 1 });
FeedLogSchema.index({ offsetBatch: 1 });

export default mongoose.models.FeedLog || mongoose.model<IFeedLog>('FeedLog', FeedLogSchema);
