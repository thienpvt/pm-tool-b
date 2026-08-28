import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  insertFinancialBenefitRepo,
  listFinancialBenefitsRepo,
  listNonfinancialBenefitsRepo,
  getFinancialBenefitInProjectRepo,
  updateFinancialBenefitRepo,
  insertNonfinancialBenefitRepo,
  getNonfinancialBenefitInProjectRepo,
  updateNonfinancialBenefitRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  insertFinancialBenefitRepo: vi.fn(),
  listFinancialBenefitsRepo: vi.fn(),
  listNonfinancialBenefitsRepo: vi.fn(),
  getFinancialBenefitInProjectRepo: vi.fn(),
  updateFinancialBenefitRepo: vi.fn(),
  getNonfinancialBenefitInProjectRepo: vi.fn(),
  updateNonfinancialBenefitRepo: vi.fn(),
  insertNonfinancialBenefitRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/financial-benefits.repo', () => ({
  insertFinancialBenefit: insertFinancialBenefitRepo,
  listFinancialBenefits: listFinancialBenefitsRepo,
  getFinancialBenefitInProject: getFinancialBenefitInProjectRepo,
  updateFinancialBenefit: updateFinancialBenefitRepo,
}));
vi.mock('@/lib/repositories/nonfinancial-benefits.repo', () => ({
  listNonfinancialBenefits: listNonfinancialBenefitsRepo,
  getNonfinancialBenefitInProject: getNonfinancialBenefitInProjectRepo,
  updateNonfinancialBenefit: updateNonfinancialBenefitRepo,
  insertNonfinancialBenefit: insertNonfinancialBenefitRepo,
}));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: auditLogFn }));

import { createProjectBenefit, listProjectBenefits, patchProjectBenefit } from './benefits.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';
import type { AccessActor } from './access';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  listFinancialBenefitsRepo.mockResolvedValue([]);
  listNonfinancialBenefitsRepo.mockResolvedValue([]);
  auditLogFn.mockResolvedValue(undefined);
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

const viewer: AccessActor = {
  ...owner,
  roles: ['viewer'],
};

describe('benefits.service', () => {
  it('does not import the line-item budget repository module (D-01)', () => {
    const src = readFileSync(resolve(__dirname, 'benefits.service.ts'), 'utf8');
    expect(src).not.toMatch(/@\/lib\/repositories\/budget\.repo/);
  });

  it('createProjectBenefit financial inserts with auditLog and preserves null actual_vnd', async () => {
    insertFinancialBenefitRepo.mockResolvedValue({
      id: 1,
      project_id: 7,
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: '500000',
      actual_vnd: null,
    });
    const row = await createProjectBenefit(7, owner, {
      kind: 'financial',
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: 500_000,
    });
    expect(row).toMatchObject({ id: 1, actual_vnd: null });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(insertFinancialBenefitRepo).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 500_000,
        actual_vnd: null,
      }),
    );
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'financial_benefit', action: 'create' }),
    );
  });

  it('createProjectBenefit financial passes explicit zero actual_vnd', async () => {
    insertFinancialBenefitRepo.mockResolvedValue({
      id: 2,
      fiscal_year: 2026,
      benefit_type: 'REVENUE',
      expected_vnd: '100',
      actual_vnd: '0',
    });
    await createProjectBenefit(7, owner, {
      kind: 'financial',
      fiscal_year: 2026,
      benefit_type: 'REVENUE',
      expected_vnd: 100,
      actual_vnd: 0,
    });
    expect(insertFinancialBenefitRepo).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ actual_vnd: 0 }),
    );
  });

  it('createProjectBenefit rejects unknown benefit_type', async () => {
    await expect(
      createProjectBenefit(7, owner, {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'INVALID',
        expected_vnd: 100,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('duplicate financial benefit maps 23505 to ConflictError', async () => {
    insertFinancialBenefitRepo.mockRejectedValue({ code: '23505' });
    await expect(
      createProjectBenefit(7, owner, {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('Viewer assertProjectWriteAccess failure propagates as ForbiddenError', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(
      createProjectBenefit(7, viewer, {
        kind: 'financial',
        fiscal_year: 2026,
        benefit_type: 'COST_SAVING',
        expected_vnd: 100,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('listProjectBenefits returns financial and nonfinancial arrays', async () => {
    listFinancialBenefitsRepo.mockResolvedValue([
      { id: 1, benefit_type: 'COST_SAVING', actual_vnd: null },
    ]);
    listNonfinancialBenefitsRepo.mockResolvedValue([]);
    const result = await listProjectBenefits(7, owner);
    expect(result).toEqual({
      financial: [{ id: 1, benefit_type: 'COST_SAVING', actual_vnd: null }],
      nonfinancial: [],
    });
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('createProjectBenefit nonfinancial requires group_name, measure, target', async () => {
    insertNonfinancialBenefitRepo.mockResolvedValue({
      id: 10,
      group_name: 'Customer',
      measure: 'NPS',
      target: '>= 80',
      actual_text: null,
    });
    await createProjectBenefit(7, owner, {
      kind: 'nonfinancial',
      group_name: 'Customer',
      measure: 'NPS',
      target: '>= 80',
    });
    expect(insertNonfinancialBenefitRepo).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        group_name: 'Customer',
        measure: 'NPS',
        target: '>= 80',
      }),
    );
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'nonfinancial_benefit', action: 'create' }),
    );
  });

  it('createProjectBenefit nonfinancial rejects missing target', async () => {
    await expect(
      createProjectBenefit(7, owner, {
        kind: 'nonfinancial',
        group_name: 'Customer',
        measure: 'NPS',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('patchProjectBenefit financial sets actual_vnd to null', async () => {
    getFinancialBenefitInProjectRepo.mockResolvedValue({
      id: 5,
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: 100,
      actual_vnd: 50,
    });
    updateFinancialBenefitRepo.mockResolvedValue({
      id: 5,
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: 100,
      actual_vnd: null,
    });
    const row = await patchProjectBenefit(7, owner, 5, {
      kind: 'financial',
      actual_vnd: null,
    });
    expect(row.actual_vnd).toBeNull();
    expect(updateFinancialBenefitRepo).toHaveBeenCalledWith(7, 5, { actual_vnd: null });
  });

  it('patchProjectBenefit missing row throws NotFoundError', async () => {
    getFinancialBenefitInProjectRepo.mockResolvedValue(undefined);
    await expect(
      patchProjectBenefit(7, owner, 99, { kind: 'financial', actual_vnd: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('patchProjectBenefit nonfinancial updates actual_text', async () => {
    getNonfinancialBenefitInProjectRepo.mockResolvedValue({
      id: 8,
      group_name: 'Ops',
      measure: 'Uptime',
      target: '99%',
      actual_text: null,
    });
    updateNonfinancialBenefitRepo.mockResolvedValue({
      id: 8,
      group_name: 'Ops',
      measure: 'Uptime',
      target: '99%',
      actual_text: 'Met',
    });
    await patchProjectBenefit(7, owner, 8, {
      kind: 'nonfinancial',
      actual_text: 'Met',
    });
    expect(updateNonfinancialBenefitRepo).toHaveBeenCalledWith(7, 8, { actual_text: 'Met' });
  });
});
