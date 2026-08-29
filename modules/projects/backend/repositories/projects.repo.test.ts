import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
}));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import {
  PROJECT_COLUMNS,
  deleteProject,
  getProject,
  projectAccessRow,
  updateProject,
} from './projects.repo';

describe.skipIf(!hasTestDb)('projects.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Projects Repo', { company_id: 3 });
  });

  afterAll(async () => {
    const { closeTestPool } = await import('@/test/db');
    await closeTestPool();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await getProject(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('reads a project by id', async () => {
    const row = (await getProject(projectId)) as { id: number; name: string };
    expect(row.id).toBe(projectId);
    expect(row.name).toBe('Projects Repo');
  });

  it('writes an allowlisted column and returns the updated row', async () => {
    const row = (await updateProject(projectId, { status: 'On Hold' })) as { status: string };
    expect(row.status).toBe('On Hold');
  });

  it('rejects company_id and leaves the row unchanged', async () => {
    await expect(updateProject(projectId, { company_id: 99 })).rejects.toThrow(UnknownColumnError);

    const after = await testDb().get<{ company_id: number }>(
      'SELECT company_id FROM projects WHERE id = ?',
      projectId,
    );
    expect(after?.company_id).toBe(3);
  });

  it('names every unknown column, not just the first', async () => {
    await expect(updateProject(projectId, { company_id: 1, customer_id: 2 })).rejects.toMatchObject({
      columns: ['company_id', 'customer_id'],
    });
  });

  it('excludes tenancy columns from the allowlist', () => {
    expect(PROJECT_COLUMNS).not.toContain('company_id');
    expect(PROJECT_COLUMNS).not.toContain('customer_id');
    expect(PROJECT_COLUMNS).not.toContain('id');
  });

  it('exposes tenancy columns for an access check without inspecting a session', async () => {
    const row = await projectAccessRow(projectId);
    expect(row).toMatchObject({ company_id: 3 });
  });

  it('deletes a project', async () => {
    const throwaway = await seedProject('Delete Me');
    const res = await deleteProject(throwaway);
    expect(res.changes).toBe(1);
    expect(await getProject(throwaway)).toBeUndefined();
  });
});
