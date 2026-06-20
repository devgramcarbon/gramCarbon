import { createLogger, format, transports } from 'winston';
import Transport from 'winston-transport';
import type { MemoryLog } from '@/types';
import { emitEvent, EVENTS } from '@/lib/socketEvents';

const { combine, timestamp, errors, json, colorize, simple } = format;

const MAX_MEMORY_LOGS = 500;

// Use global to share logs across Next.js module boundaries (custom server vs API routes)
const g = global as typeof global & { __gramcarbonLogs?: MemoryLog[] };
if (!g.__gramcarbonLogs) g.__gramcarbonLogs = [];
const memoryLogs = g.__gramcarbonLogs;

class MemoryTransport extends Transport {
  log(info: MemoryLog & { [key: string]: unknown }, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));
    const SKIP = new Set(['level', 'message', 'timestamp', 'stack', 'service', 'splat']);
    const meta: Record<string, unknown> = {};
    for (const key of Object.keys(info)) {
      if (!SKIP.has(key)) meta[key] = info[key];
    }
    const entry: MemoryLog = {
      level: info.level,
      message: info.message,
      timestamp: info.timestamp as string | undefined,
      stack: info.stack as string | undefined,
      service: info.service as string | undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    };
    memoryLogs.push(entry);
    if (memoryLogs.length > MAX_MEMORY_LOGS) memoryLogs.shift();
    emitEvent(EVENTS.LOG_CREATED, entry as unknown as Record<string, unknown>);
    callback();
  }
}

interface GetMemoryLogsOptions {
  level?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function getMemoryLogs({ level, search, limit = 100, offset = 0 }: GetMemoryLogsOptions = {}): {
  logs: MemoryLog[];
  total: number;
} {
  let result = [...memoryLogs].reverse();
  if (level) result = result.filter((l) => l.level === level);
  if (search) result = result.filter((l) => l.message?.toLowerCase().includes(search.toLowerCase()));
  const total = result.length;
  return { logs: result.slice(offset, offset + limit), total };
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'gramcarbon' },
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? json()
          : combine(colorize(), simple()),
    }),
    new MemoryTransport(),
  ],
});

if (process.env.LOG_FILE) {
  logger.add(
    new transports.File({
      filename: process.env.LOG_FILE || 'logs/app.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

export default logger;
