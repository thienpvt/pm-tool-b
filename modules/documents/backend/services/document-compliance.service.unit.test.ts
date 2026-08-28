import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertCompanyWriteFn, listProjectsRepoFn, listChecklistByProjectFn } = vi.hoisted(() => ({
  assertCompanyWriteFn: vi.fn(),
  listProjectsRepoFn: vi.fn(),
  listChecklistByProjectFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({
  assertCompanyWrite: assertCompanyWriteFn,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({
  listProjects: listProjectsRepoFn,
}));
vi.mock('@/modules/documents/backend/repositories/project-document-checklist.repo', () => ({
  listChecklistByProject: listChecklistByProjectFn,
}));

import { ForbiddenError, ValidationError } from '@/lib/services/errors';
import { getDocumentCompliance } from './document-compliance.service';

const cpmoActor = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['cpmo'] as const,
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@acme.com',
  status: 'active' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  assertCompanyWriteFn.mockImplementation(() => {});
});

describe('getDocumentCompliance', () => {
  it('calls assertCompanyWrite before listing (D-12)', async () => {
    assertCompanyWriteFn.mockImplementation(() => {
      throw new ForbiddenError();
    });
    listProjectsRepoFn.mockResolvedValue([{ id: 1 }]);

    await expect(getDocumentCompliance(cpmoActor, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(listProjectsRepoFn).not.toHaveBeenCalled();
  });

  it('throws ValidationError for unknown filter key (D-10)', async () => {
    await expect(getDocumentCompliance(cpmoActor, { foo: 'bar' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(listProjectsRepoFn).not.toHaveBeenCalled();
  });

  it('applies stage/status/rag/program filters via applyDashboardFilters (D-10)', async () => {
    listProjectsRepoFn.mockResolvedValue([
      {
        id: 1,
        project_code: 'PRJ-001',
        name: 'Alpha',
        stage: 'L2',
        status: 'Active',
        rag: 'Green',
        customer_id: 10,
      },
      {
        id: 2,
        project_code: 'PRJ-002',
        name: 'Beta',
        stage: 'L3',
        status: 'Active',
        rag: 'Amber',
        customer_id: 11,
      },
    ]);
    listChecklistByProjectFn.mockResolvedValue([]);

    const result = await getDocumentCompliance(cpmoActor, { stage: 'L2' });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].project_id).toBe(1);
    expect(result.filters).toEqual({ stage: 'L2' });
  });

  it('coerces numeric program filter to number (D-10)', async () => {
    listProjectsRepoFn.mockResolvedValue([
      {
        id: 1,
        project_code: 'PRJ-001',
        name: 'Alpha',
        stage: 'L2',
        status: 'Active',
        rag: 'Green',
        customer_id: 10,
      },
      {
        id: 2,
        project_code: 'PRJ-002',
        name: 'Beta',
        stage: 'L2',
        status: 'Active',
        rag: 'Green',
        customer_id: 11,
      },
    ]);
    listChecklistByProjectFn.mockResolvedValue([]);

    const result = await getDocumentCompliance(cpmoActor, { program: '10' });
    expect(result.filters).toEqual({ program: 10 });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].project_id).toBe(1);
  });

  it('rollup uses mandatory checklist items only (D-08, DOC-05)', async () => {
    listProjectsRepoFn.mockResolvedValue([
      {
        id: 1,
        project_code: 'PRJ-001',
        name: 'Alpha',
        stage: 'L2',
        status: 'Active',
        rag: 'Green',
        customer_id: 10,
      },
    ]);
    listChecklistByProjectFn.mockResolvedValue([
      {
        id: 100,
        catalog_mandatory: true,
        status: 'approved',
      },
      {
        id: 101,
        catalog_mandatory: false,
        status: 'none',
      },
      {
        id: 102,
        catalog_mandatory: true,
        status: 'none',
      },
    ]);

    const result = await getDocumentCompliance(cpmoActor, {});
    expect(result.projects[0].compliance).toBe('not_compliant');
  });
});
