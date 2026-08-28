import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedProject, setupRepoTables, testDb } from '@/test/repo-db';
import { migrateFiscalBudget } from '@/lib/db-fiscal-budget';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

import {
  findFiscalBudgetByKey,
  insertFiscalBudget,
  listFiscalBudgets,
  updateFiscalBudgetActual,
} from './fiscal-budget.repo';
import {
  insertBudgetAdjustment,
  listBudgetAdjustments,
  sumAdjustmentsVnd,
} from './budget-adjustments.repo';

describe.skipIf(!hasTestDb)('fiscal-budget.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('Fiscal Budget Suite');
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('inserts a CAPEX row and lists it scoped to the project', async () => {
    const row = await insertFiscalBudget(projectId, {
      fiscal_year: 2026,
      cost_type: 'CAPEX',
      approved_amount_vnd: 1_000_000,
      actual_amount_vnd: 0,
    }) as { id: number; cost_type: string };
    expect(row.cost_type).toBe('CAPEX');
    const rows = await listFiscalBudgets(projectId) as { id: number }[];
    expect(rows.map((r) => r.id)).toContain(row.id);
  });

  it('rejects duplicate (project_id, fiscal_year, cost_type)', async () => {
    await insertFiscalBudget(projectId, {
      fiscal_year: 2025,
      cost_type: 'OPEX',
      approved_amount_vnd: 500_000,
    });
    await expect(
      insertFiscalBudget(projectId, {
        fiscal_year: 2025,
        cost_type: 'OPEX',
        approved_amount_vnd: 600_000,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('findFiscalBudgetByKey returns the unique row', async () => {
    await insertFiscalBudget(projectId, {
      fiscal_year: 2024,
      cost_type: 'CAPEX',
      approved_amount_vnd: 100,
    });
    const hit = await findFiscalBudgetByKey(projectId, 2024, 'CAPEX');
    expect(hit).toMatchObject({ fiscal_year: 2024, cost_type: 'CAPEX' });
  });

  it('updateFiscalBudgetActual changes actual_amount_vnd only', async () => {
    const created = await insertFiscalBudget(projectId, {
      fiscal_year: 2023,
      cost_type: 'OPEX',
      approved_amount_vnd: 200_000,
      actual_amount_vnd: 0,
    }) as { id: number; approved_amount_vnd: string | number };
    const updated = await updateFiscalBudgetActual(projectId, created.id, 75_000) as {
      approved_amount_vnd: string | number;
      actual_amount_vnd: string | number;
    };
    expect(Number(updated.actual_amount_vnd)).toBe(75_000);
    expect(Number(updated.approved_amount_vnd)).toBe(Number(created.approved_amount_vnd));
  });

  it('insertBudgetAdjustment persists signed non-zero amount and sumAdjustmentsVnd aggregates', async () => {
    const budget = await insertFiscalBudget(projectId, {
      fiscal_year: 2022,
      cost_type: 'CAPEX',
      approved_amount_vnd: 1_000_000,
    }) as { id: number };

    const adj = await insertBudgetAdjustment(budget.id, {
      amount_vnd: 250_000,
      effective_date: '2026-01-15',
      reason: 'Scope increase',
      created_by: 1,
    }) as { amount_vnd: string | number };
    expect(Number(adj.amount_vnd)).toBe(250_000);

    await insertBudgetAdjustment(budget.id, {
      amount_vnd: -50_000,
      effective_date: '2026-02-01',
      reason: 'Descope',
      created_by: 1,
    });

    expect(await sumAdjustmentsVnd(budget.id)).toBe(200_000);
    const listed = await listBudgetAdjustments(budget.id);
    expect(listed).toHaveLength(2);
  });

  it('rejects adjustment amount_vnd of 0', async () => {
    const budget = await insertFiscalBudget(projectId, {
      fiscal_year: 2021,
      cost_type: 'OPEX',
      approved_amount_vnd: 100,
    }) as { id: number };

    await expect(
      insertBudgetAdjustment(budget.id, {
        amount_vnd: 0,
        effective_date: '2026-01-01',
        reason: 'noop',
        created_by: 1,
      }),
    ).rejects.toBeTruthy();
  });
});
