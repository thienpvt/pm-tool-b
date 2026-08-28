import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { programFteAllocations, upsertPortfolioProgramAllocation } = vi.hoisted(() => ({
  programFteAllocations: vi.fn(),
  upsertPortfolioProgramAllocation: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/portfolio/backend/repositories/portfolio.repo', () => ({
  programFteAllocations,
  upsertPortfolioProgramAllocation,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * T-04-27 / HYG-02 proof: a server error on the upsert must surface as the
 * generic serviceErrorResponse 500, never the pre-fix `{ error: String(e) }`
 * leak (which exposed raw error text, e.g. SQL constraint messages).
 */
describe('POST /api/portfolio/program-allocations', () => {
  beforeEach(() => vi.clearAllMocks());

  const session = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
    roles: ['cpmo'], status: 'active', email: 'ava@example.com',
  };

  const params = () => ({ params: Promise.resolve({}) });

  function post(body: unknown) {
    return new NextRequest('http://localhost/api/portfolio/program-allocations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns 401 without a session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(post({ program_id: 1, allocated_headcount: 3 }), params());
    expect(res.status).toBe(401);
    expect(upsertPortfolioProgramAllocation).not.toHaveBeenCalled();
  });

  it('returns 400 when program_id is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    const res = await POST(post({ allocated_headcount: 3 }), params());
    expect(res.status).toBe(400);
    expect(upsertPortfolioProgramAllocation).not.toHaveBeenCalled();
  });

  it('returns 200 with the upserted allocation on success', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    upsertPortfolioProgramAllocation.mockResolvedValue(undefined);
    const res = await POST(post({ program_id: 7, allocated_headcount: 3 }), params());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ program_id: 7, allocated_headcount: 3 });
  });

  it('returns a generic 500 body on a server error, never String(e) (HYG-02)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    upsertPortfolioProgramAllocation.mockRejectedValue(
      new Error('duplicate key value violates unique constraint "portfolio_program_allocations_company_id_program_id_key"'),
    );

    const res = await POST(post({ program_id: 7, allocated_headcount: 3 }), params());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('duplicate key');
    expect(JSON.stringify(body)).not.toContain('constraint');
  });
});

describe('GET /api/portfolio/program-allocations', () => {
  beforeEach(() => vi.clearAllMocks());

  const params = () => ({ params: Promise.resolve({}) });

  it('returns 401 without a session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/portfolio/program-allocations'), params());
    expect(res.status).toBe(401);
  });

  it('returns [] for a null-company actor without querying the repository', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      id: 1, username: 'x', display_name: 'X', company_id: null, company_name: null,
      is_admin: 0, onboarding_completed: 1,
    } as never);
    const res = await GET(new NextRequest('http://localhost/api/portfolio/program-allocations'), params());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
    expect(programFteAllocations).not.toHaveBeenCalled();
  });
});
