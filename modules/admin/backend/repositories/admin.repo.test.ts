import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { listCompaniesWithUserCounts } from './admin.repo';

describe.skipIf(!hasTestDb)('admin.repo', () => {
  let companyA: number;
  let companyB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Admin Scope A');
    companyB = await seedCompany('Admin Scope B');
  });

  it('limits non-admins to their own company', async () => {
    const rows = await listCompaniesWithUserCounts(companyA, false) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(companyA);
    expect(rows.map(row => row.id)).not.toContain(companyB);
  });

  it('lets admins see both companies', async () => {
    const rows = await listCompaniesWithUserCounts(companyA, true) as { id: number }[];
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([companyA, companyB]));
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listCompaniesWithUserCounts(companyA, true);
    expect(getKysely).toHaveBeenCalled();
  });
});
