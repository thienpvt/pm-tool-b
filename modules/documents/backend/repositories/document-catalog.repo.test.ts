import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { insertDocumentCatalog, listDocumentCatalog } from './document-catalog.repo';

describe.skipIf(!hasTestDb)('document-catalog.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`doc-catalog-${Date.now()}`);
  });

  it('insertDocumentCatalog then listDocumentCatalog returns the name for that companyId (D-05)', async () => {
    const name = `Safety Plan ${Date.now()}`;
    await insertDocumentCatalog({
      company_id: companyId,
      name,
      purpose: 'Project safety documentation',
      stage: 'ALL',
      mandatory: true,
      active: true,
    });
    const rows = await listDocumentCatalog(companyId);
    expect(rows.some((r) => r.name === name)).toBe(true);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listDocumentCatalog(companyId);
    expect(getKysely).toHaveBeenCalled();
  });
});
