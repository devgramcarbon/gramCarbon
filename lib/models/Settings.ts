import mongoose, { Schema } from 'mongoose';

export interface ISettings {
  key: string;
  value?: unknown;
  category: 'whatsapp' | 'system' | 'business' | 'notifications';
  label?: string;
  description?: string;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    category: {
      type: String,
      enum: ['whatsapp', 'system', 'business', 'notifications'],
      default: 'system',
    },
    label: String,
    description: String,
    isEncrypted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);
