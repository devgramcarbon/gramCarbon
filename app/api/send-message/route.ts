import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import axios from 'axios';
import { getUserFromRequest } from '@/lib/auth';
import { logAudit, getAuditContext } from '@/lib/audit';
import { notifyWhatsAppFailed } from '@/lib/notifications';
import { emitEvent, EVENTS } from '@/lib/socketEvents';
import { rateLimit } from '@/lib/rateLimiter';
import { unauthorized } from '@/lib/apiResponse';

interface SendMessageBody {
  phone?: string;
  mode?: string;
  message?: string;
  mediaId?: string;
  filename?: string;
  linkLabel?: string;
  linkUrl?: string;
  buttons?: string[];
  listBtn?: string;
  listItems?: string[];
  pollOptions?: string[];
  pollMultiple?: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  const rl = rateLimit(`msg:${user.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: SendMessageBody = {};
  try {
    body = await request.json() as SendMessageBody;
    const { phone, mode, message, mediaId, filename, linkLabel, linkUrl, buttons, listBtn, listItems, pollOptions, pollMultiple } = body;

    if (!phone) return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    if (!message?.trim()) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });

    const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };

    let payload: Record<string, unknown>;

    if (mode === 'text') {
      if (mediaId) {
        payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'document',
          document: { id: mediaId, filename: filename || 'document.pdf', ...(message.trim() ? { caption: message.trim() } : {}) },
        };
      } else {
        payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message.trim() } };
      }
    } else if (mode === 'yesno') {
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.trim() },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'yes_reply', title: 'Yes' } },
              { type: 'reply', reply: { id: 'no_reply', title: 'No' } },
            ],
          },
        },
      };
    } else if (mode === 'link') {
      if (!linkUrl?.trim()) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: message.trim() },
          action: {
            name: 'cta_url',
            parameters: { display_text: linkLabel?.trim() || 'Click Now', url: linkUrl.trim() },
          },
        },
      };
    } else if (mode === 'buttons') {
      const validBtns = (buttons || []).filter((b) => b?.trim());
      if (validBtns.length < 1) return NextResponse.json({ error: 'At least one button is required.' }, { status: 400 });
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.trim() },
          action: {
            buttons: validBtns.slice(0, 3).map((b, i) => ({
              type: 'reply',
              reply: { id: `btn_${i}`, title: b.trim().slice(0, 20) },
            })),
          },
        },
      };
    } else if (mode === 'list') {
      const validItems = (listItems || []).filter((i) => i?.trim());
      if (validItems.length < 1) return NextResponse.json({ error: 'At least one list item is required.' }, { status: 400 });
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: message.trim() },
          action: {
            button: (listBtn?.trim() || 'Choose').slice(0, 20),
            sections: [{
              title: 'Options',
              rows: validItems.slice(0, 10).map((item, i) => ({
                id: `item_${i}`,
                title: item.trim().slice(0, 24),
              })),
            }],
          },
        },
      };
    } else if (mode === 'poll') {
      const validOptions = (pollOptions || []).filter((o) => o?.trim());
      if (validOptions.length < 2) return NextResponse.json({ error: 'At least 2 poll options are required.' }, { status: 400 });
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'poll',
          body: { text: message.trim() },
          action: {
            poll_type: pollMultiple ? 'multiple' : 'single',
            options: validOptions.slice(0, 12).map((o, i) => ({ id: String(i), title: o.trim().slice(0, 24) })),
          },
        },
      };
    } else {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    await axios.post(url, payload, { headers });

    const ctx = getAuditContext(request, user);
    await logAudit({ ...ctx, action: 'MESSAGE_SENT', entity: 'Message', metadata: { phone, mode } });
    emitEvent(EVENTS.MESSAGE_SENT, { phone, mode });

    return NextResponse.json({ success: true });
  } catch (err) {
    const errMsg = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message || (err as Error)?.message || 'Failed to send message.';
    await notifyWhatsAppFailed(body?.phone || 'unknown', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
