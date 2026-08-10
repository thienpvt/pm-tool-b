import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

import { sendEmail } from './client';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const baseParams = {
  from: 'PMO Reports <onboarding@resend.dev>',
  to: ['a@b.com'],
  subject: 'Weekly report',
  html: '<b>hi</b>',
  text: 'hi',
};

describe('resend client', () => {
  it('sends an email and returns the message id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'msg_123' }));

    await expect(sendEmail({ apiKey: 'rk_live_x' }, baseParams)).resolves.toBe('msg_123');
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer rk_live_x' }),
      body: JSON.stringify({
        from: baseParams.from,
        to: baseParams.to,
        subject: baseParams.subject,
        html: baseParams.html,
        text: baseParams.text,
      }),
    }));
  });

  it('throws IntegrationError kind upstream with the upstream status on 4xx', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'missing from' }));

    await expect(sendEmail({ apiKey: 'rk' }, baseParams))
      .rejects.toMatchObject({ kind: 'upstream', service: 'resend', status: 400 });
  });

  it('carries the parsed body as cause for message/name extraction', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { name: 'rate_limit' }));

    await expect(sendEmail({ apiKey: 'rk' }, baseParams)).rejects.toMatchObject({
      kind: 'upstream',
      service: 'resend',
      status: 502,
      cause: { name: 'rate_limit' },
    });
  });

  it('throws kind validation on a malformed 2xx response (INTG-10)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));

    await expect(sendEmail({ apiKey: 'rk' }, baseParams))
      .rejects.toMatchObject({ kind: 'validation', service: 'resend' });
  });

  it('throws kind network when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(sendEmail({ apiKey: 'rk' }, baseParams))
      .rejects.toMatchObject({ kind: 'network', service: 'resend' });
  });

  it('throws kind timeout when the request hangs past 15s', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    // Attach the rejection handler BEFORE advancing timers: the abort fires
    // inside advanceTimersByTimeAsync, so asserting afterwards leaves the
    // rejection momentarily unhandled and vitest exits non-zero.
    const assertion = expect(sendEmail({ apiKey: 'rk' }, baseParams))
      .rejects.toMatchObject({ kind: 'timeout', service: 'resend' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
