import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  insertFiscalBudgetRepo,
  listFiscalBudgetsRepo,
  findFiscalBudgetByKeyRepo,
  getFiscalBudgetInProjectRepo,
  updateFiscalBudgetActualRepo,
  sumAdjustmentsVndRepo,
  listBudgetAdjustmentsRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  insertFiscalBudgetRepo: vi.fn(),
  listFiscalBudgetsRepo: vi.fn(),
  findFiscalBudgetByKeyRepo: vi.fn(),
  getFiscalBudgetInProjectRepo: vi.fn(),
  updateFiscalBudgetActualRepo: vi.fn(),
  sumAdjustmentsVndRepo: vi.fn(),
  listBudgetAdjustmentsRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/fiscal-budget.repo', () => ({
  insertFiscalBudget: insertFiscalBudgetRepo,
  listFiscalBudgets: listFiscalBudgetsRepo,
  findFiscalBudgetByKey: findFiscalBudgetByKeyRepo,
  getFiscalBudgetInProject: getFiscalBudgetInProjectRepo,
  updateFiscalBudgetActual: updateFiscalBudgetActualRepo,
}));
vi.mock('@/lib/repositories/budget-adjustments.repo', () => ({
  sumAdjustmentsVnd: sumAdjustmentsVndRepo,
  listBudgetAdjustments: listBudgetAdjustmentsRepo,
  insertBudgetAdjustment: vi.fn(),
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import {
  createFiscalBudget,
  getFiscalBudgetOverview,
  patchFiscalBudgetActual,
} from './fiscal-budget.service';
import { ConflictError, ForbiddenError } from './errors';
import type { AccessActor } from './access';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  sumAdjustmentsVndRepo.mockResolvedValue(0);
  listBudgetAdjustmentsRepo.mockResolvedValue([]);
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

describe('fiscal-budget.service', () => {
  it('does not import the line-item budget repository module (D-01)', () => {
    const src = readFileSync(resolve(__dirname, 'fiscal-budget.service.ts'), 'utf8');
    expect(src).not.toMatch(/budget\.repo/);
  });

  it('createFiscalBudget inserts CAPEX/OPEX row with auditLog', async () => {
    findFiscalBudgetByKeyRepo.mockResolvedValue(undefined);
    insertFiscalBudgetRepo.mockResolvedValue({
      id: 1,
      fiscal_year: 2026,
      cost_type: 'CAPEX',
      approved_amount_vnd: '1000000',
      actual_amount_vnd: '0',
    });
    await expect(
      createFiscalBudget(7, owner, {
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: 1_000_000,
      }),
    ).resolves.toMatchObject({ id: 1, cost_type: 'CAPEX' });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'fiscal_budget', action: 'create' }),
    );
  });

  it('duplicate year+type throws ConflictError', async () => {
    findFiscalBudgetByKeyRepo.mockResolvedValue({ id: 9 });
    await expect(
      createFiscalBudget(7, owner, {
        fiscal_year: 2026,
        cost_type: 'OPEX',
        approved_amount_vnd: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('Viewer assertProjectWriteAccess failure propagates as ForbiddenError', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(
      createFiscalBudget(7, viewer, {
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: 100,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertFiscalBudgetRepo).not.toHaveBeenCalled();
  });

  it('GET overview attaches computed metrics', async () => {
    listFiscalBudgetsRepo.mockResolvedValue([
      {
        id: 2,
        fiscal_year: 2026,
        cost_type: 'OPEX',
        approved_amount_vnd: '100',
        actual_amount_vnd: '150',
      },
    ]);
    const rows = await getFiscalBudgetOverview(7, owner);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(rows[0].metrics.status).toBe('over_budget');
    expect(rows[0].metrics.remaining_vnd).toBe(-50);
  });

  it('PATCH actual_amount_vnd changes spend only with auditLog update', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue({
      id: 3,
      actual_amount_vnd: '10',
    });
    updateFiscalBudgetActualRepo.mockResolvedValue({
      id: 3,
      actual_amount_vnd: '40',
    });
    await expect(
      patchFiscalBudgetActual(7, owner, { id: 3, actual_amount_vnd: 40 }),
    ).resolves.toMatchObject({ actual_amount_vnd: '40' });
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entity_type: 'fiscal_budget' }),
    );
  });
});
