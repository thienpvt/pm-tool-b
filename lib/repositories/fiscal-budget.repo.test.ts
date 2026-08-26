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
});
