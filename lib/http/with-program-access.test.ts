import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
}));
const { assertProgramAccess } = vi.hoisted(() => ({
  assertProgramAccess: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));
vi.mock('@/lib/services/programs.service', () => ({ assertProgramAccess }));

import { withProgramAccess } from './with-program-access';

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

function req(method: string, url = 'http://localhost/api/programs/7') {
  return new NextRequest(url, { method });
}

function rawCtx(id = '7') {
  return { params: Promise.resolve({ id }) };
}

describe('withProgramAccess', () => {
  it('hands the resolved program row to the handler alongside actor/params', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const programRow = { id: 7, company_id: 5 };
    assertProgramAccess.mockResolvedValue(programRow);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withProgramAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(200);
    expect(assertProgramAccess).toHaveBeenCalledWith('7', { company_id: 5, is_admin: 0 });
    const [, ctx] = handler.mock.calls[0];
    expect(ctx.program).toEqual(programRow);
    expect(ctx.actor).toEqual({ company_id: 5, is_admin: 0 });
    expect(ctx.params).toEqual({ id: '7' });
  });

  it('returns 403 for a cross-company actor and never calls the handler', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const { ForbiddenError } = await import('@/lib/services/errors');
    assertProgramAccess.mockRejectedValue(new ForbiddenError());
    const handler = vi.fn();
    const wrapped = withProgramAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing program and never calls the handler', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const { NotFoundError } = await import('@/lib/services/errors');
    assertProgramAccess.mockRejectedValue(new NotFoundError());
    const handler = vi.fn();
    const wrapped = withProgramAccess(handler);

    const res = await wrapped(req('GET'), rawCtx('99'));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 with no session and never calls assertProgramAccess or the handler', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withProgramAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(401);
    expect(assertProgramAccess).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
