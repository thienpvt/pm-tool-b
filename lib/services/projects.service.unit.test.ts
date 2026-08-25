import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  getProjectRepo,
  updateProjectRepo,
  deleteProjectRepo,
  listProjectsRepo,
  createProjectRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  deleteProjectRepo: vi.fn(),
  listProjectsRepo: vi.fn(),
  createProjectRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
  listProjects: listProjectsRepo,
  createProject: createProjectRepo,
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('projects.service', () => {
  describe('getProject', () => {
    it('asserts access before reading', async () => {
      getProjectRepo.mockResolvedValue({ id: 7, name: 'Acme' });
      await expect(getProject(7, owner)).resolves.toEqual({ id: 7, name: 'Acme' });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(getProjectRepo).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundError when the repository returns undefined', async () => {
      getProjectRepo.mockResolvedValue(undefined);
      await expect(getProject(7, owner)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(getProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(getProjectRepo).not.toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('asserts access before updating', async () => {
      updateProjectRepo.mockResolvedValue({ id: 7, name: 'Renamed' });
      await expect(updateProject(7, owner, { name: 'Renamed' })).resolves.toEqual({
        id: 7,
        name: 'Renamed',
      });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { name: 'Renamed' });
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateProject(7, foreign, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('propagates UnknownColumnError from the repository untouched (REPO-03/T-04-25)', async () => {
      updateProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(updateProject(7, owner, { company_id: 99 })).rejects.toBeInstanceOf(
        UnknownColumnError,
      );
    });
  });

  describe('deleteProject', () => {
    it('asserts access before deleting', async () => {
      deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await expect(deleteProject(7, owner)).resolves.toEqual({ lastInsertRowid: 0, changes: 1 });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(deleteProjectRepo).toHaveBeenCalledWith(7);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteProjectRepo).not.toHaveBeenCalled();
    });
  });

  describe('listProjects', () => {
    it('scopes to the actor company for a non-admin', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listProjects(owner)).resolves.toEqual([{ id: 1 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(owner.company_id, false);
    });

    it('bypasses the company scope for an admin', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const admin = { company_id: 9, is_admin: 1 };
      await expect(listProjects(admin)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(admin.company_id, true);
    });
  });

  describe('createProject', () => {
    it('places the project in the session company for a non-admin, ignoring body.company_id', async () => {
      createProjectRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: owner.company_id });
      await createProject(owner, { name: 'Alpha', company_id: 999 });
      expect(createProjectRepo).toHaveBeenCalledWith(owner.company_id, { name: 'Alpha', company_id: 999 });
    });

    it('honors body.company_id for an admin', async () => {
      const admin = { company_id: 9, is_admin: 1 };
      createProjectRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: 42 });
      await createProject(admin, { name: 'Alpha', company_id: 42 });
      expect(createProjectRepo).toHaveBeenCalledWith(42, { name: 'Alpha', company_id: 42 });
    });

    it('places an admin-created project in null company when body.company_id is absent', async () => {
      const admin = { company_id: 9, is_admin: 1 };
      createProjectRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: null });
      await createProject(admin, { name: 'Alpha' });
      expect(createProjectRepo).toHaveBeenCalledWith(null, { name: 'Alpha' });
    });

    it('propagates UnknownColumnError from the repository untouched', async () => {
      createProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(createProject(owner, { name: 'Alpha' })).rejects.toBeInstanceOf(UnknownColumnError);
    });
  });
});
