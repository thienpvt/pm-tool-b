import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { insertDocumentCatalog } from './document-catalog.repo';
import { insertDocumentTemplate, listEffectiveTemplates } from './document-templates.repo';

describe.skipIf(!hasTestDb)('document-templates.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`doc-templates-${Date.now()}`);
  });

  it('insertDocumentTemplate then listEffectiveTemplates includes the template_url (D-05)', async () => {
    const catalog = await insertDocumentCatalog({
      company_id: companyId,
      name: `Catalog ${Date.now()}`,
      purpose: 'Template parent',
      stage: 'ALL',
      mandatory: false,
      active: true,
    });
    const templateUrl = `https://example.com/template-${Date.now()}`;
    await insertDocumentTemplate({
      catalog_id: catalog.id,
      company_id: companyId,
      name: 'Template A',
      document_type: 'doc',
      version: 1,
      effective_date: '2020-01-01',
      guidance: 'Use this template',
      template_url: templateUrl,
    });
    const effective = await listEffectiveTemplates(companyId, catalog.id);
    expect(effective).toHaveLength(1);
    expect(effective[0].template_url).toBe(templateUrl);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listEffectiveTemplates(companyId);
    expect(getKysely).toHaveBeenCalled();
  });
});
