import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  getProjectRepo,
  updateProjectRepo,
  deleteProjectRepo,
  listProjectsRepo,
  createProjectRepo,
  findProjectByCompanyCode,
  getProgram,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  deleteProjectRepo: vi.fn(),
  listProjectsRepo: vi.fn(),
  createProjectRepo: vi.fn(),
  findProjectByCompanyCode: vi.fn(),
  getProgram: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({
  assertProjectAccess,
  assertProjectWriteAccess,
  isCpmo: (actor: { roles?: string[] }) => actor.roles?.includes('cpmo') ?? false,
  hasRole: (actor: { roles?: string[] }, role: string) => actor.roles?.includes(role) ?? false,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
  listProjects: listProjectsRepo,
  createProject: createProjectRepo,
  findProjectByCompanyCode,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({
  getProgram,
}));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { createProject, deleteProject, getProject, listProjects, updateProject } from './projects.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const pmActor = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
  status: 'active' as const,
};
const cpmoActor = {
  ...pmActor,
  roles: ['cpmo'] as const,
  is_admin: 1 as number | boolean,
};
const viewerActor = { ...pmActor, roles: ['viewer'] as const };
const foreign = { ...pmActor, company_id: 9 as number | null };

describe('projects.service', () => {
  describe('getProject', () => {
    it('asserts access before reading', async () => {
      getProjectRepo.mockResolvedValue({ id: 7, name: 'Acme' });
      await expect(getProject(7, pmActor)).resolves.toEqual({ id: 7, name: 'Acme' });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, pmActor);
      expect(getProjectRepo).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundError when the repository returns undefined', async () => {
      getProjectRepo.mockResolvedValue(undefined);
      await expect(getProject(7, pmActor)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(getProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(getProjectRepo).not.toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('asserts write access before updating', async () => {
      updateProjectRepo.mockResolvedValue({ id: 7, name: 'Renamed' });
      await expect(updateProject(7, pmActor, { name: 'Renamed' })).resolves.toEqual({
        id: 7,
        name: 'Renamed',
      });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, pmActor);
      expect(updateProjectRepo).toHaveBeenCalledWith(7, { name: 'Renamed' });
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateProject(7, foreign, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateProjectRepo).not.toHaveBeenCalled();
    });

    it('propagates UnknownColumnError from the repository untouched (REPO-03/T-04-25)', async () => {
      updateProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(updateProject(7, pmActor, { company_id: 99 })).rejects.toBeInstanceOf(
        UnknownColumnError,
      );
    });
  });

  describe('deleteProject', () => {
    it('asserts write access before deleting', async () => {
      deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await expect(deleteProject(7, pmActor)).resolves.toEqual({ lastInsertRowid: 0, changes: 1 });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, pmActor);
      expect(deleteProjectRepo).toHaveBeenCalledWith(7);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteProject(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteProjectRepo).not.toHaveBeenCalled();
    });
  });

  describe('listProjects', () => {
    it('scopes to the actor company for CPMO without global bypass (D-13)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(listProjects(cpmoActor)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(cpmoActor.company_id);
    });

    it('passes D-14 opts for PM-only actors (D-14)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listProjects(pmActor)).resolves.toEqual([{ id: 1 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(pmActor.company_id, {
        pmEmail: pmActor.email,
        pmName: pmActor.display_name,
        username: pmActor.username,
      });
    });

    it('uses company filter only for viewer-only (D-13)', async () => {
      listProjectsRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listProjects(viewerActor)).resolves.toEqual([{ id: 1 }]);
      expect(listProjectsRepo).toHaveBeenCalledWith(viewerActor.company_id);
    });
  });

  describe('createProject', () => {
    it('throws ForbiddenError for PM (D-13, D-15)', async () => {
      await expect(createProject(pmActor, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for viewer-only (D-15)', async () => {
      await expect(createProject(viewerActor, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('stamps actor.company_id for CPMO, ignoring body.company_id (D-13)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: cpmoActor.company_id });
      await createProject(cpmoActor, {
        name: 'Alpha',
        company_id: 999,
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
      expect(createProjectRepo).toHaveBeenCalledWith(cpmoActor.company_id, {
        name: 'Alpha',
        company_id: 999,
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
    });

    it('throws ForbiddenError when CPMO has null company_id', async () => {
      const nullCompanyCpmo = { ...cpmoActor, company_id: null };
      await expect(createProject(nullCompanyCpmo, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('propagates UnknownColumnError from the repository untouched', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-001',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(UnknownColumnError);
    });

    it('throws ValidationError when project_code is missing (PROJ-01, D-01)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', portfolio_year: 2026, customer_id: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ValidationError when portfolio_year is missing (PROJ-01, D-04)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', project_code: 'PRJ-001', customer_id: 1 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ValidationError when customer_id is missing (PROJ-01, D-04)', async () => {
      await expect(
        createProject(cpmoActor, { name: 'Alpha', project_code: 'PRJ-001', portfolio_year: 2026 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('creates project with project_code, portfolio_year, and in-company program (D-03, D-04, PROJ-01)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue(undefined);
      createProjectRepo.mockResolvedValue({
        id: 1,
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
        company_id: cpmoActor.company_id,
      });
      await createProject(cpmoActor, {
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
      expect(getProgram).toHaveBeenCalledWith(10);
      expect(findProjectByCompanyCode).toHaveBeenCalledWith(cpmoActor.company_id, 'PRJ-001');
      expect(createProjectRepo).toHaveBeenCalledWith(cpmoActor.company_id, {
        name: 'Alpha',
        project_code: 'PRJ-001',
        portfolio_year: 2026,
        customer_id: 10,
      });
    });

    it('throws ConflictError for duplicate project_code in same company (D-01, PROJ-01)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: cpmoActor.company_id, name: 'Prog' });
      findProjectByCompanyCode.mockResolvedValue({ id: 99 });
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'prj-001',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when program belongs to another company (D-04)', async () => {
      getProgram.mockResolvedValue({ id: 10, company_id: 99, name: 'Foreign Prog' });
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-002',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when program id does not exist (D-04)', async () => {
      getProgram.mockResolvedValue(undefined);
      await expect(
        createProject(cpmoActor, {
          name: 'Alpha',
          project_code: 'PRJ-003',
          portfolio_year: 2026,
          customer_id: 10,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(createProjectRepo).not.toHaveBeenCalled();
    });
  });
});
