import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { listPortfolioProjects } from '@/modules/portfolio/backend/repositories/portfolio.repo';

describe.skipIf(!hasTestDb)('portfolio.repo', () => {
  let companyA: number;
  let projectA: number;
  let projectB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Portfolio Scope A');
    const companyB = await seedCompany('Portfolio Scope B');
    projectA = await seedProject('Portfolio Project A', { company_id: companyA });
    projectB = await seedProject('Portfolio Project B', { company_id: companyB });
  });

  it('limits callers to their company projects', async () => {
    const rows = await listPortfolioProjects(companyA) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(projectA);
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });

  it('does not return other-company projects when scoped to company A (D-13)', async () => {
    const rows = await listPortfolioProjects(companyA) as { id: number }[];
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listPortfolioProjects(companyA);
    expect(getKysely).toHaveBeenCalled();
  });
});
