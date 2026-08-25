import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { createTimelineMapping, listTimelineMappings } from './import-mapping.repo';

describe.skipIf(!hasTestDb)('import-mapping.repo tenant scope', () => {
  let companyA: number;
  let companyB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Mapping Scope A');
    companyB = await seedCompany('Mapping Scope B');
  });

  it('allows the same template name across companies', async () => {
    await expect(createTimelineMapping(companyA, 'Standard', '{}')).resolves.toBeDefined();
    await expect(createTimelineMapping(companyB, 'Standard', '{}')).resolves.toBeDefined();

    const rowsA = await listTimelineMappings(companyA);
    const rowsB = await listTimelineMappings(companyB);
    expect(rowsA.some(r => (r as { name: string }).name === 'Standard')).toBe(true);
    expect(rowsB.some(r => (r as { name: string }).name === 'Standard')).toBe(true);
  });

  it('rejects duplicate name within one company', async () => {
    const unique = `Dup-${Date.now()}`;
    await createTimelineMapping(companyA, unique, '{}');
    await expect(createTimelineMapping(companyA, unique, '{}')).rejects.toThrow();
  });
});
