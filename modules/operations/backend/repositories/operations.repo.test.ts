import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { createOperationsSystem, listOperationsSystems } from './operations.repo';

describe.skipIf(!hasTestDb)('operations.repo', () => {
  let companyA: number;
  let systemA: number;
  let systemB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Operations Scope A');
    const companyB = await seedCompany('Operations Scope B');
    systemA = Number((await createOperationsSystem(companyA, { name: 'Operations A' }) as { id: number }).id);
    systemB = Number((await createOperationsSystem(companyB, { name: 'Operations B' }) as { id: number }).id);
  });

  it('limits non-admins to their company systems', async () => {
    const rows = await listOperationsSystems(companyA, false) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(systemA);
    expect(rows.map(row => row.id)).not.toContain(systemB);
  });

  it('lets admins see systems from both companies', async () => {
    const rows = await listOperationsSystems(companyA, true) as { id: number }[];
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([systemA, systemB]));
  });
});
