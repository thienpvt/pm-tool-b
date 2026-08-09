import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { listPrograms } from './programs.repo';

describe.skipIf(!hasTestDb)('programs.repo', () => {
  let companyA: number;
  let programA: number;
  let programB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Programs Scope A');
    const companyB = await seedCompany('Programs Scope B');
    programA = Number((await testDb().run(
      'INSERT INTO customers (name, company_id) VALUES (?, ?)', 'Program A', companyA,
    )).lastInsertRowid);
    programB = Number((await testDb().run(
      'INSERT INTO customers (name, company_id) VALUES (?, ?)', 'Program B', companyB,
    )).lastInsertRowid);
  });

  it('limits non-admins to their company programs', async () => {
    const rows = await listPrograms(companyA, false) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(programA);
    expect(rows.map(row => row.id)).not.toContain(programB);
  });

  it('lets admins see programs from both companies', async () => {
    const rows = await listPrograms(companyA, true) as { id: number }[];
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([programA, programB]));
  });
});
