import mongoose, { Schema } from 'mongoose';

export interface IStock {
  distributorPhone: string;
  receivedKg: number;
  soldKg: number;
}

const StockSchema = new Schema<IStock>({
  distributorPhone: { type: String, unique: true, required: true },
  receivedKg: { type: Number, default: 0 },
  soldKg: { type: Number, default: 0 },
});

export default mongoose.models.Stock || mongoose.model<IStock>('Stock', StockSchema);
