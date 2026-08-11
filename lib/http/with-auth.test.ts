import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(ctx.actor).toEqual({ company_id: 5, is_admin: 0 });
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
});
