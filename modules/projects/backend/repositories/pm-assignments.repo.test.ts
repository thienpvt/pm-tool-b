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
  hasOverlappingPmAssignment,
  insertPmAssignment,
  listPmAssignments,
  softEndPmAssignment,
} from './pm-assignments.repo';

describe.skipIf(!hasTestDb)('pm-assignments.repo', () => {
  let projectId: number;
  let userId: number;

  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
    projectId = await seedProject('PM Assignments Suite');
    const { rows } = await testPool().query(
      `INSERT INTO users (username, password_hash, display_name, email, status)
       VALUES ('pm-test-user', 'hash', 'PM Test User', 'pm@test.example', 'active')
       RETURNING id`,
    );
    userId = rows[0].id as number;
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listPmAssignments(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('listPmAssignments returns an inserted primary assignment', async () => {
    const inserted = await insertPmAssignment(projectId, userId, 'primary');
    expect(inserted).toMatchObject({
      project_id: projectId,
      user_id: userId,
      role: 'primary',
      effective_to: null,
    });
    const listed = await listPmAssignments(projectId);
    expect(listed.some((r) => r.id === inserted!.id)).toBe(true);
  });

  it('hasOverlappingPmAssignment detects active different-role assignment', async () => {
    const otherProject = await seedProject('PM Overlap Other');
    await insertPmAssignment(otherProject, userId, 'collaborator');
    const overlaps = await hasOverlappingPmAssignment(otherProject, userId, 'primary');
    expect(overlaps).toBe(true);
  });

  it('softEndPmAssignment sets effective_to on open row only', async () => {
    const proj = await seedProject('PM Soft End');
    const created = await insertPmAssignment(proj, userId, 'collaborator');
    const ended = await softEndPmAssignment(proj, created!.id, '2026-08-01');
    expect(ended?.effective_to).toBeTruthy();
    const secondEnd = await softEndPmAssignment(proj, created!.id);
    expect(secondEnd).toBeUndefined();
  });
});
