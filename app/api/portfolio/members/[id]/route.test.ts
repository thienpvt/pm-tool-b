import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updatePortfolioMember, deletePortfolioMember } = vi.hoisted(() => ({
  updatePortfolioMember: vi.fn(),
  deletePortfolioMember: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/portfolio.repo', () => ({
  updatePortfolioMember,
  deletePortfolioMember,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE, PUT } from './route';

const foreign = {
  id: 2, username: 'bob', display_name: 'Bob', company_id: 9, company_name: 'Other',
  is_admin: 0, onboarding_completed: 1,
  roles: ['cpmo'], status: 'active', email: 'bob@example.com',
};

describe('PUT/DELETE /api/portfolio/members/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  const params = () => ({ params: Promise.resolve({ id: '1' }) });

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/portfolio/members/1', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('PUT returns 404 (never the foreign row) for a cross-company member id', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    updatePortfolioMember.mockResolvedValue(undefined);

    const res = await PUT(req('PUT', { name: 'Someone Else' }), params());

    expect(res.status).toBe(404);
    expect(updatePortfolioMember).toHaveBeenCalledWith(9, '1', expect.objectContaining({ name: 'Someone Else' }));
  });

  it('DELETE scopes by the caller company (no cross-tenant row deleted)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    deletePortfolioMember.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    expect(deletePortfolioMember).toHaveBeenCalledWith(9, '1');
  });
});
