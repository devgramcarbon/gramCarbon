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
import { getTemplateMessage } from './templates';
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

  // No contact configured, or every send rejected (e.g. outside WhatsApp's 24h session
  // window) — nothing actually reached anyone. Callers need to know so they don't silently
  // advance workflow state as if the message went out.
  if (results.length === 0 || results.every((r) => r.status === 'rejected')) {
    throw new Error(`No WhatsApp message delivered for ${org}/${department}`);
  }
}

// Final values are entered by ZE Admin; MM Prod and MM Acc each get an Acknowledge/Incorrect
// prompt to confirm those values are right before production starts. Either one acknowledging
// is enough to proceed (see notifyZeProdStartProduction's idempotency guard below).
export async function notifyMmForAcknowledge(order: PoDoc): Promise<void> {
  const message = await getTemplateMessage('po_mm_acknowledge', {
    poNumber: order.poNumber,
    client: order.client,
    qty: order.finalValues?.qty ?? order.qty,
    rate: order.finalValues?.rate,
    amount: order.finalValues?.amount !== undefined ? `₹${order.finalValues.amount}` : undefined,
  });
  const buttons = [
    { id: `mm_ack_${order._id}`, title: 'Acknowledge' },
    { id: `mm_reject_${order._id}`, title: 'Incorrect' },
  ];
  const [prodResult, accResult] = await Promise.allSettled([
    broadcastButtons('MILKY_MIST', 'PRODUCTION', message, buttons),
    broadcastButtons('MILKY_MIST', 'ACCOUNTS', message, buttons),
  ]);

  // If neither MM Production nor MM Accounts actually received the message, moving the PO
  // to "Awaiting MM Acknowledgement" would be misleading — MM has nothing to acknowledge.
  if (prodResult.status === 'rejected' && accResult.status === 'rejected') {
    throw new Error(`Failed to notify Milky Mist for PO ${order.poNumber} acknowledge — neither Production nor Accounts received the message`);
  }

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
    await getTemplateMessage('po_ze_start_production', { poNumber: order.poNumber })
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
    await getTemplateMessage('po_daily_status_check', { poNumber: order.poNumber }),
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
  const message = await getTemplateMessage('po_production_status_update', { poNumber: order.poNumber, label });
  await broadcastText('MILKY_MIST', 'PRODUCTION', message);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
}

export async function handleProductionCompleted(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    await getTemplateMessage('po_production_completed', { poNumber: order.poNumber })
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
    await getTemplateMessage('po_qaqc_ready_check', { poNumber: order.poNumber }),
    [{ id: `zeprod_qaqc_ready_${order._id}`, title: 'Yes, Ready' }]
  );
}

export async function handleQaqcReady(order: PoDoc): Promise<void> {
  await pushStage(order, 'QAQC_READY');

  await broadcastButtons(
    'ZEROEARTH', 'ACCOUNTS',
    await getTemplateMessage('po_qaqc_ready_payment', { poNumber: order.poNumber }),
    [{ id: `zeacc_qaqc_paid_${order._id}`, title: 'Payment Done' }]
  );
}

export async function handleQaqcPaymentDone(order: PoDoc): Promise<void> {
  if (order.status !== 'QAQC_READY') {
    logger.info('poWorkflow: QAQC payment tap ignored, PO already past QAQC_READY', { poNumber: order.poNumber, status: order.status });
    return;
  }

  const docsMessage = await getTemplateMessage('po_qaqc_docs_ready', {
    poNumber: order.poNumber,
    dnUrl: order.dnUrl,
    invoiceUrl: order.invoiceUrl,
    qaqcReportUrl: order.qaqcReportUrl,
  });
  await broadcastText('MILKY_MIST', 'PRODUCTION', docsMessage);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', docsMessage);
  await pushStage(order, 'QAQC_PAID');

  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    await getTemplateMessage('po_weight_request_prod', { poNumber: order.poNumber })
  );
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    await getTemplateMessage('po_weight_request_acc', { poNumber: order.poNumber })
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
    await getTemplateMessage('po_wb_ready_check', { poNumber: order.poNumber }),
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
    await getTemplateMessage('po_wb_ready_payment', { poNumber: order.poNumber }),
    [{ id: `zeacc_wb_paid_${order._id}`, title: 'Payment Done' }]
  );
}

export async function handleWeighBridgePaid(order: PoDoc): Promise<void> {
  order.weighBridgePaidAt = new Date();

  await broadcastText(
    'MILKY_MIST', 'PRODUCTION',
    await getTemplateMessage('po_dispatched_prod', {
      poNumber: order.poNumber,
      weightKg: order.weightKg,
      dnUrl: order.dnUrl,
      ewayBillUrl: order.ewayBillUrl,
    })
  );
  await broadcastText(
    'MILKY_MIST', 'ACCOUNTS',
    await getTemplateMessage('po_dispatched_acc', { poNumber: order.poNumber, invoiceUrl: order.invoiceUrl })
  );

  await pushStage(order, 'DISPATCHED', { dispatchedAt: new Date() });
}

// FYI-only step, no button/gate — reminds ZE Accounts that bills for this shipment
// (QAQC, weighbridge, transport, etc.) are still pending receipt before the DN/invoice can be approved.
export async function notifyPendingBills(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    await getTemplateMessage('po_pending_bills', { poNumber: order.poNumber })
  );
}

export async function approveDn(order: PoDoc): Promise<void> {
  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    await getTemplateMessage('po_dn_approved', {
      poNumber: order.poNumber,
      dnUrl: order.dnUrl,
      qaqcReportUrl: order.qaqcReportUrl,
      weighBridgeReportUrl: order.weighBridgeReportUrl,
      ewayBillUrl: order.ewayBillUrl,
    })
  );
  await pushStage(order, 'DN_APPROVED', { dnApprovedAt: new Date() });
}

export async function sendApprovedInvoice(order: PoDoc): Promise<void> {
  const message = await getTemplateMessage('po_invoice_approved', { poNumber: order.poNumber, invoiceUrl: order.invoiceUrl });
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'ACCOUNTS', message);
  await pushStage(order, 'INVOICE_APPROVED');
}

export async function requestPayment(order: PoDoc): Promise<void> {
  await broadcastText(
    'MILKY_MIST', 'ACCOUNTS',
    await getTemplateMessage('po_payment_requested', { poNumber: order.poNumber })
  );
  await pushStage(order, 'PAYMENT_REQUESTED', { paymentRequestedAt: new Date() });
}

// Called from the payment-proof upload route once ZE Admin uploads the transaction
// details received from Milky Mist — not a WhatsApp-driven step.
export async function recordPaymentProof(order: PoDoc): Promise<void> {
  await pushStage(order, 'PAYMENT_DONE', { paymentDoneAt: new Date() });

  await broadcastText(
    'ZEROEARTH', 'ACCOUNTS',
    await getTemplateMessage('po_payment_done_acc', { poNumber: order.poNumber })
  );
  await broadcastText(
    'ZEROEARTH', 'PRODUCTION',
    await getTemplateMessage('po_payment_done_prod', { poNumber: order.poNumber })
  );
}

export async function closeTicket(order: PoDoc): Promise<void> {
  const message = await getTemplateMessage('po_ticket_closed', { poNumber: order.poNumber });
  await broadcastText('MILKY_MIST', 'PRODUCTION', message);
  await broadcastText('MILKY_MIST', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'PRODUCTION', message);
  await broadcastText('ZEROEARTH', 'ACCOUNTS', message);
  await broadcastText('ZEROEARTH', 'ADMINISTRATION', message);
  await notifyPoClosed(order.poNumber, order._id.toString());
}
