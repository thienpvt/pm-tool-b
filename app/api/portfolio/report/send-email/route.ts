import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveResendCredentials } from '@/lib/integrations/credentials';
import { sendEmail } from '@/lib/integrations/resend/client';
import { isCpmo, toAccessActor } from '@/lib/services/access';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const actor = toAccessActor(user);
  if (!isCpmo(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const creds = await resolveResendCredentials();
  if (!creds) return NextResponse.json({ error: 'NO_RESEND_KEY' }, { status: 503 });

  // WR-05: reject a malformed/oversized body with a JSON 400 instead of letting
  // req.json() reject the handler and surface a bare 500.
  let body: { to: string[]; subject: string; htmlBody: string; textBody?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { to, subject, htmlBody, textBody } = body;

  if (!to?.length || !subject || !htmlBody) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 });
  }

  const from = process.env.MAIL_FROM ?? 'PMO Reports <onboarding@resend.dev>';

  try {
    const id = await sendEmail(creds, { from, to, subject, html: htmlBody, text: textBody });
    return NextResponse.json({ ok: true, messageId: id });
  } catch (e: unknown) {
    return integrationErrorResponse(e);
  }
}
