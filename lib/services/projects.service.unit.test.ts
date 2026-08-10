import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertProjectAccess, getProjectRepo, updateProjectRepo, deleteProjectRepo } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  deleteProjectRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { deleteProject, getProject, updateProject } from './projects.service';
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
});
