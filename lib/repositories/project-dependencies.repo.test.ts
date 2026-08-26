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
  insertProjectDependency,
  listProjectDependencies,
} from './project-dependencies.repo';

describe.skipIf(!hasTestDb)('project-dependencies.repo', () => {
  let fromProjectId: number;
  let toProjectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    fromProjectId = await seedProject('Dependency From');
    toProjectId = await seedProject('Dependency To');
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('insertProjectDependency persists required fields', async () => {
    const row = await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'FINISH_TO_START',
      needBy: '2026-12-31',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      notes: 'blocked on infra',
      createdBy: 1,
    });
    expect(row).toMatchObject({
      from_project_id: fromProjectId,
      to_project_id: toProjectId,
      dependency_type: 'FINISH_TO_START',
      effective_to: null,
      notes: 'blocked on infra',
    });
    expect(row?.need_by).toBeTruthy();
    expect(row?.effective_from).toBeTruthy();
  });

  it('listProjectDependencies returns outgoing on from and incoming on to', async () => {
    const created = await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'BLOCKS',
      needBy: '2026-06-30',
      effectiveFrom: '2026-02-01',
      createdBy: 1,
    });

    const fromList = await listProjectDependencies(fromProjectId);
    const outgoing = fromList.find((r) => r.id === created!.id);
    expect(outgoing?.direction).toBe('outgoing');

    const toList = await listProjectDependencies(toProjectId);
    const incoming = toList.find((r) => r.id === created!.id);
    expect(incoming?.direction).toBe('incoming');
  });
});
