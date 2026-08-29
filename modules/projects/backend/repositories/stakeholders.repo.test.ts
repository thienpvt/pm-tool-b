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

import { insertStakeholder, listStakeholders } from './stakeholders.repo';

describe.skipIf(!hasTestDb)('stakeholders.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('Stakeholders Suite');
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listStakeholders(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('listStakeholders returns an inserted sponsor row', async () => {
    const inserted = await insertStakeholder(projectId, {
      stakeholder_role: 'sponsor',
      external_name: 'Jane Sponsor',
      external_email: 'jane@example.com',
    });
    expect(inserted).toMatchObject({
      project_id: projectId,
      stakeholder_role: 'sponsor',
      external_name: 'Jane Sponsor',
      effective_to: null,
    });
    const listed = await listStakeholders(projectId);
    expect(listed.some((r) => r.id === inserted!.id)).toBe(true);
  });
});
