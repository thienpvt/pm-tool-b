import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  insertProjectDependencyRepo,
  listProjectDependenciesRepo,
  hasOverlappingEquivalentDependencyRepo,
  getDependencyInFromProjectRepo,
  softEndDependencyRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  insertProjectDependencyRepo: vi.fn(),
  listProjectDependenciesRepo: vi.fn(),
  hasOverlappingEquivalentDependencyRepo: vi.fn(),
  getDependencyInFromProjectRepo: vi.fn(),
  softEndDependencyRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/project-dependencies.repo', () => ({
  insertProjectDependency: insertProjectDependencyRepo,
  listProjectDependencies: listProjectDependenciesRepo,
  hasOverlappingEquivalentDependency: hasOverlappingEquivalentDependencyRepo,
  getDependencyInFromProject: getDependencyInFromProjectRepo,
  softEndDependency: softEndDependencyRepo,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import {
  createProjectDependency,
  listProjectDependenciesForProject,
} from './project-dependencies.service';
import type { AccessActor } from './access';

const pmActor: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['pm'],
  status: 'active',
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};

const dependencyRow = {
  id: 11,
  from_project_id: 7,
  to_project_id: 9,
  dependency_type: 'FINISH_TO_START' as const,
  need_by: '2026-12-31',
  effective_from: '2026-01-01',
  effective_to: null,
  notes: null,
  created_by: 2,
  created_at: '2026-08-26T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
  assertProjectWriteAccess.mockResolvedValue(undefined);
  hasOverlappingEquivalentDependencyRepo.mockResolvedValue(false);
  auditLogFn.mockResolvedValue(undefined);
});

describe('createProjectDependency', () => {
  it('requires write on from and access on to, then auditLogs create', async () => {
    insertProjectDependencyRepo.mockResolvedValue(dependencyRow);
    await expect(
      createProjectDependency(7, pmActor, {
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
    ).resolves.toEqual(dependencyRow);

    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, pmActor);
    expect(assertProjectAccess).toHaveBeenCalledWith(9, pmActor);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'project_dependency',
        action: 'create',
        entity_id: '11',
      }),
    );
  });
});

describe('listProjectDependenciesForProject', () => {
  it('maps direction and peer_project_id for outgoing and incoming', async () => {
    listProjectDependenciesRepo.mockResolvedValue([
      { ...dependencyRow, direction: 'outgoing' as const },
      {
        ...dependencyRow,
        id: 12,
        from_project_id: 9,
        to_project_id: 7,
        direction: 'incoming' as const,
      },
    ]);

    const rows = await listProjectDependenciesForProject(7, pmActor);
    expect(rows).toEqual([
      expect.objectContaining({ direction: 'outgoing', peer_project_id: 9 }),
      expect.objectContaining({ direction: 'incoming', peer_project_id: 9 }),
    ]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, pmActor);
  });
});
