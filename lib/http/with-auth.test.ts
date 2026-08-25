import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));

import { withAuth } from './with-auth';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const ownerSession = {
  id: 2,
  username: 'ava',
  display_name: 'Ava',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['pm'],
  status: 'active',
  email: 'ava@example.com',
};

const expectedActor = {
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  company_id: 5,
  is_admin: 0,
  roles: ['pm'],
  status: 'active',
  email: 'ava@example.com',
};

function req(method: string, url = 'http://localhost/api/x', body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

function rawCtx(params: Record<string, string> = { id: '7' }) {
  return { params: Promise.resolve(params) };
}

describe('withAuth', () => {
  it('returns 401 with no session and never calls the handler', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes user, actor, params, and body to the handler on a valid session', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const res = await wrapped(req('POST', 'http://localhost/api/x', { a: 1 }), rawCtx());

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const [, ctx] = handler.mock.calls[0];
    expect(ctx.user).toEqual(ownerSession);
    expect(ctx.actor).toEqual(expectedActor);
    expect(ctx.params).toEqual({ id: '7' });
    expect(ctx.body).toEqual({ a: 1 });
  });

  it('does not attempt to parse a body for a GET request', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    await wrapped(req('GET'), rawCtx());

    const [, ctx] = handler.mock.calls[0];
    expect(ctx.body).toBeUndefined();
  });

  it('returns 400 { error: "Invalid JSON" } on malformed body for POST/PUT/PATCH (WR-05/HYG-02)', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const badReq = new NextRequest('http://localhost/api/x', {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await wrapped(badReq, rawCtx());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('maps a thrown UnknownColumnError to 400 naming the columns, never 500/403 (T-04-25)', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockRejectedValue(new UnknownColumnError(['company_id']));
    const wrapped = withAuth(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Unknown column(s): company_id',
      columns: ['company_id'],
    });
  });

  it.each([
    [new ForbiddenError(), 403, { error: 'Forbidden' }],
    [new NotFoundError(), 404, { error: 'Not found' }],
    [new ValidationError('bad field', 'field'), 400, { error: 'bad field', field: 'field' }],
    [new ConflictError('dup'), 409, { error: 'dup' }],
  ])('maps thrown %o to the serviceErrorResponse shape', async (error, status, body) => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = withAuth(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual(body);
  });

  it('rawBody: true skips the auto req.json() and hands the handler body: undefined on POST', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler, { rawBody: true });

    const res = await wrapped(req('POST', 'http://localhost/api/x', { a: 1 }), rawCtx());

    expect(res.status).toBe(200);
    const [, ctx] = handler.mock.calls[0];
    expect(ctx.body).toBeUndefined();
  });

  it('rawBody: true lets a non-JSON POST body reach the handler (no 400)', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler, { rawBody: true });

    const badReq = new NextRequest('http://localhost/api/x', {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await wrapped(badReq, rawCtx());

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('without rawBody, malformed JSON still returns 400 Invalid JSON (WR-05 unchanged)', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const badReq = new NextRequest('http://localhost/api/x', {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await wrapped(badReq, rawCtx());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rawBody has no effect when a schema is set — schema path still parses', async () => {
    const { z } = await import('zod');
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler, { rawBody: true, schema: z.object({ a: z.number() }) });

    const res = await wrapped(req('POST', 'http://localhost/api/x', { a: 1 }), rawCtx());

    expect(res.status).toBe(200);
    const [, ctx] = handler.mock.calls[0];
    expect(ctx.body).toEqual({ a: 1 });
  });

  it('maps a generic Error to a 500 with a generic message, never String(e)', async () => {
    const secret = 'SQLSTATE detail: relation "secrets" does not exist';
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const handler = vi.fn().mockRejectedValue(new Error(secret));
    const wrapped = withAuth(handler);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await wrapped(req('GET'), rawCtx());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain(secret);
    logged.mockRestore();
  });

  describe('ACCESS_ENFORCEMENT shadow flag', () => {
    afterEach(() => {
      delete process.env.ACCESS_ENFORCEMENT;
    });

    it('shadow ON + ForbiddenError: logs a structured line and allows the request through', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new ForbiddenError())
        .mockResolvedValueOnce(NextResponse.json({ ok: true }));
      const wrapped = withAuth(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(
        '[ACCESS-SHADOW]',
        expect.stringContaining('"errorKind":"ForbiddenError"'),
      );
      spy.mockRestore();
    });

    it('shadow ON + NotFoundError: logs a structured line and allows the request through', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi
        .fn()
        .mockRejectedValueOnce(new NotFoundError())
        .mockResolvedValueOnce(NextResponse.json({ ok: true }));
      const wrapped = withAuth(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(
        '[ACCESS-SHADOW]',
        expect.stringContaining('"errorKind":"NotFoundError"'),
      );
      spy.mockRestore();
    });

    it('shadow OFF (unset): ForbiddenError still 403s, no shadow log, handler called once', async () => {
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new ForbiddenError());
      const wrapped = withAuth(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(403);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(spy).not.toHaveBeenCalledWith(
        '[ACCESS-SHADOW]',
        expect.anything(),
      );
      spy.mockRestore();
    });

    it('shadow ON + UnknownColumnError: still 400, never allowed through', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const handler = vi.fn().mockRejectedValue(new UnknownColumnError(['company_id']));
      const wrapped = withAuth(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(400);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('shadow ON + arbitrary Error: still 500, never allowed through', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      const wrapped = withAuth(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(500);
      expect(handler).toHaveBeenCalledTimes(1);
      logged.mockRestore();
    });

    it('reads ACCESS_ENFORCEMENT per-request, not hoisted at module load', async () => {
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new ForbiddenError());
      const wrapped = withAuth(handler);

      const off = await wrapped(req('GET'), rawCtx());
      expect(off.status).toBe(403);

      process.env.ACCESS_ENFORCEMENT = 'shadow';
      handler.mockReset();
      handler
        .mockRejectedValueOnce(new ForbiddenError())
        .mockResolvedValueOnce(NextResponse.json({ ok: true }));
      const on = await wrapped(req('GET'), rawCtx());
      expect(on.status).toBe(200);

      spy.mockRestore();
    });
  });
});
