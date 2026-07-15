import axios from 'axios';
import logger from './logger';

export async function sendWhatsAppText(phone: string, message: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } };

  try {
    await axios.post(url, payload, { headers });
  } catch (err) {
    const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
    logger.error('WhatsApp send failed', { phone, error: axiosErr?.response?.data?.error?.message || (err as Error)?.message });
    throw err;
  }
}
