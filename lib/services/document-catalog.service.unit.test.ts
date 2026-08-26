import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  insertDocumentCatalog,
  listDocumentCatalogRepo,
  getDocumentCatalog,
  updateDocumentCatalogRepo,
  auditLog,
  listProjects,
  insertChecklistRowIfMissing,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  insertDocumentCatalog: vi.fn(),
  listDocumentCatalogRepo: vi.fn(),
  getDocumentCatalog: vi.fn(),
  updateDocumentCatalogRepo: vi.fn(),
  auditLog: vi.fn(),
  listProjects: vi.fn(),
  insertChecklistRowIfMissing: vi.fn(),
}));

vi.mock('./access', () => ({
  assertCompanyWrite,
  hasRole: (actor: { roles: string[] }, role: string) => actor.roles.includes(role),
}));

vi.mock('@/lib/repositories/document-catalog.repo', () => ({
  insertDocumentCatalog,
  listDocumentCatalog: listDocumentCatalogRepo,
  getDocumentCatalog,
  updateDocumentCatalog: updateDocumentCatalogRepo,
}));

vi.mock('./audit.service', () => ({ auditLog }));

vi.mock('@/lib/repositories/projects.repo', () => ({ listProjects }));

vi.mock('@/lib/repositories/project-document-checklist.repo', () => ({
  insertChecklistRowIfMissing,
}));

import {
  createDocumentCatalogItem,
  listDocumentCatalog,
} from './document-catalog.service';
import { ForbiddenError } from './errors';

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

const pm = {
  ...cpmo,
  roles: ['pm'] as const,
  user_id: 2,
};

const viewer = {
  ...cpmo,
  roles: ['viewer'] as const,
  user_id: 3,
};

describe('document-catalog.service D-01 isolation', () => {
  it('does not import the legacy diary service or repo', () => {
    const src = readFileSync(resolve(__dirname, 'document-catalog.service.ts'), 'utf8');
    expect(src).not.toMatch(/documents\.service/);
    expect(src).not.toMatch(/documents\.repo/);
  });
});

describe('createDocumentCatalogItem', () => {
  it('calls assertCompanyWrite before insert and stamps company_id (D-02, D-12)', async () => {
    const callOrder: string[] = [];
    assertCompanyWrite.mockImplementation(() => {
      callOrder.push('assertCompanyWrite');
    });
    insertDocumentCatalog.mockImplementation(async () => {
      callOrder.push('insert');
      return {
        id: 10,
        company_id: 5,
        name: 'Charter',
        purpose: 'Kickoff',
        stage: 'L2',
        mandatory: true,
        active: true,
      };
    });
    auditLog.mockResolvedValue(undefined);

    const row = await createDocumentCatalogItem(cpmo, {
      name: 'Charter',
      purpose: 'Kickoff',
      stage: 'L2',
      mandatory: true,
    });

    expect(callOrder).toEqual(['assertCompanyWrite', 'insert']);
    expect(insertDocumentCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5, name: 'Charter', stage: 'L2' }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_catalog',
        action: 'create',
        company_id: 5,
      }),
    );
    expect(row.id).toBe(10);
  });

  it('throws ForbiddenError without inserting when assertCompanyWrite fails (D-12)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(
      createDocumentCatalogItem(cpmo, { name: 'Charter', stage: 'L2' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertDocumentCatalog).not.toHaveBeenCalled();
  });
});

describe('listDocumentCatalog', () => {
  it('returns company catalog for PM (D-12)', async () => {
    listDocumentCatalogRepo.mockResolvedValue([{ id: 1, name: 'Charter' }]);
    await expect(listDocumentCatalog(pm)).resolves.toEqual([{ id: 1, name: 'Charter' }]);
    expect(listDocumentCatalogRepo).toHaveBeenCalledWith(5);
  });

  it('throws ForbiddenError for viewer-only actor (D-12)', async () => {
    await expect(listDocumentCatalog(viewer)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listDocumentCatalogRepo).not.toHaveBeenCalled();
  });
});
