import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import axios from 'axios';
import connectDB from '@/lib/mongodb';
import Distributor from '@/lib/models/Distributor';
import type { IDistributor } from '@/lib/models/Distributor';
import Farmer from '@/lib/models/Farmer';
import type { IFarmer } from '@/lib/models/Farmer';
import Sale from '@/lib/models/Sale';
import Stock from '@/lib/models/Stock';
import type { IStock } from '@/lib/models/Stock';
import BotSession from '@/lib/models/BotSession';
import CarbonFarmer from '@/lib/models/CarbonFarmer';
import type { ICarbonFarmer } from '@/lib/models/CarbonFarmer';
import Cattle from '@/lib/models/Cattle';
import { recordFeedGivenBatch, recordFeedNotGivenBatch } from '@/lib/offsetEngine';
import { sendWhatsAppButtons } from '@/lib/whatsapp';
import { notifySystemError } from '@/lib/notifications';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import {
  notifyZeProdStartProduction,
  recordProductionStatus,
  relayProductionStatusToMm,
  handleProductionCompleted,
  handleQaqcReady,
  handleWeighBridgeReady,
  handleWeighBridgePaid,
  sendApprovedInvoice,
  requestPayment,
} from '@/lib/poWorkflow';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import logger from '@/lib/logger';
import type { Document, Types } from 'mongoose';

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

interface BotData {
  farmerMobile?: string;
  farmerName?: string;
  cowCount?: number;
  qtyKg?: number;
  batchNo?: string;
}

interface RegData {
  mobile?: string;
  name?: string;
  village?: string;
  animalCount?: number;
  animalType?: string;
}

async function sendText(to: string, body: string): Promise<void> {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
    { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
  );
}

async function getSession(phone: string): Promise<Document & { phoneNumber: string; currentState: string; step: number; temporaryData: Record<string, unknown>; conversationHistory: Array<{ role: string; message: string }>; lastMessageId?: string; markModified: (key: string) => void; save: () => Promise<unknown> }> {
  await connectDB();
  let session = await BotSession.findOne({ phoneNumber: phone });
  if (!session) session = await BotSession.create({ phoneNumber: phone });
  return session as ReturnType<typeof getSession> extends Promise<infer T> ? T : never;
}

async function saveSession(session: Awaited<ReturnType<typeof getSession>>, updates: Record<string, unknown>): Promise<void> {
  Object.assign(session, updates, {
    lastInteraction: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  session.markModified('temporaryData');
  await session.save();
}

async function resetSession(session: Awaited<ReturnType<typeof getSession>>): Promise<void> {
  await saveSession(session, { currentState: 'idle', step: 0, temporaryData: {} });
}

async function handleMessage(phone: string, text: string, profileName?: string): Promise<void> {
  const session = await getSession(phone);
  const msg = (text || '').trim().toLowerCase();

  session.conversationHistory.push({ role: 'user', message: text });
  // Keep only the last 50 messages to prevent unbounded document growth
  if (session.conversationHistory.length > 50) {
    session.conversationHistory.splice(0, session.conversationHistory.length - 50);
  }

  try {
    const isGreeting = ['hi', 'hello', 'menu', 'start'].includes(msg);
    const isCancel = ['cancel', 'quit', 'exit', '0'].includes(msg);

    if (isCancel && session.currentState !== 'idle') {
      await resetSession(session);
      await sendText(phone, `❌ Cancelled.\n\nReply with:\n1️⃣ Record Sale\n2️⃣ Check My Stock\n3️⃣ View My Sales\n4️⃣ Register Farmer`);
      return;
    }

    if (isGreeting || session.currentState === 'idle') {
      await saveSession(session, { currentState: 'main_menu', step: 0 });
      const greeting = profileName ? `👋 Hi *${profileName}*! Welcome to gramCarbon.` : `👋 Welcome to gramCarbon Console Bot!`;
      await sendText(phone, `${greeting}\n\nReply with:\n1️⃣ Record Sale\n2️⃣ Check My Stock\n3️⃣ View My Sales\n4️⃣ Register Farmer`);
      return;
    }

    if (session.currentState === 'main_menu') {
      if (msg === '1' || msg.includes('record')) {
        await connectDB();
        const stockCheck = await Stock.findOne({ distributorPhone: phone }).lean<IStock>();
        if (!stockCheck) {
          await sendText(phone, '❌ No stock has been allocated to your account yet. Please contact your admin to add stock.');
          await resetSession(session);
          return;
        }
        await saveSession(session, { currentState: 'record_sale', step: 1, temporaryData: {} });
        await sendText(phone, `📝 *Record Sale*\n\nEnter farmer's name:\n_(Type *cancel* anytime to stop)_`);
      } else if (msg === '2' || msg.includes('stock')) {
        await connectDB();
        const stock = await Stock.findOne({ distributorPhone: phone }).lean<IStock>();
        const dist = await Distributor.findOne({ phone }).lean<IDistributor>();
        const bal = (stock?.receivedKg ?? 0) - (stock?.soldKg ?? 0);
        await sendText(
          phone,
          `📦 *Stock — ${dist?.name || phone}*\n\nReceived : ${stock?.receivedKg ?? 0}kg\nSold     : ${stock?.soldKg ?? 0}kg\nBalance  : ${bal}kg`
        );
        await resetSession(session);
      } else if (msg === '3' || msg.includes('sales') || msg.includes('view')) {
        await connectDB();
        const sales = await Sale.find({ distributorPhone: phone }).sort({ saleDate: -1 }).limit(5).lean();
        if (!sales.length) {
          await sendText(phone, '📋 No sales recorded yet.');
        } else {
          const lines = sales.map((s, i) => {
            const d = new Date(s.saleDate as Date).toLocaleDateString('en-IN');
            return `${i + 1}. ${s.farmerName} | ${s.cowCount} cows | ${s.qtyKg}kg | ${d}`;
          });
          await sendText(phone, `📋 *Recent Sales*\n\n${lines.join('\n')}`);
        }
        await resetSession(session);
      } else if (msg === '4' || msg.includes('register')) {
        await saveSession(session, { currentState: 'register_farmer', step: 1, temporaryData: {} });
        await sendText(phone, `🌾 *Register Farmer* — Step 1/4\n\nEnter farmer's mobile number:\n_(Type *cancel* anytime to stop)_`);
      } else {
        await sendText(phone, 'Reply 1 (Record Sale), 2 (Check Stock), 3 (View Sales), or 4 (Register Farmer)');
      }
      return;
    }

    if (session.currentState === 'record_sale') {
      const data = (session.temporaryData || {}) as BotData;

      if (session.step === 1) {
        // Step 1 — name lookup
        const name = text.trim();
        if (name.length < 2) { await sendText(phone, '❌ Enter a valid farmer name.'); return; }
        await connectDB();
        const farmer = await Farmer.findOne({ name: new RegExp(`^${name}$`, 'i'), isActive: true }).lean<IFarmer>();
        if (!farmer) {
          await sendText(phone, `❌ *Farmer not registered.*\n\nNo farmer found with name *${name}*.\n\nGo back to the main menu and choose *4️⃣ Register Farmer* to add them first.\n\n_(Type *cancel* to go back to menu)_`);
          return;
        }
        data.farmerMobile = farmer.mobile as string;
        data.farmerName = farmer.name as string;
        data.cowCount = farmer.animalCount as number;
        await saveSession(session, { step: 2, temporaryData: data });
        const details = `👨‍🌾 *${farmer.name}*\n🆔 ${farmer.farmerId}\n📱 ${farmer.mobile}\n🐄 ${farmer.animalCount} animals (${farmer.animalType})${farmer.village ? `\n🏘️ ${farmer.village}` : ''}`;
        await sendWhatsAppButtons(phone, `${details}\n\nIs this the correct farmer?`, [
          { id: 'yes', title: 'Yes' },
          { id: 'no', title: 'No, try again' },
        ]);

      } else if (session.step === 2) {
        // Step 2 — confirmation
        if (msg === 'yes') {
          await saveSession(session, { step: 4, temporaryData: data });
          await sendText(phone, `✅ Farmer confirmed: *${data.farmerName}* (${data.cowCount} animals)\n\nHow many kg of feed?`);
        } else {
          await saveSession(session, { step: 1, temporaryData: {} });
          await sendText(phone, `No problem! Enter the farmer's name again:`);
        }

      } else if (session.step === 4) {
        const qty = parseFloat(text);
        if (isNaN(qty) || qty <= 0) { await sendText(phone, '❌ Enter a valid quantity.'); return; }
        data.qtyKg = qty;
        await saveSession(session, { step: 5, temporaryData: data });
        await sendText(phone, `✅ Qty: *${qty}kg*\n\nBatch number (or type *skip*):`);

      } else if (session.step === 5) {
        data.batchNo = msg === 'skip' ? '' : text.trim();

        await connectDB();
        const stock = await Stock.findOne({ distributorPhone: phone }).lean<IStock>();
        if (!stock) {
          await sendText(phone, '❌ No stock allocated to your account. Contact admin to add stock.');
          await resetSession(session);
          return;
        }

        const balance = stock.receivedKg - stock.soldKg;
        if (balance < (data.qtyKg ?? 0)) {
          await sendText(phone, `❌ Insufficient stock! Balance: *${balance}kg*, Requested: *${data.qtyKg}kg*`);
          await resetSession(session);
          return;
        }

        const sale = await Sale.create({
          distributorPhone: phone,
          farmerName: data.farmerName,
          farmerMobile: data.farmerMobile,
          cowCount: data.cowCount,
          qtyKg: data.qtyKg,
          batchNo: data.batchNo,
          saleDate: new Date(),
        });
        await Stock.findOneAndUpdate({ distributorPhone: phone }, { $inc: { soldKg: data.qtyKg } });

        emitEvent(EVENTS.SALE_RECORDED, { sale: sale.toObject() });
        emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'sale_via_bot' });

        await sendText(
          phone,
          `✅ *Sale Recorded!*\n\n👨‍🌾 ${data.farmerName}\n🐄 ${data.cowCount} animals\n⚖️ ${data.qtyKg}kg\n📦 Batch: ${data.batchNo || 'N/A'}\n💰 Remaining: ${balance - (data.qtyKg ?? 0)}kg`
        );
        await resetSession(session);
      }
      return;
    }

    if (session.currentState === 'register_farmer') {
      const data = (session.temporaryData || {}) as RegData;

      if (session.step === 1) {
        const mobile = text.trim().replace(/\D/g, '');
        if (mobile.length < 10) { await sendText(phone, '❌ Enter a valid 10-digit mobile number.'); return; }
        await connectDB();
        const existing = await Farmer.findOne({ $or: [{ mobile }, { mobile: `91${mobile}` }] }).lean<IFarmer>();
        if (existing) {
          await sendText(phone, `⚠️ A farmer with mobile *${text.trim()}* is already registered as *${existing.name}*.\n\nEnter a different mobile number or type *cancel* to stop.`);
          return;
        }
        data.mobile = mobile;
        await saveSession(session, { step: 2, temporaryData: data });
        await sendText(phone, `✅ Mobile: *${mobile}*\n\nStep 2/4: Enter farmer's full name:`);

      } else if (session.step === 2) {
        const name = text.trim();
        if (name.length < 2) { await sendText(phone, '❌ Name must be at least 2 characters.'); return; }
        data.name = name;
        await saveSession(session, { step: 3, temporaryData: data });
        await sendText(phone, `✅ Name: *${name}*\n\nStep 3/4: Enter village name (or type *skip*):`)

      } else if (session.step === 3) {
        data.village = msg === 'skip' ? '' : text.trim();
        await saveSession(session, { step: 4, temporaryData: data });
        await sendText(phone, `Step 4/4: How many animals does this farmer have? (or type *skip*):`);

      } else if (session.step === 4) {
        if (msg !== 'skip') {
          const count = parseInt(text);
          if (isNaN(count) || count < 0) { await sendText(phone, '❌ Enter a valid number or type *skip*.'); return; }
          data.animalCount = count;
        }

        await connectDB();
        const farmer = await Farmer.create({
          name: data.name,
          mobile: data.mobile,
          village: data.village || undefined,
          animalCount: data.animalCount ?? 0,
          distributorPhone: phone,
          isActive: true,
        });

        emitEvent(EVENTS.DASHBOARD_UPDATED, { type: 'farmer_added' });

        await sendText(
          phone,
          `✅ *Farmer Registered!*\n\n👨‍🌾 ${farmer.name}\n📱 ${farmer.mobile}\n🆔 ${farmer.farmerId}\n${data.village ? `🏘️ ${data.village}\n` : ''}🐄 ${farmer.animalCount ?? 0} animals\n\nYou can now record sales for this farmer.`
        );
        await resetSession(session);
      }
      return;
    }

    await resetSession(session);
    await sendText(phone, `Reply 1 (Record Sale), 2 (Check Stock), 3 (View Sales), or 4 (Register Farmer)`);
  } catch (err) {
    const detail = axios.isAxiosError(err) ? err.response?.data : undefined;
    logger.error('Bot handler error', { err: (err as Error).message, detail, phone });
    await notifySystemError('webhook', (err as Error).message);
    await sendText(phone, '⚠️ An error occurred. Please try again.');
    await resetSession(session);
  }
}

async function findCarbonFarmerByPhone(phone: string): Promise<(Document & ICarbonFarmer) | null> {
  await connectDB();
  const bare = phone.replace(/\D/g, '');
  const withoutCountryCode = bare.startsWith('91') ? bare.slice(2) : bare;
  return CarbonFarmer.findOne({
    mobile: { $in: [bare, withoutCountryCode, `91${withoutCountryCode}`] },
  }) as unknown as Promise<(Document & ICarbonFarmer) | null>;
}

async function handleFeedCheckReply(
  farmer: Document & ICarbonFarmer,
  phone: string,
  buttonId: string
): Promise<void> {
  const isYes = buttonId.startsWith('feed_yes_');
  const isNo = buttonId.startsWith('feed_no_');

  if (!isYes && !isNo) {
    await sendText(phone, 'Please tap *Yes* or *No* to answer: have you fed the cow(s) today?');
    return;
  }

  await connectDB();
  const cattleList = await Cattle.find({ farmer: farmer._id, isActive: true }).lean<Array<{ _id: Types.ObjectId; cattleId: string }>>();

  if (!cattleList.length) {
    logger.warn('Feed check reply from farmer with no active cattle', { phone, farmerCustomId: farmer.farmerCustomId });
    await sendText(phone, 'No active cattle found under your account. Please contact your program coordinator.');
    return;
  }

  const logDate = new Date();
  const paramsList = cattleList.map((cattle) => ({
    farmer: farmer._id as Types.ObjectId,
    farmerCustomId: farmer.farmerCustomId,
    cattle: cattle._id,
    cattleId: cattle.cattleId,
    logDate,
  }));
  if (isYes) await recordFeedGivenBatch(paramsList);
  else await recordFeedNotGivenBatch(paramsList);

  await BotSession.findOneAndUpdate({ phoneNumber: phone }, { $unset: { 'temporaryData.awaitingFeedCheck': '' } });

  if (isYes) {
    await sendText(phone, `✅ Thanks! Logged feed for ${cattleList.length} cow${cattleList.length > 1 ? 's' : ''} today.`);
  } else {
    await sendText(phone, `Noted, thanks for letting us know. See you tomorrow!`);
  }
}

const PO_BUTTON_PREFIXES = [
  'mm_ack_',
  'zeprod_status_started_',
  'zeprod_status_inprogress_',
  'zeprod_status_completed_',
  'zeprod_qaqc_ready_',
  'zeprod_wb_ready_',
  'zeacc_wb_paid_',
] as const;

function matchPoButton(buttonId: string): { prefix: (typeof PO_BUTTON_PREFIXES)[number]; poId: string } | null {
  const prefix = PO_BUTTON_PREFIXES.find((p) => buttonId.startsWith(p));
  if (!prefix) return null;
  return { prefix, poId: buttonId.slice(prefix.length) };
}

async function handlePoWorkflowButton(phone: string, buttonId: string): Promise<boolean> {
  const match = matchPoButton(buttonId);
  if (!match) return false;

  await connectDB();
  const order = await PurchaseOrder.findById(match.poId);
  if (!order) {
    logger.warn('PO workflow button referenced missing PO', { phone, buttonId });
    return true;
  }

  try {
    switch (match.prefix) {
      case 'mm_ack_':
        await notifyZeProdStartProduction(order);
        break;
      case 'zeprod_status_started_':
        await recordProductionStatus(order, 'STARTED');
        await relayProductionStatusToMm(order, 'STARTED');
        break;
      case 'zeprod_status_inprogress_':
        await recordProductionStatus(order, 'IN_PROGRESS');
        await relayProductionStatusToMm(order, 'IN_PROGRESS');
        break;
      case 'zeprod_status_completed_':
        await recordProductionStatus(order, 'COMPLETED');
        await relayProductionStatusToMm(order, 'COMPLETED');
        await handleProductionCompleted(order);
        break;
      case 'zeprod_qaqc_ready_':
        await handleQaqcReady(order);
        break;
      case 'zeprod_wb_ready_':
        await handleWeighBridgeReady(order);
        break;
      case 'zeacc_wb_paid_':
        await handleWeighBridgePaid(order);
        await sendApprovedInvoice(order);
        await requestPayment(order);
        break;
    }
  } catch (err) {
    logger.error('PO workflow button handling failed', { phone, buttonId, err: (err as Error).message });
    await notifySystemError('po-workflow-webhook', (err as Error).message);
  }

  return true;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  if (
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === process.env.VERIFY_TOKEN
  ) {
    return new Response(searchParams.get('hub.challenge'), { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; id?: string; type?: string; text?: { body?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } } }>; contacts?: Array<{ profile?: { name?: string } }> } }> }> };
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return NextResponse.json({ status: 'no_message' });

    const from = message.from;
    const profileName = value?.contacts?.[0]?.profile?.name;
    let text = '';
    let buttonId = '';
    if (message.type === 'text') text = message.text?.body || '';
    else if (message.type === 'interactive') {
      text = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
      buttonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
    }

    if (from) {
      await connectDB();

      const msgId = message.id;
      if (msgId) {
        const existing = await BotSession.findOne({ phoneNumber: from });
        if ((existing as { lastMessageId?: string } | null)?.lastMessageId === msgId) {
          logger.warn('Duplicate webhook delivery skipped', { phone: from, msgId });
          return NextResponse.json({ status: 'ok' });
        }
        await BotSession.findOneAndUpdate({ phoneNumber: from }, { lastMessageId: msgId }, { upsert: true });
      }

      if (buttonId) {
        const handled = await handlePoWorkflowButton(from, buttonId);
        if (handled) return NextResponse.json({ status: 'ok' });
      }

      const dist = await Distributor.findOne({ phone: from }).lean<IDistributor>();

      if (dist) {
        logger.info('Webhook message received', { phone: from, distributor: dist.name, text });
        await handleMessage(from, text, profileName);
        return NextResponse.json({ status: 'ok' });
      }

      const carbonFarmer = await findCarbonFarmerByPhone(from);
      if (carbonFarmer) {
        logger.info('Webhook feed-check reply received', { phone: from, farmerCustomId: carbonFarmer.farmerCustomId, buttonId, text });
        await handleFeedCheckReply(carbonFarmer, from, buttonId);
        return NextResponse.json({ status: 'ok' });
      }

      logger.info('Webhook message from unrecognised sender ignored', { phone: from });
      return NextResponse.json({ status: 'ok' });
    }
  } catch (err) {
    logger.error('Webhook POST error', { err: (err as Error).message });
  }

  return NextResponse.json({ status: 'ok' });
}
