import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, createRiskRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  createRiskRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: vi.fn(),
  createRisk: createRiskRepo,
  updateRisk: vi.fn(),
  deleteRisk: vi.fn(),
  countRisks: vi.fn(),
  listOpenRisks: vi.fn(),
  listNotClosedByPriority: vi.fn(),
  RISK_COLUMNS: [],
}));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

/**
 * Route-level proof that Viewer-only actors receive 403 on mutating risks,
 * with real assertProjectAccess + assertCanMutate (repo boundary mocked).
 */
describe('POST /api/projects/[id]/risks access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/risks', {
      method: 'POST',
      body: JSON.stringify(body ?? { description: 'New risk' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const viewerSession = {
    id: 2,
    username: 'view',
    display_name: 'Viewer',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    roles: ['viewer'],
    status: 'active',
    email: 'view@example.com',
  };

  it('returns 403 Forbidden for a viewer-only in-company actor on POST', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(createRiskRepo).not.toHaveBeenCalled();
  });
});
