import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import cron from 'node-cron';
import axios from 'axios';
import { setIO } from './lib/socketEvents';
import logger from './lib/logger';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url ?? '/', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error('Error handling request', { error: err instanceof Error ? err.message : String(err) });
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
  });

  setIO(io);

  io.on('connection', (socket) => {
    logger.info('Socket.IO client connected', { socketId: socket.id });

    socket.on('join_room', (room: string) => socket.join(room));
    socket.on('leave_room', (room: string) => socket.leave(room));

    socket.on('disconnect', () => {
      logger.info('Socket.IO client disconnected', { socketId: socket.id });
    });
  });

  // Clean up expired bot sessions every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { default: BotSession } = await import('./lib/models/BotSession');
      await dbConnect();
      const result = await BotSession.deleteMany({ expiresAt: { $lt: new Date() } });
      if (result.deletedCount > 0) {
        logger.info(`Cron: cleaned ${result.deletedCount} expired bot sessions`);
      }
    } catch (err) {
      logger.error('Cron: bot session cleanup failed', { error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Daily WhatsApp message to all distributors at 2:50 PM IST
  cron.schedule('50 14 * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { default: Distributor } = await import('./lib/models/Distributor');
      await dbConnect();

      const distributors = await Distributor.find({}, 'phone name').lean();
      const allRecipients = [{ phone: '917907247909', name: 'Admin' }, ...distributors];

      const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
      const headers = {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      };
      const messageText = "Reminder: Please confirm today's stock receipt and update your delivery status. — gramCarbon Team";

      let sent = 0;
      let failed = 0;
      for (const dist of allRecipients) {
        try {
          await axios.post(url, {
            messaging_product: 'whatsapp',
            to: dist.phone,
            type: 'text',
            text: { body: messageText },
          }, { headers });
          sent++;
        } catch (err) {
          failed++;
          logger.error('Cron: failed to send daily WP message', {
            phone: dist.phone,
            name: dist.name,
            error: (err as { response?: { data?: unknown } })?.response?.data || (err as Error)?.message,
          });
        }
      }
      logger.info(`Cron: daily WhatsApp message — sent: ${sent}, failed: ${failed}`);
    } catch (err) {
      logger.error('Cron: daily distributor WhatsApp blast failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, { timezone: 'Asia/Kolkata' });

  // Carbon check-in: dashboard-configurable daily WhatsApp "have you fed the cow" prompt.
  // Ticks every minute since the send time (carbon.checkinTime) is admin-editable at runtime.
  cron.schedule('* * * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { default: Settings } = await import('./lib/models/Settings');
      const { default: CarbonFarmer } = await import('./lib/models/CarbonFarmer');
      const { default: Cattle } = await import('./lib/models/Cattle');
      const { default: BotSession } = await import('./lib/models/BotSession');
      const { sendWhatsAppButtons } = await import('./lib/whatsapp');
      await dbConnect();

      const [enabledSetting, timeSetting, siteSetting, lastRunSetting] = await Promise.all([
        Settings.findOne({ key: 'carbon.checkinEnabled' }).lean<{ value?: unknown }>(),
        Settings.findOne({ key: 'carbon.checkinTime' }).lean<{ value?: unknown }>(),
        Settings.findOne({ key: 'carbon.checkinProgramSite' }).lean<{ value?: unknown }>(),
        Settings.findOne({ key: 'carbon.checkinLastRunDate' }).lean<{ value?: unknown }>(),
      ]);

      const enabled = enabledSetting?.value === undefined ? true : enabledSetting.value === 'true' || enabledSetting.value === true;
      if (!enabled) return;

      const checkinTime = (timeSetting?.value as string) || '18:00';
      const programSite = (siteSetting?.value as string) || 'NAINARPALAYAM';

      const nowIst = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const [datePart, timePart] = nowIst.split(', ');
      const currentHHmm = timePart.slice(0, 5);
      const todayKey = datePart.split('/').reverse().join('-'); // dd/mm/yyyy -> yyyy-mm-dd

      if (currentHHmm !== checkinTime) return;
      if (lastRunSetting?.value === todayKey) return; // already ran today

      const farmers = await CarbonFarmer.find({ isActive: true, programSite, mobile: { $exists: true, $ne: '' } }).lean<Array<{ _id: unknown; name: string; mobile: string }>>();

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const farmer of farmers) {
        const activeCattleCount = await Cattle.countDocuments({ farmer: farmer._id, isActive: true });
        if (activeCattleCount === 0) { skipped++; continue; }

        try {
          await sendWhatsAppButtons(farmer.mobile, `Hi ${farmer.name}, have you fed the cow(s) today?`, [
            { id: `feed_yes_${farmer._id}`, title: 'Yes' },
            { id: `feed_no_${farmer._id}`, title: 'No' },
          ]);
          await BotSession.findOneAndUpdate(
            { phoneNumber: farmer.mobile },
            { $set: { 'temporaryData.awaitingFeedCheck': { farmerId: String(farmer._id), date: todayKey } } },
            { upsert: true }
          );
          sent++;
        } catch (err) {
          failed++;
          logger.error('Cron: failed to send carbon check-in message', {
            phone: farmer.mobile,
            error: (err as { response?: { data?: unknown } })?.response?.data || (err as Error)?.message,
          });
        }
      }

      await Settings.findOneAndUpdate(
        { key: 'carbon.checkinLastRunDate' },
        { $set: { key: 'carbon.checkinLastRunDate', value: todayKey, category: 'carbon' } },
        { upsert: true }
      );

      logger.info(`Cron: carbon check-in — sent: ${sent}, skipped (no cattle): ${skipped}, failed: ${failed}`);
    } catch (err) {
      logger.error('Cron: carbon check-in failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, { timezone: 'Asia/Kolkata' });

  // Daily report notification at 8 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { createNotification } = await import('./lib/notifications');
      const { default: Sale } = await import('./lib/models/Sale');
      await dbConnect();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      const sales = await Sale.find({ saleDate: { $gte: yesterday, $lt: today } });
      const totalKg = sales.reduce((s, sale) => s + sale.qtyKg, 0);

      await createNotification({
        type: 'INFO',
        title: 'Daily Summary',
        message: `Yesterday: ${sales.length} sales recorded, ${totalKg}kg distributed.`,
      });
    } catch (err) {
      logger.error('Cron: daily report failed', { error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ZE Production status poll: dashboard-configurable daily time (poWorkflow.statusPollTime).
  // Ticks every minute since the send time is admin-editable at runtime (same technique as the carbon check-in job).
  cron.schedule('* * * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { default: Settings } = await import('./lib/models/Settings');
      const { default: PurchaseOrder } = await import('./lib/models/PurchaseOrder');
      const { pollZeProdStatus } = await import('./lib/poWorkflow');
      await dbConnect();

      const [timeSetting, lastRunSetting] = await Promise.all([
        Settings.findOne({ key: 'poWorkflow.statusPollTime' }).lean<{ value?: unknown }>(),
        Settings.findOne({ key: 'poWorkflow.statusPollLastRunDate' }).lean<{ value?: unknown }>(),
      ]);

      const pollTime = (timeSetting?.value as string) || '17:00';

      const nowIst = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const [datePart, timePart] = nowIst.split(', ');
      const currentHHmm = timePart.slice(0, 5);
      const todayKey = datePart.split('/').reverse().join('-'); // dd/mm/yyyy -> yyyy-mm-dd

      if (currentHHmm !== pollTime) return;
      if (lastRunSetting?.value === todayKey) return; // already ran today

      const orders = await PurchaseOrder.find({
        status: { $in: ['PRODUCTION_STARTED', 'PRODUCTION_IN_PROGRESS'] },
      });

      let sent = 0;
      for (const order of orders) {
        try {
          await pollZeProdStatus(order);
          sent++;
        } catch (err) {
          logger.error('Cron: ZE production status poll failed', {
            poNumber: order.poNumber,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await Settings.findOneAndUpdate(
        { key: 'poWorkflow.statusPollLastRunDate' },
        { $set: { key: 'poWorkflow.statusPollLastRunDate', value: todayKey, category: 'milky_mist' } },
        { upsert: true }
      );

      logger.info(`Cron: ZE production status poll — sent: ${sent}`);
    } catch (err) {
      logger.error('Cron: ZE production status poll job failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, { timezone: 'Asia/Kolkata' });

  // Daily QAQC / weighbridge readiness poll at 10 AM IST
  cron.schedule('0 10 * * *', async () => {
    try {
      const { default: dbConnect } = await import('./lib/mongodb');
      const { default: PurchaseOrder } = await import('./lib/models/PurchaseOrder');
      const { pollQaqcReady, pollWeighBridgeReady } = await import('./lib/poWorkflow');
      await dbConnect();

      const [qaqcPending, weighBridgePending] = await Promise.all([
        PurchaseOrder.find({ status: 'QAQC_REQUESTED' }),
        PurchaseOrder.find({ status: 'WEIGHT_REQUESTED' }),
      ]);

      let sent = 0;
      for (const order of qaqcPending) {
        try {
          await pollQaqcReady(order);
          sent++;
        } catch (err) {
          logger.error('Cron: QAQC readiness poll failed', { poNumber: order.poNumber, error: err instanceof Error ? err.message : String(err) });
        }
      }
      for (const order of weighBridgePending) {
        try {
          await pollWeighBridgeReady(order);
          sent++;
        } catch (err) {
          logger.error('Cron: weighbridge readiness poll failed', { poNumber: order.poNumber, error: err instanceof Error ? err.message : String(err) });
        }
      }
      logger.info(`Cron: QAQC/weighbridge readiness poll — sent: ${sent}`);
    } catch (err) {
      logger.error('Cron: QAQC/weighbridge readiness poll job failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, { timezone: 'Asia/Kolkata' });

  httpServer.listen(port, hostname, () => {
    logger.info(`gramCarbon ready at http://${hostname}:${port}`);
    logger.info('Socket.IO listening on /api/socket');
  });
});
