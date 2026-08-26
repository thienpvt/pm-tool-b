import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listFinancialBenefitsRepo,
  listNonfinancialBenefitsRepo,
  insertFinancialBenefitRepo,
  getFinancialBenefitInProjectRepo,
  updateFinancialBenefitRepo,
  getNonfinancialBenefitInProjectRepo,
  updateNonfinancialBenefitRepo,
  insertNonfinancialBenefitRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listFinancialBenefitsRepo: vi.fn(),
  listNonfinancialBenefitsRepo: vi.fn(),
  insertFinancialBenefitRepo: vi.fn(),
  getFinancialBenefitInProjectRepo: vi.fn(),
  updateFinancialBenefitRepo: vi.fn(),
  getNonfinancialBenefitInProjectRepo: vi.fn(),
  updateNonfinancialBenefitRepo: vi.fn(),
  insertNonfinancialBenefitRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/financial-benefits.repo', () => ({
  listFinancialBenefits: listFinancialBenefitsRepo,
  insertFinancialBenefit: insertFinancialBenefitRepo,
  getFinancialBenefitInProject: getFinancialBenefitInProjectRepo,
  updateFinancialBenefit: updateFinancialBenefitRepo,
}));
vi.mock('@/lib/repositories/nonfinancial-benefits.repo', () => ({
  listNonfinancialBenefits: listNonfinancialBenefitsRepo,
  insertNonfinancialBenefit: insertNonfinancialBenefitRepo,
  getNonfinancialBenefitInProject: getNonfinancialBenefitInProjectRepo,
  updateNonfinancialBenefit: updateNonfinancialBenefitRepo,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';
import { ConflictError } from '@/lib/services/errors';

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

const cpmoSession = {
  ...ownerSession,
  username: 'cpmo',
  roles: ['cpmo'],
};

const viewerSession = {
  ...ownerSession,
  username: 'viewer',
  roles: ['viewer'],
};

describe('/api/projects/[id]/benefits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    listFinancialBenefitsRepo.mockResolvedValue([]);
    listNonfinancialBenefitsRepo.mockResolvedValue([]);
    auditLogFn.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: '7' }) };

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/benefits', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('returns 401 when session is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(401);
  });

  it('GET returns 200 with financial and nonfinancial arrays', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listFinancialBenefitsRepo.mockResolvedValue([
      {
        id: 1,
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: '500000',
        actual_vnd: null,
      },
    ]);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.financial).toHaveLength(1);
    expect(body.financial[0].actual_vnd).toBeNull();
    expect(body.nonfinancial).toEqual([]);
  });

  it('POST kind financial as write-access actor returns 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    insertFinancialBenefitRepo.mockResolvedValue({
      id: 3,
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: '500000',
      actual_vnd: null,
    });
    const res = await POST(
      req('POST', {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 500_000,
      }),
      params,
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ id: 3, actual_vnd: null });
  });

  it('POST duplicate financial benefit returns 409', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    insertFinancialBenefitRepo.mockRejectedValue(new ConflictError('Duplicate benefit'));
    const res = await POST(
      req('POST', {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 100,
      }),
      params,
    );
    expect(res.status).toBe(409);
  });

  it('POST as viewer-only returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(
      req('POST', {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 100,
      }),
      params,
    );
    expect(res.status).toBe(403);
  });
});
