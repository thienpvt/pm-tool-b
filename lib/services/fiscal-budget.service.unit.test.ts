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
  insertBudgetAdjustmentRepo,
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
  insertBudgetAdjustmentRepo: vi.fn(),
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
  insertBudgetAdjustment: insertBudgetAdjustmentRepo,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import {
  addBudgetAdjustment,
  createFiscalBudget,
  getFiscalBudgetOverview,
  patchFiscalBudgetActual,
} from './fiscal-budget.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';
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
    expect(src).not.toMatch(/@\/lib\/repositories\/budget\.repo/);
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

  it('addBudgetAdjustment INSERTs signed amount then auditLog budget_adjustment create', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue({
      id: 5,
      approved_amount_vnd: '1000',
      actual_amount_vnd: '0',
    });
    insertBudgetAdjustmentRepo.mockResolvedValue({
      id: 11,
      fiscal_budget_id: 5,
      amount_vnd: '200',
    });
    await expect(
      addBudgetAdjustment(7, 5, owner, {
        amount_vnd: 200,
        effective_date: '2026-03-01',
        reason: 'Approved increase',
      }),
    ).resolves.toMatchObject({ id: 11 });
    expect(insertBudgetAdjustmentRepo).toHaveBeenCalled();
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'budget_adjustment', action: 'create' }),
    );
  });

  it('addBudgetAdjustment rejects amount 0', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue({ id: 5 });
    await expect(
      addBudgetAdjustment(7, 5, owner, {
        amount_vnd: 0,
        effective_date: '2026-03-01',
        reason: 'bad',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('addBudgetAdjustment rejects empty reason', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue({ id: 5 });
    await expect(
      addBudgetAdjustment(7, 5, owner, {
        amount_vnd: 100,
        effective_date: '2026-03-01',
        reason: '   ',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('addBudgetAdjustment rejects invalid effective_date', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue({ id: 5 });
    await expect(
      addBudgetAdjustment(7, 5, owner, {
        amount_vnd: 100,
        effective_date: 'not-a-date',
        reason: 'Approved increase',
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', field: 'effective_date' });
    expect(insertBudgetAdjustmentRepo).not.toHaveBeenCalled();
  });

  it('addBudgetAdjustment 404s unknown budgetId in project', async () => {
    getFiscalBudgetInProjectRepo.mockResolvedValue(undefined);
    await expect(
      addBudgetAdjustment(7, 99, owner, {
        amount_vnd: 100,
        effective_date: '2026-03-01',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('GET metrics approved_net includes adjustment sum', async () => {
    listFiscalBudgetsRepo.mockResolvedValue([
      {
        id: 6,
        fiscal_year: 2026,
        cost_type: 'CAPEX',
        approved_amount_vnd: '1000',
        actual_amount_vnd: '100',
      },
    ]);
    sumAdjustmentsVndRepo.mockResolvedValue(200);
    const rows = await getFiscalBudgetOverview(7, owner);
    expect(rows[0].metrics.approved_net_vnd).toBe(1200);
    expect(rows[0].metrics.remaining_vnd).toBe(1100);
  });
});
