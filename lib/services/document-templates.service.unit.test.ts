import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  getDocumentCatalog,
  retireCurrentTemplate,
  insertDocumentTemplate,
  getDocumentTemplate,
  listEffectiveTemplatesRepo,
  retireTemplateById,
  auditLog,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  getDocumentCatalog: vi.fn(),
  retireCurrentTemplate: vi.fn(),
  insertDocumentTemplate: vi.fn(),
  getDocumentTemplate: vi.fn(),
  listEffectiveTemplatesRepo: vi.fn(),
  retireTemplateById: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('./access', () => ({
  assertCompanyWrite,
  hasRole: (actor: { roles: string[] }, role: string) => actor.roles.includes(role),
}));

vi.mock('@/lib/repositories/document-catalog.repo', () => ({
  getDocumentCatalog,
}));

vi.mock('@/lib/repositories/document-templates.repo', () => ({
  retireCurrentTemplate,
  insertDocumentTemplate,
  getDocumentTemplate,
  listEffectiveTemplates: listEffectiveTemplatesRepo,
  retireTemplateById,
}));

vi.mock('./audit.service', () => ({ auditLog }));

import {
  createTemplateVersion,
  getTemplate,
  listEffectiveTemplates,
  retireTemplate,
} from './document-templates.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => vi.clearAllMocks());

const cpmo = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['cpmo'] as const,
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@acme.com',
  status: 'active' as const,
};

const pm = { ...cpmo, roles: ['pm'] as const, user_id: 2 };
const viewer = { ...cpmo, roles: ['viewer'] as const, user_id: 3 };

describe('createTemplateVersion (D-05, D-14)', () => {
  beforeEach(() => {
    assertCompanyWrite.mockImplementation(() => undefined);
    getDocumentCatalog.mockResolvedValue({ id: 1, company_id: 5, name: 'Charter' });
    retireCurrentTemplate.mockResolvedValue(undefined);
    auditLog.mockResolvedValue(undefined);
  });

  it('inserts version N+1 and retires previous current row', async () => {
    insertDocumentTemplate.mockResolvedValue({
      id: 20,
      catalog_id: 1,
      company_id: 5,
      version: 2,
      template_url: 'https://conf.example.com/t',
      retired_at: null,
    });

    const row = await createTemplateVersion(cpmo, {
      catalog_id: 1,
      name: 'Charter v2',
      document_type: 'charter',
      effective_date: '2026-01-01',
      guidance: 'Use this',
      template_url: 'https://conf.example.com/t',
    });

    expect(retireCurrentTemplate).toHaveBeenCalledWith(1, 5);
    expect(insertDocumentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ catalog_id: 1, company_id: 5, version: expect.any(Number) }),
    );
    expect(row.version).toBe(2);
  });

  it('calls auditLog with version_insert action (D-14)', async () => {
    insertDocumentTemplate.mockResolvedValue({
      id: 21,
      catalog_id: 1,
      company_id: 5,
      version: 1,
      template_url: 'https://conf.example.com/t',
      retired_at: null,
    });

    await createTemplateVersion(cpmo, {
      catalog_id: 1,
      name: 'Charter',
      document_type: 'charter',
      effective_date: '2026-01-01',
      template_url: 'https://conf.example.com/t',
    });

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_template',
        action: 'version_insert',
      }),
    );
  });

  it('throws NotFoundError when catalog missing or wrong company', async () => {
    getDocumentCatalog.mockResolvedValue(undefined);
    await expect(
      createTemplateVersion(cpmo, {
        catalog_id: 99,
        name: 'X',
        document_type: 'x',
        effective_date: '2026-01-01',
        template_url: 'https://conf.example.com/t',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    getDocumentCatalog.mockResolvedValue({ id: 1, company_id: 9 });
    await expect(
      createTemplateVersion(cpmo, {
        catalog_id: 1,
        name: 'X',
        document_type: 'x',
        effective_date: '2026-01-01',
        template_url: 'https://conf.example.com/t',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ForbiddenError when assertCompanyWrite fails (D-12)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });
    await expect(
      createTemplateVersion(cpmo, {
        catalog_id: 1,
        name: 'X',
        document_type: 'x',
        effective_date: '2026-01-01',
        template_url: 'https://conf.example.com/t',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertDocumentTemplate).not.toHaveBeenCalled();
  });
});

describe('listEffectiveTemplates (D-05)', () => {
  it('returns effective templates for PM', async () => {
    listEffectiveTemplatesRepo.mockResolvedValue([
      { id: 10, catalog_id: 1, version: 2, retired_at: null, effective_date: '2026-01-01' },
    ]);
    await expect(listEffectiveTemplates(pm)).resolves.toHaveLength(1);
    expect(listEffectiveTemplatesRepo).toHaveBeenCalledWith(5, undefined);
  });

  it('throws ForbiddenError for viewer-only actor (D-12)', async () => {
    await expect(listEffectiveTemplates(viewer)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listEffectiveTemplatesRepo).not.toHaveBeenCalled();
  });
});

describe('getTemplate (D-05 history)', () => {
  it('returns retired row by id', async () => {
    getDocumentTemplate.mockResolvedValue({
      id: 5,
      catalog_id: 1,
      company_id: 5,
      version: 1,
      retired_at: '2026-06-01T00:00:00Z',
    });
    const row = await getTemplate(cpmo, 5);
    expect(row.retired_at).toBeTruthy();
  });

  it('throws ForbiddenError on company mismatch', async () => {
    getDocumentTemplate.mockResolvedValue({ id: 5, company_id: 9 });
    await expect(getTemplate(cpmo, 5)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('retireTemplate (D-05, D-14)', () => {
  beforeEach(() => {
    assertCompanyWrite.mockImplementation(() => undefined);
    auditLog.mockResolvedValue(undefined);
  });

  it('sets retired_at on current version and auditLogs retire', async () => {
    getDocumentTemplate.mockResolvedValue({
      id: 10,
      catalog_id: 1,
      company_id: 5,
      retired_at: null,
    });
    retireTemplateById.mockResolvedValue({
      id: 10,
      catalog_id: 1,
      company_id: 5,
      retired_at: '2026-08-26T00:00:00Z',
    });

    const row = await retireTemplate(cpmo, 10);
    expect(row.retired_at).toBeTruthy();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retire', entity_type: 'document_template' }),
    );
  });
});
