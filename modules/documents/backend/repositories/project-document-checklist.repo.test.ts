import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { insertDocumentCatalog } from './document-catalog.repo';
import {
  insertChecklistRowIfMissing,
  listChecklistByProject,
} from './project-document-checklist.repo';

describe.skipIf(!hasTestDb)('project-document-checklist.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`doc-checklist-${Date.now()}`);
  });

  it('insertChecklistRowIfMissing twice does not duplicate catalog_id for the project (D-05)', async () => {
    const projectId = await seedProject(`proj-${Date.now()}`, { company_id: companyId });
    const catalog = await insertDocumentCatalog({
      company_id: companyId,
      name: `Checklist Item ${Date.now()}`,
      purpose: 'Required doc',
      stage: 'ALL',
      mandatory: true,
      active: true,
    });
    await insertChecklistRowIfMissing(projectId, catalog.id);
    await insertChecklistRowIfMissing(projectId, catalog.id);
    const rows = await listChecklistByProject(projectId);
    const matching = rows.filter((r) => r.catalog_id === catalog.id);
    expect(matching).toHaveLength(1);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    const projectId = await seedProject(`kysely-probe-${Date.now()}`, { company_id: companyId });
    await listChecklistByProject(projectId);
    expect(getKysely).toHaveBeenCalled();
  });
});
