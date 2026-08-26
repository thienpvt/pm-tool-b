import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables, testDb } from '@/test/repo-db';
import { migrateDashboards } from '@/lib/db-dashboards';
import { runInTransactionOnPool } from '@/lib/db-tx';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn: (client: import('pg').PoolClient) => Promise<unknown>) =>
    runInTransactionOnPool(testPool(), fn),
}));

import { getDashboardFilters } from './dashboard-filter-state.repo';

describe.skipIf(!hasTestDb)('dashboard-filter-state.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateDashboards(testPool());
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('returns empty filters when no row exists (D-07)', async () => {
    const result = await getDashboardFilters(999_999, 'portfolio');
    expect(result).toEqual({ filters: {}, updated_at: null });
  });
});
