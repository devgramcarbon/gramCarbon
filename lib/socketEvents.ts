import type { Server as SocketIOServer } from 'socket.io';

const g = global as typeof global & { __gramcarbonIO?: SocketIOServer };

export function setIO(io: SocketIOServer): void {
  g.__gramcarbonIO = io;
}

export function emitEvent(event: string, data: Record<string, unknown>): void {
  if (g.__gramcarbonIO) {
    g.__gramcarbonIO.emit(event, { ...data, timestamp: new Date().toISOString() });
  }
}

export const EVENTS = {
  STOCK_UPDATED: 'stock_updated',
  SALE_RECORDED: 'sale_recorded',
  MESSAGE_SENT: 'message_sent',
  DASHBOARD_UPDATED: 'dashboard_updated',
  NOTIFICATION_CREATED: 'notification_created',
  LOG_CREATED: 'log_created',
} as const;
