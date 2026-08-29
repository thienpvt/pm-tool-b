import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { listResourceMembers } from './resources.repo';

describe.skipIf(!hasTestDb)('resources.repo', () => {
  let companyId: number;
  let memberId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany('Resources Scope');
    const projectId = await seedProject('Resources Project', { company_id: companyId });
    memberId = Number((await testDb().run(
      'INSERT INTO team_members (project_id, domain, name) VALUES (?, ?, ?)',
      projectId,
      'Engineering',
      'Alex Member',
    )).lastInsertRowid);
  });

  it('returns team members for projects in the caller company', async () => {
    const rows = await listResourceMembers(companyId) as { id: number; name: string }[];
    expect(rows.map((row) => row.id)).toContain(memberId);
    expect(rows.find((row) => row.id === memberId)?.name).toBe('Alex Member');
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listResourceMembers(companyId);
    expect(getKysely).toHaveBeenCalled();
  });
});
