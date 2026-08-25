import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
}));
const { assertProjectAccess } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));
vi.mock('@/lib/services/access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/access')>();
  return { ...actual, assertProjectAccess };
});

import { withProjectAccess } from './with-project-access';

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

function req(method: string, url = 'http://localhost/api/projects/7/risks') {
  return new NextRequest(url, { method });
}

function rawCtx(id = '7') {
  return { params: Promise.resolve({ id }) };
}

describe('withProjectAccess', () => {
  it('hands the resolved project row to the handler alongside actor/params', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const projectRow = { company_id: 5, customer_company_id: null };
    assertProjectAccess.mockResolvedValue(projectRow);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withProjectAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(200);
    expect(assertProjectAccess).toHaveBeenCalledWith('7', expectedActor);
    const [, ctx] = handler.mock.calls[0];
    expect(ctx.project).toEqual(projectRow);
    expect(ctx.actor).toEqual(expectedActor);
    expect(ctx.params).toEqual({ id: '7' });
  });

  it('returns 403 for a cross-company actor and never calls the handler', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const { ForbiddenError } = await import('@/lib/services/errors');
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    const handler = vi.fn();
    const wrapped = withProjectAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing project and never calls the handler', async () => {
    getSessionFromRequest.mockResolvedValue(ownerSession);
    const { NotFoundError } = await import('@/lib/services/errors');
    assertProjectAccess.mockRejectedValue(new NotFoundError());
    const handler = vi.fn();
    const wrapped = withProjectAccess(handler);

    const res = await wrapped(req('GET'), rawCtx('99'));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 with no session and never calls assertProjectAccess or the handler', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withProjectAccess(handler);

    const res = await wrapped(req('GET'), rawCtx());

    expect(res.status).toBe(401);
    expect(assertProjectAccess).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  describe('ACCESS_ENFORCEMENT shadow flag', () => {
    afterEach(() => {
      delete process.env.ACCESS_ENFORCEMENT;
    });

    it('shadow ON: a cross-company deny still invokes the handler, with project undefined', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const { ForbiddenError } = await import('@/lib/services/errors');
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withProjectAccess(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      const [, ctx] = handler.mock.calls[0];
      expect(ctx.project).toBeUndefined();
      expect(assertProjectAccess).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        '[ACCESS-SHADOW]',
        expect.stringContaining('"errorKind":"ForbiddenError"'),
      );
      spy.mockRestore();
    });

    it('shadow OFF: a cross-company deny still 403s and never calls the handler', async () => {
      getSessionFromRequest.mockResolvedValue(ownerSession);
      const { ForbiddenError } = await import('@/lib/services/errors');
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      const handler = vi.fn();
      const wrapped = withProjectAccess(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('shadow ON: an unrelated handler error (post-assert) is NOT softened, still 500', async () => {
      process.env.ACCESS_ENFORCEMENT = 'shadow';
      getSessionFromRequest.mockResolvedValue(ownerSession);
      assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      const wrapped = withProjectAccess(handler);

      const res = await wrapped(req('GET'), rawCtx());

      expect(res.status).toBe(500);
      expect(handler).toHaveBeenCalledTimes(1);
      logged.mockRestore();
    });
  });
});
