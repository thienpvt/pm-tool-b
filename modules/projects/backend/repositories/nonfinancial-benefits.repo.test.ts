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
  insertNonfinancialBenefit,
  listNonfinancialBenefits,
  updateNonfinancialBenefit,
} from './nonfinancial-benefits.repo';

describe.skipIf(!hasTestDb)('nonfinancial-benefits.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('Nonfinancial Benefits Suite');
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('persists group_name, measure, target with optional actual_text null', async () => {
    const row = await insertNonfinancialBenefit(projectId, {
      group_name: 'Customer',
      measure: 'NPS',
      target: '>= 80',
    });
    expect(row).toMatchObject({
      group_name: 'Customer',
      measure: 'NPS',
      target: '>= 80',
      actual_text: null,
    });
    const listed = await listNonfinancialBenefits(projectId);
    expect(listed.some((r) => r.id === row!.id)).toBe(true);
  });

  it('stores actual_text when provided and does not coerce to numeric zero', async () => {
    const row = await insertNonfinancialBenefit(projectId, {
      group_name: 'Ops',
      measure: 'Uptime',
      target: '99.9%',
      actual_text: 'Achieved 99.95%',
    });
    expect(row?.actual_text).toBe('Achieved 99.95%');
    expect(row?.actual_text).not.toBe(0);
  });

  it('updateNonfinancialBenefit patches actual_text including explicit null', async () => {
    const created = await insertNonfinancialBenefit(projectId, {
      group_name: 'Quality',
      measure: 'Defects',
      target: '< 5',
      actual_text: '3 defects',
    });
    const cleared = await updateNonfinancialBenefit(projectId, created!.id, { actual_text: null });
    expect(cleared?.actual_text).toBeNull();
  });
});
