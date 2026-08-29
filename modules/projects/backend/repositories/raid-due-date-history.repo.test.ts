import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables, testDb, testKysely } from '@/test/repo-db';
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

import { appendDueDateHistory } from './raid-due-date-history.repo';

describe.skipIf(!hasTestDb)('raid-due-date-history.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await appendDueDateHistory({
      entity_type: 'risk',
      entity_id: 'R-KYSELY-CHECK',
      old_due: null,
      new_due: '2026-06-01',
      changed_by: 1,
    });
    expect(getKysely).toHaveBeenCalled();
  });

  it('appendDueDateHistory then select of entity_id returns one row', async () => {
    await appendDueDateHistory({
      entity_type: 'issue',
      entity_id: 'I-001',
      old_due: '2026-01-15',
      new_due: '2026-02-15',
      changed_by: 1,
    });
    const rows = await testKysely()
      .selectFrom('raid_due_date_history')
      .selectAll()
      .where('entity_id', '=', 'I-001')
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity_type: 'issue',
      entity_id: 'I-001',
      old_due: '2026-01-15',
      new_due: '2026-02-15',
      changed_by: 1,
    });
  });
});
