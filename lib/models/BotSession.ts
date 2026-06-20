import mongoose, { Schema } from 'mongoose';

interface ConversationEntry {
  role: 'user' | 'bot';
  message?: string;
  timestamp: Date;
}

export interface IBotSession {
  phoneNumber: string;
  currentState: 'idle' | 'main_menu' | 'record_sale' | 'check_stock' | 'view_sales' | 'register_farmer';
  step: number;
  temporaryData: Record<string, unknown>;
  conversationHistory: ConversationEntry[];
  lastMessageId?: string | null;
  lastInteraction: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BotSessionSchema = new Schema<IBotSession>(
  {
    phoneNumber: { type: String, required: true },
    currentState: {
      type: String,
      enum: ['idle', 'main_menu', 'record_sale', 'check_stock', 'view_sales', 'register_farmer'],
      default: 'idle',
    },
    step: { type: Number, default: 0 },
    temporaryData: { type: mongoose.Schema.Types.Mixed, default: {} },
    conversationHistory: [
      {
        role: { type: String, enum: ['user', 'bot'] },
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    lastMessageId: { type: String, default: null },
    lastInteraction: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

BotSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
BotSessionSchema.index({ phoneNumber: 1 });

export default mongoose.models.BotSession || mongoose.model<IBotSession>('BotSession', BotSessionSchema);
