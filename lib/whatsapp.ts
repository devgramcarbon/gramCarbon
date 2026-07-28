import axios from 'axios';
import logger from './logger';
import { withRetry } from './retry';

// 4xx errors (bad number, invalid template, auth) won't succeed on retry — only
// network failures and 5xx/429s from Meta are worth retrying.
function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return true; // network/timeout errors — retry
  const status = err.response?.status;
  if (!status) return true; // no response received — network-level failure
  return status === 429 || status >= 500;
}

async function postWithRetry(url: string, payload: unknown, headers: Record<string, string>, label: string): Promise<void> {
  try {
    await withRetry(() => axios.post(url, payload, { headers }), { retries: 3, delayMs: 800, label, shouldRetry: isRetryable });
  } catch (err) {
    const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
    logger.error(`${label} send failed`, { error: axiosErr?.response?.data?.error?.message || (err as Error)?.message });
    throw err;
  }
}

export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  };

  await postWithRetry(url, payload, headers, `WhatsApp buttons (${to})`);
}

export async function sendWhatsAppText(phone: string, message: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } };

  await postWithRetry(url, payload, headers, `WhatsApp text (${phone})`);
}
