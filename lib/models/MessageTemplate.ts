import mongoose, { Schema } from 'mongoose';

export interface IMessageTemplate {
  key: string;
  label: string;
  category: string;
  message: string;
  variables: string[];
  // Fixed set of placeholders the workflow actually supplies values for when sending this
  // template (lib/templates.ts PO_WORKFLOW_TEMPLATE_DEFAULTS) — set once at seed time and
  // never changed by edits, so the UI can always offer the full, correct placeholder list
  // even after a user strips one out of `message`.
  availableVariables: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplate>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    category: { type: String, required: true, default: 'Milky Mist PO' },
    message: { type: String, required: true },
    variables: { type: [String], default: [] },
    availableVariables: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.MessageTemplate || mongoose.model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema);
