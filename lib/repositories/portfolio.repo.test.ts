import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { listPortfolioProjects } from './portfolio.repo';

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

  it('limits non-admins to their company projects', async () => {
    const rows = await listPortfolioProjects(companyA, false) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(projectA);
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });

  it('lets admins see projects from both companies', async () => {
    const rows = await listPortfolioProjects(companyA, true) as { id: number }[];
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([projectA, projectB]));
  });
});
