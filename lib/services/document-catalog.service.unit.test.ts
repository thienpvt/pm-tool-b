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
  updateDocumentCatalogItem,
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

describe('createDocumentCatalogItem apply_to_in_flight (D-03)', () => {
  beforeEach(() => {
    assertCompanyWrite.mockImplementation(() => undefined);
    auditLog.mockResolvedValue(undefined);
    insertDocumentCatalog.mockResolvedValue({
      id: 10,
      company_id: 5,
      name: 'Charter',
      purpose: '',
      stage: 'L2',
      mandatory: false,
      active: true,
    });
  });

  it('inserts checklist rows for Active matching projects when apply_to_in_flight true', async () => {
    listProjects.mockResolvedValue([
      { id: 1, status: 'Active', stage: 'L2' },
      { id: 2, status: 'active', stage: 'L2' },
      { id: 3, status: 'Paused', stage: 'L2' },
      { id: 4, status: 'Active', stage: 'L0' },
    ]);
    insertChecklistRowIfMissing.mockResolvedValue(1);

    await createDocumentCatalogItem(cpmo, {
      name: 'Charter',
      stage: 'L2',
      apply_to_in_flight: true,
    });

    expect(insertChecklistRowIfMissing).toHaveBeenCalledTimes(2);
    expect(insertChecklistRowIfMissing).toHaveBeenCalledWith(1, 10);
    expect(insertChecklistRowIfMissing).toHaveBeenCalledWith(2, 10);
  });

  it('matches ALL catalog stage to any Active project stage', async () => {
    listProjects.mockResolvedValue([
      { id: 1, status: 'Active', stage: 'L0' },
      { id: 2, status: 'Active', stage: 'L5' },
    ]);
    insertDocumentCatalog.mockResolvedValue({
      id: 11,
      company_id: 5,
      name: 'Universal',
      purpose: '',
      stage: 'ALL',
      mandatory: false,
      active: true,
    });
    insertChecklistRowIfMissing.mockResolvedValue(1);

    await createDocumentCatalogItem(cpmo, {
      name: 'Universal',
      stage: 'ALL',
      apply_to_in_flight: true,
    });

    expect(insertChecklistRowIfMissing).toHaveBeenCalledTimes(2);
  });

  it('does not backfill when apply_to_in_flight omitted', async () => {
    await createDocumentCatalogItem(cpmo, { name: 'Charter', stage: 'L2' });
    expect(listProjects).not.toHaveBeenCalled();
    expect(insertChecklistRowIfMissing).not.toHaveBeenCalled();
  });

  it('does not backfill when apply_to_in_flight false', async () => {
    await createDocumentCatalogItem(cpmo, {
      name: 'Charter',
      stage: 'L2',
      apply_to_in_flight: false,
    });
    expect(listProjects).not.toHaveBeenCalled();
    expect(insertChecklistRowIfMissing).not.toHaveBeenCalled();
  });
});

describe('updateDocumentCatalogItem (D-02, D-03)', () => {
  const existing = {
    id: 10,
    company_id: 5,
    name: 'Charter',
    purpose: '',
    stage: 'L2',
    mandatory: false,
    active: true,
    created_at: '',
    updated_at: '',
  };

  beforeEach(() => {
    assertCompanyWrite.mockImplementation(() => undefined);
    auditLog.mockResolvedValue(undefined);
    getDocumentCatalog.mockResolvedValue(existing);
  });

  it('soft-retires via active=false without removing the catalog row', async () => {
    updateDocumentCatalogRepo.mockResolvedValue({ ...existing, active: false });

    const row = await updateDocumentCatalogItem(cpmo, 10, { active: false });

    expect(row.active).toBe(false);
    expect(updateDocumentCatalogRepo).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ active: false }),
    );
  });

  it('apply_to_in_flight true on update inserts missing checklist rows only', async () => {
    updateDocumentCatalogRepo.mockResolvedValue(existing);
    listProjects.mockResolvedValue([{ id: 1, status: 'Active', stage: 'L2' }]);
    insertChecklistRowIfMissing.mockResolvedValue(1);

    await updateDocumentCatalogItem(cpmo, 10, { apply_to_in_flight: true });

    expect(insertChecklistRowIfMissing).toHaveBeenCalledWith(1, 10);
  });
});
