import connectDB from './mongodb';
import MessageTemplate from './models/MessageTemplate';

// Default copy for every WhatsApp message the Milky Mist PO workflow (lib/poWorkflow.ts) sends.
// These seed the MessageTemplate collection on first read; editing a template in
// /dashboard/templates overrides the copy here without touching the workflow code.
export const PO_WORKFLOW_TEMPLATE_DEFAULTS: Array<{ key: string; label: string; message: string }> = [
  {
    key: 'po_mm_acknowledge',
    label: 'MM: Confirm final values',
    message: 'Hi,\n\nPO *{{poNumber}}* ({{client}}) has final values set by ZE Admin:\n\n*Qty:* {{qty}}\n*Rate:* {{rate}}\n*Amount:* {{amount}}\n\nPlease confirm these values are correct.',
  },
  {
    key: 'po_ze_start_production',
    label: 'ZE Prod: Start production',
    message: 'Hi,\n\nMilky Mist has acknowledged PO *{{poNumber}}*.\n\nPlease start production.',
  },
  {
    key: 'po_daily_status_check',
    label: 'ZE Prod: Daily status check',
    message: 'Hi,\n\nDaily production status check for PO *{{poNumber}}*.\n\nWhat is the current status?',
  },
  {
    key: 'po_production_status_update',
    label: 'MM: Production status update',
    message: 'Hi,\n\nProduction status update for PO *{{poNumber}}*:\n\n*{{label}}*',
  },
  {
    key: 'po_production_completed',
    label: 'ZE Acc: Production completed, request QAQC',
    message: 'Hi,\n\nProduction completed for PO *{{poNumber}}*.\n\nRequest for QAQC report.',
  },
  {
    key: 'po_qaqc_ready_check',
    label: 'ZE Prod: Is QAQC report ready?',
    message: 'Hi,\n\nIs the QAQC report ready for PO *{{poNumber}}*?',
  },
  {
    key: 'po_qaqc_ready_payment',
    label: 'ZE Acc: Confirm QAQC payment',
    message: 'Hi,\n\nThe QAQC report is ready for PO *{{poNumber}}*.\n\nPlease confirm payment for the QAQC report.',
  },
  {
    key: 'po_qaqc_docs_ready',
    label: 'MM: Documents ready (GRN/Invoice/QAQC)',
    message: 'Hi,\n\nDocuments for PO *{{poNumber}}* are ready:\n\n📄 GRN: {{dnUrl}}\n📄 Invoice: {{invoiceUrl}}\n📄 QAQC Report: {{qaqcReportUrl}}',
  },
  {
    key: 'po_weight_request_prod',
    label: 'ZE Prod: Provide weight after loading',
    message: 'Hi,\n\nPlease provide the weight after loading for PO *{{poNumber}}* (reply with the weight in kg).',
  },
  {
    key: 'po_weight_request_acc',
    label: 'ZE Acc: Weight requested (FYI)',
    message: 'Hi,\n\nWeight after loading has been requested for PO *{{poNumber}}*.',
  },
  {
    key: 'po_wb_ready_check',
    label: 'ZE Prod: Is weighbridge report ready?',
    message: 'Hi,\n\nIs the weighbridge report ready for PO *{{poNumber}}*?',
  },
  {
    key: 'po_wb_ready_payment',
    label: 'ZE Acc: Make weighbridge payment',
    message: 'Hi,\n\nWeighbridge report is ready for PO *{{poNumber}}*.\n\nPlease make the weighbridge payment.',
  },
  {
    key: 'po_dispatched_prod',
    label: 'MM Prod: Loaded & dispatched',
    message: 'Hi,\n\n*Prod 3 — CH4OW Loaded & Dispatched*\n\nPO: *{{poNumber}}*\nWeight: {{weightKg}}kg\n📄 GRN: {{dnUrl}}\n📄 E-Way Bill: {{ewayBillUrl}}',
  },
  {
    key: 'po_dispatched_acc',
    label: 'MM Acc: Loaded & dispatched, invoice',
    message: 'Hi,\n\n*Prod 3 — CH4OW Loaded & Dispatched*\n\nPO: *{{poNumber}}*\n📄 Invoice: {{invoiceUrl}}',
  },
  {
    key: 'po_pending_bills',
    label: 'ZE Acc: Pending bills reminder',
    message: 'Hi,\n\nReminder: bills for PO *{{poNumber}}* are pending receipt before approval.',
  },
  {
    key: 'po_dn_approved',
    label: 'ZE Prod: Approved DN',
    message: 'Hi,\n\nApproved DN for PO *{{poNumber}}*:\n\n📄 GRN: {{dnUrl}}\n📄 QAQC Report: {{qaqcReportUrl}}\n📄 Weighbridge Report: {{weighBridgeReportUrl}}\n📄 E-Way Bill: {{ewayBillUrl}}',
  },
  {
    key: 'po_invoice_approved',
    label: 'MM & ZE Acc: Approved Invoice',
    message: 'Hi,\n\nApproved Invoice for PO *{{poNumber}}*:\n\n📄 {{invoiceUrl}}',
  },
  {
    key: 'po_payment_requested',
    label: 'MM Acc: Payment request',
    message: 'Hi,\n\nRequest for payment on PO *{{poNumber}}* — due on the 15th day per terms.',
  },
  {
    key: 'po_payment_done_acc',
    label: 'ZE Acc: Payment done',
    message: 'Hi,\n\nPayment done for PO *{{poNumber}}* — transaction proof uploaded.',
  },
  {
    key: 'po_payment_done_prod',
    label: 'ZE Prod: Payment received',
    message: 'Hi,\n\nPayment received for PO *{{poNumber}}*.',
  },
  {
    key: 'po_ticket_closed',
    label: 'All: Ticket closed',
    message: 'Hi,\n\nPO *{{poNumber}}* is fully settled. Ticket closed. Thank you!',
  },
];

const DEFAULTS_BY_KEY = new Map(PO_WORKFLOW_TEMPLATE_DEFAULTS.map((t) => [t.key, t]));

function extractVars(message: string): string[] {
  const matches = message.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
}

export { extractVars };

// Placeholders in `message` that aren't in the template's fixed availableVariables list —
// almost always a typo (e.g. {{poNmber}}), since it will silently render as "N/A" otherwise.
export function getUnknownPlaceholders(message: string, availableVariables: string[]): string[] {
  const available = new Set(availableVariables);
  return extractVars(message).filter((v) => !available.has(v));
}

export function renderTemplate(message: string, vars: Record<string, unknown>): string {
  return message.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null || v === '' ? 'N/A' : String(v);
  });
}

// Ensures every default template exists in the DB (first-run seed), then returns the
// live (possibly user-edited) message text for `key`, rendered with `vars`.
export async function getTemplateMessage(key: string, vars: Record<string, unknown>): Promise<string> {
  const fallback = DEFAULTS_BY_KEY.get(key);
  if (!fallback) throw new Error(`Unknown message template key: ${key}`);

  await connectDB();
  const existing = await MessageTemplate.findOne({ key }).lean<{ message: string } | null>();
  const message = existing
    ? existing.message
    : (
        await MessageTemplate.create({
          key: fallback.key,
          label: fallback.label,
          category: 'Milky Mist PO',
          message: fallback.message,
          variables: extractVars(fallback.message),
          availableVariables: extractVars(fallback.message),
        })
      ).message;

  return renderTemplate(message, vars);
}

export async function listPoWorkflowTemplates() {
  await connectDB();
  const existing = await MessageTemplate.find({ key: { $in: [...DEFAULTS_BY_KEY.keys()] } }).lean();
  const existingByKey = new Map(existing.map((t) => [t.key, t]));

  const missing = PO_WORKFLOW_TEMPLATE_DEFAULTS.filter((d) => !existingByKey.has(d.key));
  if (missing.length) {
    await MessageTemplate.insertMany(
      missing.map((d) => ({
        key: d.key,
        label: d.label,
        category: 'Milky Mist PO',
        message: d.message,
        variables: extractVars(d.message),
        availableVariables: extractVars(d.message),
      })),
      { ordered: false }
    ).catch(() => undefined);
  }

  // Backfill availableVariables for docs seeded before that field existed.
  const staleDocs = existing.filter((t) => !t.availableVariables || t.availableVariables.length === 0);
  await Promise.all(
    staleDocs.map((t) => {
      const fallback = DEFAULTS_BY_KEY.get(t.key);
      if (!fallback) return Promise.resolve();
      return MessageTemplate.updateOne({ key: t.key }, { $set: { availableVariables: extractVars(fallback.message) } });
    })
  );

  const all = await MessageTemplate.find({ key: { $in: [...DEFAULTS_BY_KEY.keys()] } }).lean();
  const order = [...DEFAULTS_BY_KEY.keys()];
  return all.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
