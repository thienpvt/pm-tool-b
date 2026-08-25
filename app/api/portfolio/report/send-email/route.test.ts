import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/lib/integrations/errors';

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveResendCredentials: vi.fn() }));
vi.mock('@/lib/integrations/resend/client', () => ({ sendEmail: vi.fn() }));

import { getSessionFromRequest } from '@/lib/auth';
import { resolveResendCredentials } from '@/lib/integrations/credentials';
import { sendEmail } from '@/lib/integrations/resend/client';
import { POST } from './route';

const session = {
  id: 7,
  username: 'pm1',
  display_name: 'PM One',
  company_id: 3,
  company_name: 'Acme',
  is_admin: 0,
  roles: ['cpmo'],
  status: 'active',
  email: 'cpmo@example.com',
};

function post(body: unknown) {
  return new NextRequest('http://localhost/api/portfolio/report/send-email', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  to: ['a@b.com'],
  subject: 'Weekly report',
  htmlBody: '<b>hi</b>',
  textBody: 'hi',
};

beforeEach(() => {
  vi.mocked(getSessionFromRequest).mockReset();
  vi.mocked(resolveResendCredentials).mockReset();
  vi.mocked(sendEmail).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/portfolio/report/send-email', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await POST(post(validBody));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(resolveResendCredentials).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 503 NO_RESEND_KEY when the resolver returns null', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(resolveResendCredentials).mockResolvedValue(null);

    const res = await POST(post(validBody));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'NO_RESEND_KEY' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 400 MISSING_FIELDS when to/subject/htmlBody are missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(resolveResendCredentials).mockResolvedValue({ apiKey: 'rk' });

    const res = await POST(post({ to: [], subject: '', htmlBody: '' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'MISSING_FIELDS' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 200 ok true with the message id on success', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(resolveResendCredentials).mockResolvedValue({ apiKey: 'rk' });
    vi.mocked(sendEmail).mockResolvedValue('msg_123');

    const res = await POST(post(validBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, messageId: 'msg_123' });
    expect(sendEmail).toHaveBeenCalledWith(
      { apiKey: 'rk' },
      expect.objectContaining({
        from: 'PMO Reports <onboarding@resend.dev>',
        to: ['a@b.com'],
        subject: 'Weekly report',
        html: '<b>hi</b>',
        text: 'hi',
      }),
    );
  });

  it('maps an upstream failure to 502 with the upstream message', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(resolveResendCredentials).mockResolvedValue({ apiKey: 'rk' });
    vi.mocked(sendEmail).mockRejectedValue(
      new IntegrationError({ kind: 'upstream', service: 'resend', status: 400, cause: { message: 'missing from' } }),
    );

    const res = await POST(post(validBody));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'missing from' });
  });

  it('maps a validation failure to 502 with the fixed Resend API error string', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(resolveResendCredentials).mockResolvedValue({ apiKey: 'rk' });
    vi.mocked(sendEmail).mockRejectedValue(
      new IntegrationError({ kind: 'validation', service: 'resend' }),
    );

    const res = await POST(post(validBody));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'Resend API error' });
  });
});
