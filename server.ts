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

  httpServer.listen(port, hostname, () => {
    logger.info(`gramCarbon ready at http://${hostname}:${port}`);
    logger.info('Socket.IO listening on /api/socket');
  });
});
