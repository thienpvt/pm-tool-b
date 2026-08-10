import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serverError } from '@/lib/log';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: 'NO_RESEND_KEY' }, { status: 503 });

  const body = await req.json();
  const { to, subject, htmlBody, textBody } = body as {
    to: string[];
    subject: string;
    htmlBody: string;
    textBody?: string;
  };

  if (!to?.length || !subject || !htmlBody) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const from = process.env.MAIL_FROM ?? 'PMO Reports <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html: htmlBody, text: textBody ?? '' }),
    });

    const data = await res.json() as { id?: string; message?: string; name?: string };

    if (!res.ok) {
      return NextResponse.json({ error: data.message ?? data.name ?? 'Resend API error' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, messageId: data.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Send failed';
    return serverError(req, e, { error: msg }, 502);
  }
}
