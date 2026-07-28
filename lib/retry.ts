import logger from './logger';

interface RetryOptions {
  retries?: number;
  delayMs?: number;
  label?: string;
  /** Return false to stop retrying immediately (e.g. a 4xx that will never succeed). Defaults to always retryable. */
  shouldRetry?: (err: unknown) => boolean;
}

/** Retries an async operation with exponential backoff. Throws the last error if all attempts fail. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.delayMs ?? 500;
  const shouldRetry = opts.shouldRetry ?? (() => true);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err)) break;
      if (attempt < retries) {
        const delay = baseDelay * 2 ** (attempt - 1);
        logger.warn(`Retry ${attempt}/${retries} failed${opts.label ? ` for ${opts.label}` : ''}, retrying in ${delay}ms`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastErr;
}
