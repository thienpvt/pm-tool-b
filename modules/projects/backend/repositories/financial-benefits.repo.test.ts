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
  insertFinancialBenefit,
  listFinancialBenefits,
  listFinancialBenefitsForYear,
} from './financial-benefits.repo';

describe.skipIf(!hasTestDb)('financial-benefits.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('Financial Benefits Suite');
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listFinancialBenefits(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('stores actual_vnd as SQL NULL when omitted', async () => {
    const row = await insertFinancialBenefit(projectId, {
      fiscal_year: 2026,
      benefit_type: 'COST_SAVING',
      expected_vnd: 500_000,
    });
    expect(row.actual_vnd).toBeNull();
    const listed = await listFinancialBenefits(projectId);
    const hit = listed.find((r) => r.id === row.id);
    expect(hit?.actual_vnd).toBeNull();
  });

  it('stores actual_vnd as SQL NULL when explicitly null', async () => {
    const row = await insertFinancialBenefit(projectId, {
      fiscal_year: 2026,
      benefit_type: 'REVENUE',
      expected_vnd: 100_000,
      actual_vnd: null,
    });
    expect(row.actual_vnd).toBeNull();
  });

  it('stores actual_vnd as 0 when zero is passed (distinct from null)', async () => {
    const row = await insertFinancialBenefit(projectId, {
      fiscal_year: 2026,
      benefit_type: 'PRODUCTIVITY',
      expected_vnd: 200_000,
      actual_vnd: 0,
    });
    expect(row.actual_vnd).toBe(0);
    const byYear = await listFinancialBenefitsForYear(projectId, 2026);
    const hit = byYear.find((r) => r.id === row.id);
    expect(hit?.actual_vnd).toBe(0);
  });

  it('rejects duplicate (project_id, fiscal_year, benefit_type)', async () => {
    await insertFinancialBenefit(projectId, {
      fiscal_year: 2025,
      benefit_type: 'COST_SAVING',
      expected_vnd: 10_000,
    });
    await expect(
      insertFinancialBenefit(projectId, {
        fiscal_year: 2025,
        benefit_type: 'COST_SAVING',
        expected_vnd: 20_000,
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
