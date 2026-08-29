import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';
import { migrateFiscalBudget } from '@/lib/db-fiscal-budget';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import {
  insertBudgetAdjustment,
  listBudgetAdjustments,
  sumAdjustmentsVnd,
} from './budget-adjustments.repo';

describe.skipIf(!hasTestDb)('budget-adjustments.repo', () => {
  let projectId: number;
  let fiscalBudgetId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('Budget Adjustments Suite');
    const { rows } = await testPool().query(
      `INSERT INTO project_fiscal_budgets (project_id, fiscal_year, cost_type, approved_amount_vnd)
       VALUES ($1, 2026, 'CAPEX', 1000000) RETURNING id`,
      [projectId],
    );
    fiscalBudgetId = rows[0].id as number;
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listBudgetAdjustments(fiscalBudgetId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('insertBudgetAdjustment then listBudgetAdjustments returns the row', async () => {
    const row = await insertBudgetAdjustment(fiscalBudgetId, {
      amount_vnd: 50_000,
      effective_date: '2026-03-01',
      reason: 'Scope increase',
      created_by: 1,
    });
    expect(row).toMatchObject({
      fiscal_budget_id: fiscalBudgetId,
      reason: 'Scope increase',
    });
    expect(Number(row.amount_vnd)).toBe(50_000);
    const listed = await listBudgetAdjustments(fiscalBudgetId);
    expect(listed.some((r) => r.id === row.id)).toBe(true);
  });

  it('sumAdjustmentsVnd aggregates inserted amounts', async () => {
    await insertBudgetAdjustment(fiscalBudgetId, {
      amount_vnd: 25_000,
      effective_date: '2026-04-01',
      reason: 'Extra license',
      created_by: 1,
    });
    const total = await sumAdjustmentsVnd(fiscalBudgetId);
    expect(total).toBeGreaterThanOrEqual(75_000);
  });
});
