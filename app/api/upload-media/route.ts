import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const waForm = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    waForm.append('file', blob, file.name);
    waForm.append('type', file.type);
    waForm.append('messaging_product', 'whatsapp');

    const res = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ACCESS_TOKEN}` },
        body: waForm,
      }
    );

    const data = await res.json() as { id?: string; error?: { message?: string } };

    if (!res.ok) {
      const msg = data?.error?.message || 'Media upload failed.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ mediaId: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed.' }, { status: 500 });
  }
}
