import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  listFiscalBudgetsRepo,
  sumAdjustmentsVndRepo,
  listFinancialBenefitsForYearRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listFiscalBudgetsRepo: vi.fn(),
  sumAdjustmentsVndRepo: vi.fn(),
  listFinancialBenefitsForYearRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/modules/portfolio/backend/repositories/fiscal-budget.repo', () => ({
  listFiscalBudgets: listFiscalBudgetsRepo,
}));
vi.mock('@/lib/repositories/budget-adjustments.repo', () => ({
  sumAdjustmentsVnd: sumAdjustmentsVndRepo,
}));
vi.mock('@/lib/repositories/financial-benefits.repo', () => ({
  listFinancialBenefitsForYear: listFinancialBenefitsForYearRepo,
}));

import { getProjectRoi } from './roi.service';
import type { AccessActor } from '@/lib/services/access';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  sumAdjustmentsVndRepo.mockResolvedValue(0);
});

const owner: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['pm'],
  status: 'active',
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};

describe('roi.service', () => {
  it('does not import the line-item budget repository module (D-01)', () => {
    const src = readFileSync(resolve(__dirname, 'roi.service.ts'), 'utf8');
    expect(src).not.toMatch(/@\/lib\/repositories\/budget\.repo/);
  });

  it('sums approved_net and actual spend across all cost types for the year', async () => {
    listFiscalBudgetsRepo.mockResolvedValue([
      { id: 1, fiscal_year: 2026, cost_type: 'CAPEX', approved_amount_vnd: '800', actual_amount_vnd: '300' },
      { id: 2, fiscal_year: 2026, cost_type: 'OPEX', approved_amount_vnd: '200', actual_amount_vnd: '100' },
      { id: 3, fiscal_year: 2025, cost_type: 'CAPEX', approved_amount_vnd: '999', actual_amount_vnd: '0' },
    ]);
    sumAdjustmentsVndRepo.mockImplementation(async (id: number) => (id === 1 ? 100 : 0));
    listFinancialBenefitsForYearRepo.mockResolvedValue([
      { expected_vnd: 1500, actual_vnd: 1200 },
    ]);

    const result = await getProjectRoi(7, owner, 2026);
    expect(result.fiscal_year).toBe(2026);
    // approved_net = (800+100) + 200 = 1100; expected benefits 1500 => ~36.36%
    expect(result.expected).toEqual({ status: 'ok', percent: expect.closeTo(36.363636, 4) });
    // actual spend = 400; actual benefits 1200 => 200%
    expect(result.actual).toEqual({ status: 'ok', percent: 200 });
  });

  it('actual side insufficient when any benefit row has null actual_vnd', async () => {
    listFiscalBudgetsRepo.mockResolvedValue([
      { id: 1, fiscal_year: 2026, cost_type: 'CAPEX', approved_amount_vnd: '1000', actual_amount_vnd: '500' },
    ]);
    listFinancialBenefitsForYearRepo.mockResolvedValue([
      { expected_vnd: 2000, actual_vnd: 1500 },
      { expected_vnd: 500, actual_vnd: null },
    ]);

    const result = await getProjectRoi(7, owner, 2026);
    expect(result.expected.status).toBe('ok');
    expect(result.actual).toEqual({ status: 'insufficient' });
  });

  it('both sides insufficient when no financial benefit rows', async () => {
    listFiscalBudgetsRepo.mockResolvedValue([
      { id: 1, fiscal_year: 2026, cost_type: 'OPEX', approved_amount_vnd: '100', actual_amount_vnd: '50' },
    ]);
    listFinancialBenefitsForYearRepo.mockResolvedValue([]);

    const result = await getProjectRoi(7, owner, 2026);
    expect(result.expected).toEqual({ status: 'insufficient' });
    expect(result.actual).toEqual({ status: 'insufficient' });
  });
});
