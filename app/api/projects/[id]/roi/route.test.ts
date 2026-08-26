import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listFiscalBudgetsRepo,
  sumAdjustmentsVndRepo,
  listFinancialBenefitsForYearRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listFiscalBudgetsRepo: vi.fn(),
  sumAdjustmentsVndRepo: vi.fn(),
  listFinancialBenefitsForYearRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/fiscal-budget.repo', () => ({
  listFiscalBudgets: listFiscalBudgetsRepo,
}));
vi.mock('@/lib/repositories/budget-adjustments.repo', () => ({
  sumAdjustmentsVnd: sumAdjustmentsVndRepo,
}));
vi.mock('@/lib/repositories/financial-benefits.repo', () => ({
  listFinancialBenefitsForYear: listFinancialBenefitsForYearRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

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

const viewerSession = {
  ...ownerSession,
  username: 'viewer',
  roles: ['viewer'],
};

describe('/api/projects/[id]/roi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    sumAdjustmentsVndRepo.mockResolvedValue(0);
    listFiscalBudgetsRepo.mockResolvedValue([
      { id: 1, fiscal_year: 2026, cost_type: 'CAPEX', approved_amount_vnd: '1000', actual_amount_vnd: '400' },
    ]);
    listFinancialBenefitsForYearRepo.mockResolvedValue([
      { expected_vnd: 1500, actual_vnd: 800 },
    ]);
  });

  const params = { params: Promise.resolve({ id: '7' }) };

  function req(fiscalYear?: string) {
    const qs = fiscalYear === undefined ? '' : `?fiscal_year=${fiscalYear}`;
    return new NextRequest(`http://localhost/api/projects/7/roi${qs}`, { method: 'GET' });
  }

  it('returns 401 when session is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await GET(req('2026'), params);
    expect(res.status).toBe(401);
  });

  it('returns 400 when fiscal_year is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const res = await GET(req(), params);
    expect(res.status).toBe(400);
  });

  it('GET as viewer with project access returns 200 ROI payload', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(req('2026'), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      fiscal_year: 2026,
      expected: { status: 'ok' },
      actual: { status: 'ok' },
    });
    expect(body.expected.percent).toBeTypeOf('number');
    expect(body.actual.percent).toBeTypeOf('number');
  });
});
