import connectDB from './mongodb';
import PurchaseOrder from './models/PurchaseOrder';
import type { IPurchaseOrder, ProductionStatus } from './models/PurchaseOrder';
import BusinessContact from './models/BusinessContact';
import type { BusinessOrg, BusinessDepartment } from './models/BusinessContact';
import BotSession from './models/BotSession';
import { sendWhatsAppText, sendWhatsAppButtons } from './whatsapp';
import { generateDummyDoc, type DummyDocType } from './docGen';
import { notifyQaqcRequested, notifyApprovalRequested, notifyWhatsAppFailed, notifySystemError, notifyPoAckRejected, notifyProductionStarted, notifyPoClosed } from './notifications';
import { withRetry } from './retry';
import logger from './logger';
import type { Document, Types } from 'mongoose';

type PoDoc = Document & IPurchaseOrder & { _id: Types.ObjectId };

async function getContacts(org: BusinessOrg, department: BusinessDepartment): Promise<Array<{ phone: string; name: string }>> {
  await connectDB();
  return BusinessContact.find({ org, department, isActive: true }).lean<Array<{ phone: string; name: string }>>();
}

async function pushStage(order: PoDoc, stage: string, extra?: Record<string, unknown>): Promise<void> {
  order.status = stage as IPurchaseOrder['status'];
  order.stageHistory.push({ stage, at: new Date() });
  if (extra) Object.assign(order, extra);
  await withRetry(() => order.save(), { retries: 3, delayMs: 300, label: `PO save (${order.poNumber} -> ${stage})` });
}

// sendWhatsAppText/sendWhatsAppButtons already retry internally (lib/whatsapp.ts); a rejection
// here means retries were exhausted, so surface it as a dashboard notification for manual follow-up
// rather than silently dropping the message.
async function reportSendFailures(
  contacts: Array<{ phone: string; name: string }>,
  results: PromiseSettledResult<void>[],
  context: string
): Promise<void> {
  const failures = contacts
    .map((c, i) => ({ contact: c, result: results[i] }))
    .filter((f): f is { contact: typeof f.contact; result: PromiseRejectedResult } => f.result.status === 'rejected');

  if (!failures.length) return;

  logger.error('poWorkflow: WhatsApp send failed for some contacts', { context, failed: failures.map((f) => f.contact.phone) });
  await Promise.all(
    failures.map((f) => {
      const errMsg = f.result.reason instanceof Error ? f.result.reason.message : String(f.result.reason);
      return notifyWhatsAppFailed(f.contact.phone, `${context}: ${errMsg}`);
    })
  );
}

export async function broadcastText(org: BusinessOrg, department: BusinessDepartment, message: string): Promise<void> {
  const contacts = await getContacts(org, department);
  const results = await Promise.allSettled(contacts.map((c) => sendWhatsAppText(c.phone, message)));
  await reportSendFailures(contacts, results, `${org}/${department} text`);
}

async function broadcastButtons(
  org: BusinessOrg,
  department: BusinessDepartment,
  message: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  const contacts = await getContacts(org, department);
  const results = await Promise.allSettled(contacts.map((c) => sendWhatsAppButtons(c.phone, message, buttons)));
  await reportSendFailures(contacts, results, `${org}/${department} buttons`);
}

// Final values are entered by ZE Admin; MM Prod and MM Acc each get an Acknowledge/Incorrect
// prompt to confirm those values are right before production starts. Either one acknowledging
// is enough to proceed (see notifyZeProdStartProduction's idempotency guard below).
export async function notifyMmForAcknowledge(order: PoDoc): Promise<void> {
  const message = `Hi,\n\nPO *${order.poNumber}* (${order.client}) has final values set by ZE Admin:\n\n*Qty:* ${order.finalValues?.qty ?? order.qty ?? 'N/A'}\n*Rate:* ${order.finalValues?.rate ?? 'N/A'}\n*Amount:* ${order.finalValues?.amount !== undefined ? `₹${order.finalValues.amount}` : 'N/A'}\n\nPlease confirm these values are correct.`;
  const buttons = [
    { id: `mm_ack_${order._id}`, title: 'Acknowledge' },
    { id: `mm_reject_${order._id}`, title: 'Incorrect' },
  ];
  await broadcastButtons('MILKY_MIST', 'PRODUCTION', message, buttons);
  await broadcastButtons('MILKY_MIST', 'ACCOUNTS', message, buttons);
  await pushStage(order, 'MM_ACK_PENDING');
}

export async function notifyZeProdStartProduction(order: PoDoc): Promise<void> {
  // Either MM Prod or MM Acc acknowledging is enough — ignore a second tap once we've
  // already moved past MM_ACK_PENDING so production isn't "started" twice.
  if (order.status !== 'MM_ACK_PENDING') {
    logger.info('poWorkflow: MM acknowledge tap ignored, PO already past MM_ACK_PENDING', { poNumber: order.poNumber, status: order.status });
    return;
  }

  order.mmAcknowledgedAt = new Date();
  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nMilky Mist has acknowledged PO *${order.poNumber}*.\n\nPlease start production.`
  );
  await pushStage(order, 'PRODUCTION_STARTED');
}

export async function handleMmRejection(order: PoDoc): Promise<void> {
  if (order.status !== 'MM_ACK_PENDING') {
    logger.info('poWorkflow: MM rejection ignored, PO already past MM_ACK_PENDING', { poNumber: order.poNumber, status: order.status });
    return;
  }

  await notifyPoAckRejected(order.poNumber, order._id.toString());
  await pushStage(order, 'RECEIVED');
}

export async function pollZeProdStatus(order: PoDoc): Promise<void> {
  await broadcastButtons(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nDaily production status check for PO *${order.poNumber}*.\n\nWhat is the current status?`,
    [
      { id: `zeprod_status_started_${order._id}`, title: 'Started' },
      { id: `zeprod_status_inprogress_${order._id}`, title: 'In Progress' },
      { id: `zeprod_status_completed_${order._id}`, title: 'Completed' },
    ]
  );
  order.lastStatusPollAt = new Date();
  await withRetry(() => order.save(), { retries: 3, delayMs: 300, label: `PO save (${order.poNumber} -> lastStatusPollAt)` });
}

export async function recordProductionStatus(order: PoDoc, status: ProductionStatus): Promise<void> {
  order.productionStatus = status;
  order.productionStatusUpdatedAt = new Date();
  if (status === 'IN_PROGRESS') order.status = 'PRODUCTION_IN_PROGRESS';
  await withRetry(() => order.save(), { retries: 3, delayMs: 300, label: `PO save (${order.poNumber} -> productionStatus=${status})` });

  if (status === 'STARTED') await notifyProductionStarted(order.poNumber, order._id.toString());
}

export async function relayProductionStatusToMm(order: PoDoc, status: ProductionStatus): Promise<void> {
  const label = status === 'STARTED' ? 'Started' : status === 'IN_PROGRESS' ? 'In Progress' : 'Completed';
  const message = `Hi,\n\nProduction status update for PO *${order.poNumber}*:\n\n*${label}*`;
  await broadcastText('MILKY_MIST', 'PRODUCTION', message);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
}

export async function handleProductionCompleted(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nProduction completed for PO *${order.poNumber}*.\n\nRequest for QAQC report.`
  );

  await notifyQaqcRequested(order.poNumber, order._id.toString());
  await notifyApprovalRequested(order.poNumber, order._id.toString());

  const poInfo = { poNumber: order.poNumber, client: order.client, batch: order.batch, qty: order.qty };
  const urls = await generateDocsResilient(poInfo, order.poNumber);

  await pushStage(order, 'QAQC_REQUESTED', {
    qaqcReportUrl: urls.QAQC,
    dnUrl: urls.DN,
    invoiceUrl: urls.INVOICE,
    ewayBillUrl: urls.EWAY_BILL,
  });
}

// Each document is generated independently (with its own retries inside uploadToS3) so that
// one failure — e.g. a transient S3 outage — doesn't block the other three or the whole workflow.
async function generateDocsResilient(
  poInfo: { poNumber: string; client: string; batch?: string; qty?: number },
  poNumberForLog: string
): Promise<Partial<Record<DummyDocType, string>>> {
  const docTypes: DummyDocType[] = ['QAQC', 'DN', 'INVOICE', 'EWAY_BILL'];
  const results = await Promise.allSettled(docTypes.map((t) => generateDummyDoc(poInfo, t)));

  const urls: Partial<Record<DummyDocType, string>> = {};
  const failed: DummyDocType[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') urls[docTypes[i]] = r.value.url;
    else failed.push(docTypes[i]);
  });

  if (failed.length) {
    logger.error('poWorkflow: dummy document generation failed for some types', { poNumber: poNumberForLog, failed });
    await notifySystemError('po-workflow-doc-generation', `Failed to generate: ${failed.join(', ')} for PO ${poNumberForLog}`);
  }

  return urls;
}

export async function pollQaqcReady(order: PoDoc): Promise<void> {
  await broadcastButtons(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nIs the QAQC report ready for PO *${order.poNumber}*?`,
    [{ id: `zeprod_qaqc_ready_${order._id}`, title: 'Yes, Ready' }]
  );
}

export async function handleQaqcReady(order: PoDoc): Promise<void> {
  await pushStage(order, 'QAQC_READY');

  await broadcastButtons(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nThe QAQC report is ready for PO *${order.poNumber}*.\n\nPlease confirm payment for the QAQC report.`,
    [{ id: `zeacc_qaqc_paid_${order._id}`, title: 'Payment Done' }]
  );
}

export async function handleQaqcPaymentDone(order: PoDoc): Promise<void> {
  if (order.status !== 'QAQC_READY') {
    logger.info('poWorkflow: QAQC payment tap ignored, PO already past QAQC_READY', { poNumber: order.poNumber, status: order.status });
    return;
  }

  const docsMessage = `Hi,\n\nDocuments for PO *${order.poNumber}* are ready:\n\n📄 GRN: ${order.dnUrl}\n📄 Invoice: ${order.invoiceUrl}\n📄 QAQC Report: ${order.qaqcReportUrl}`;
  await broadcastText('MILKY_MIST', 'PRODUCTION', docsMessage);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', docsMessage);
  await pushStage(order, 'QAQC_PAID');

  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nPlease provide the weight after loading for PO *${order.poNumber}* (reply with the weight in kg).`
  );
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nWeight after loading has been requested for PO *${order.poNumber}*.`
  );
  await pushStage(order, 'WEIGHT_REQUESTED');
  await markAwaitingWeight(order);
}

// ZE Production replies to the "please provide weight" prompt with a plain-text number.
// We track which PO that reply belongs to via BotSession.temporaryData, keyed by the
// ZE Production contact's phone, since there is exactly one contact per org/department.
export async function markAwaitingWeight(order: PoDoc): Promise<void> {
  const contacts = await getContacts('ZEROEARTH', 'PRODUCTION');
  await Promise.all(
    contacts.map((c) =>
      withRetry(
        () => BotSession.findOneAndUpdate(
          { phoneNumber: c.phone },
          { $set: { 'temporaryData.awaitingWeightForPO': order._id.toString() }, $currentDate: { lastInteraction: true } },
          { upsert: true }
        ),
        { retries: 3, delayMs: 300, label: `BotSession markAwaitingWeight (${c.phone})` }
      )
    )
  );
}

export async function clearAwaitingWeight(phone: string): Promise<void> {
  await connectDB();
  await withRetry(
    () => BotSession.findOneAndUpdate({ phoneNumber: phone }, { $unset: { 'temporaryData.awaitingWeightForPO': '' } }),
    { retries: 3, delayMs: 300, label: `BotSession clearAwaitingWeight (${phone})` }
  );
}

export async function recordWeight(order: PoDoc, weightKg: number): Promise<void> {
  order.weightKg = weightKg;
  await withRetry(() => order.save(), { retries: 3, delayMs: 300, label: `PO save (${order.poNumber} -> weightKg)` });
}

export async function pollWeighBridgeReady(order: PoDoc): Promise<void> {
  await broadcastButtons(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nIs the weighbridge report ready for PO *${order.poNumber}*?`,
    [{ id: `zeprod_wb_ready_${order._id}`, title: 'Yes, Ready' }]
  );
}

export async function handleWeighBridgeReady(order: PoDoc): Promise<void> {
  const weighBridge = await generateDummyDoc(
    { poNumber: order.poNumber, client: order.client, batch: order.batch, qty: order.qty },
    'DN'
  );
  await pushStage(order, 'WEIGHBRIDGE_READY', { weighBridgeReportUrl: weighBridge.url });

  await broadcastButtons(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nWeighbridge report is ready for PO *${order.poNumber}*.\n\nPlease make the weighbridge payment.`,
    [{ id: `zeacc_wb_paid_${order._id}`, title: 'Payment Done' }]
  );
}

export async function handleWeighBridgePaid(order: PoDoc): Promise<void> {
  order.weighBridgePaidAt = new Date();

  await broadcastText(
    'MILKY_MIST', 'PRODUCTION',
    `Hi,\n\n*Prod 3 — CH4OW Loaded & Dispatched*\n\nPO: *${order.poNumber}*\nWeight: ${order.weightKg ?? 'N/A'}kg\n📄 GRN: ${order.dnUrl}\n📄 E-Way Bill: ${order.ewayBillUrl}`
  );
  await broadcastText(
    'MILKY_MIST', 'ACCOUNTS',
    `Hi,\n\n*Prod 3 — CH4OW Loaded & Dispatched*\n\nPO: *${order.poNumber}*\n📄 Invoice: ${order.invoiceUrl}`
  );

  await pushStage(order, 'DISPATCHED', { dispatchedAt: new Date() });
}

// FYI-only step, no button/gate — reminds ZE Accounts that bills for this shipment
// (QAQC, weighbridge, transport, etc.) are still pending receipt before the DN/invoice can be approved.
export async function notifyPendingBills(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nReminder: bills for PO *${order.poNumber}* are pending receipt before approval.`
  );
}

export async function approveDn(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nApproved DN for PO *${order.poNumber}*:\n\n📄 GRN: ${order.dnUrl}\n📄 QAQC Report: ${order.qaqcReportUrl}\n📄 Weighbridge Report: ${order.weighBridgeReportUrl}\n📄 E-Way Bill: ${order.ewayBillUrl}`
  );
  await pushStage(order, 'DN_APPROVED', { dnApprovedAt: new Date() });
}

export async function sendApprovedInvoice(order: PoDoc): Promise<void> {
  const message = `Hi,\n\nApproved Invoice for PO *${order.poNumber}*:\n\n📄 ${order.invoiceUrl}`;
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'ACCOUNTS', message);
  await pushStage(order, 'INVOICE_APPROVED');
}

export async function requestPayment(order: PoDoc): Promise<void> {
  await broadcastText(
    'MILKY_MIST', 'ACCOUNTS',
    `Hi,\n\nRequest for payment on PO *${order.poNumber}* — due on the 15th day per terms.`
  );
  await pushStage(order, 'PAYMENT_REQUESTED', { paymentRequestedAt: new Date() });
}

// Called from the payment-proof upload route once ZE Admin uploads the transaction
// details received from Milky Mist — not a WhatsApp-driven step.
export async function recordPaymentProof(order: PoDoc): Promise<void> {
  await pushStage(order, 'PAYMENT_DONE', { paymentDoneAt: new Date() });

  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    `Hi,\n\nPayment done for PO *${order.poNumber}* — transaction proof uploaded.`
  );
  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    `Hi,\n\nPayment received for PO *${order.poNumber}*.`
  );
}

export async function closeTicket(order: PoDoc): Promise<void> {
  const message = `Hi,\n\nPO *${order.poNumber}* is fully settled. Ticket closed. Thank you!`;
  await broadcastText('MILKY_MIST', 'PRODUCTION', message);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'PRODUCTION', message);
  await broadcastText('ZEROEARTH', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'ADMINISTRATION', message);
  await notifyPoClosed(order.poNumber, order._id.toString());
}
