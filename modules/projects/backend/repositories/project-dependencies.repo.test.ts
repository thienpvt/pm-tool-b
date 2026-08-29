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
  hasOverlappingEquivalentDependency,
  insertProjectDependency,
  listOpenProjectDependencies,
  listProjectDependencies,
  softEndDependency,
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

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listProjectDependencies(fromProjectId);
    expect(getKysely).toHaveBeenCalled();
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

  it('hasOverlappingEquivalentDependency detects window intersection not only CURRENT_DATE active', async () => {
    await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'START_TO_START',
      needBy: '2027-06-30',
      effectiveFrom: '2027-01-01',
      effectiveTo: '2027-12-31',
      createdBy: 1,
    });

    const overlapsFuture = await hasOverlappingEquivalentDependency(
      fromProjectId,
      toProjectId,
      'START_TO_START',
      '2027-06-01',
      '2027-09-30',
    );
    expect(overlapsFuture).toBe(true);

    const noOverlap = await hasOverlappingEquivalentDependency(
      fromProjectId,
      toProjectId,
      'START_TO_START',
      '2028-01-01',
      '2028-06-30',
    );
    expect(noOverlap).toBe(false);
  });

  it('softEndDependency sets effective_to on open row only', async () => {
    const created = await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'FINISH_TO_FINISH',
      needBy: '2026-09-30',
      effectiveFrom: '2026-01-01',
      createdBy: 1,
    });

    const ended = await softEndDependency(fromProjectId, created!.id, '2026-08-26');
    expect(ended?.effective_to).toBeTruthy();

    const secondEnd = await softEndDependency(fromProjectId, created!.id);
    expect(secondEnd).toBeUndefined();
  });

  it('listOpenProjectDependencies omits ended rows', async () => {
    const open = await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'START_TO_FINISH',
      needBy: '2026-12-31',
      effectiveFrom: '2020-01-01',
      createdBy: 1,
    });
    const closed = await insertProjectDependency({
      fromProjectId,
      toProjectId,
      dependencyType: 'START_TO_FINISH',
      needBy: '2025-12-31',
      effectiveFrom: '2020-01-01',
      createdBy: 1,
    });
    await softEndDependency(fromProjectId, closed!.id, '2025-06-01');

    const openRows = await listOpenProjectDependencies(fromProjectId);
    const openIds = openRows.map((r) => r.id);
    expect(openIds).toContain(open!.id);
    expect(openIds).not.toContain(closed!.id);
  });

  it('exports listOpenProjectDependencies as a named export for Phase 16', () => {
    expect(typeof listOpenProjectDependencies).toBe('function');
  });
});
