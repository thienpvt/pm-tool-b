import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getProgramRepo,
  listProgramProjects,
  updateProgramRepo,
  deleteProgramRepo,
  listProgramsRepo,
  projectCountsByProgram,
  createProgramRepo,
} = vi.hoisted(() => ({
  getProgramRepo: vi.fn(),
  listProgramProjects: vi.fn(),
  updateProgramRepo: vi.fn(),
  deleteProgramRepo: vi.fn(),
  listProgramsRepo: vi.fn(),
  projectCountsByProgram: vi.fn(),
  createProgramRepo: vi.fn(),
}));

vi.mock('@/modules/portfolio/backend/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  listProgramProjects,
  updateProgram: updateProgramRepo,
  deleteProgram: deleteProgramRepo,
  listPrograms: listProgramsRepo,
  projectCountsByProgram,
  createProgram: createProgramRepo,
}));

import {
  assertProgramAccess,
  createProgram,
  deleteProgram,
  getProgramDetail,
  listProgramsWithCounts,
  updateProgram,
} from './programs.service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const pm = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 1,
  username: 'pm',
  display_name: 'PM',
  email: 'pm@example.com',
  status: 'active' as const,
};
const cpmoCompany5 = {
  company_id: 5 as number | null,
  is_admin: 1 as number | boolean,
  roles: ['cpmo'] as const,
  user_id: 2,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@example.com',
  status: 'active' as const,
};
const cpmoCompany5Leftover = {
  ...cpmoCompany5,
  is_admin: 1 as number | boolean,
};
const foreign = {
  company_id: 9 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 3,
  username: 'foreign',
  display_name: 'Foreign',
  email: 'foreign@example.com',
  status: 'active' as const,
};
const viewer = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['viewer'] as const,
  user_id: 4,
  username: 'viewer',
  display_name: 'Viewer',
  email: 'viewer@example.com',
  status: 'active' as const,
};

describe('programs.service', () => {
  it('getProgramDetail returns program + projects for owner', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    listProgramProjects.mockResolvedValue([{ id: 1 }]);
    await expect(getProgramDetail(3, cpmoCompany5)).resolves.toEqual({
      program: { id: 3, company_id: 5, name: 'Acme' },
      projects: [{ id: 1 }],
    });
  });

  it('getProgramDetail throws ForbiddenError for cross-company actor', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    await expect(getProgramDetail(3, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listProgramProjects).not.toHaveBeenCalled();
  });

  it('getProgramDetail throws NotFoundError when missing', async () => {
    getProgramRepo.mockResolvedValue(undefined);
    await expect(getProgramDetail(99, cpmoCompany5)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('assertProgramAccess throws ForbiddenError for CPMO company 5 vs program company 9 (D-13)', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 9, name: 'Other Co' });
    await expect(assertProgramAccess(3, cpmoCompany5Leftover)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assertProgramAccess allows CPMO company 5 vs program company 5 (D-13)', async () => {
    const row = { id: 3, company_id: 5, name: 'Acme' };
    getProgramRepo.mockResolvedValue(row);
    await expect(assertProgramAccess(3, cpmoCompany5Leftover)).resolves.toEqual(row);
  });

  it('updateProgram denies PM via assertCompanyWrite (D-15)', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(updateProgram(3, pm, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateProgramRepo).not.toHaveBeenCalled();
  });

  it('updateProgram does not mutate when access is denied cross-company', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(updateProgram(3, foreign, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateProgramRepo).not.toHaveBeenCalled();
  });

  it('deleteProgram denies PM via assertCompanyWrite', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(deleteProgram(3, pm)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteProgramRepo).not.toHaveBeenCalled();
  });

  it('deleteProgram does not delete when access is denied cross-company', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(deleteProgram(3, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteProgramRepo).not.toHaveBeenCalled();
  });

  describe('listProgramsWithCounts', () => {
    it('merges project_count onto each program, scoped to the actor company', async () => {
      listProgramsRepo.mockResolvedValue([{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]);
      projectCountsByProgram.mockResolvedValue([{ customer_id: 1, count: 3 }]);

      await expect(listProgramsWithCounts(cpmoCompany5Leftover)).resolves.toEqual([
        { id: 1, name: 'Alpha', project_count: 3 },
        { id: 2, name: 'Beta', project_count: 0 },
      ]);
      expect(listProgramsRepo).toHaveBeenCalledWith(5);
      expect(projectCountsByProgram).toHaveBeenCalledWith(5);
    });
  });

  describe('createProgram', () => {
    it('stamps actor.company_id and ignores body.company_id (D-13)', async () => {
      createProgramRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: 5 });
      await createProgram(cpmoCompany5, { name: 'Alpha', company_id: 999 });
      expect(createProgramRepo).toHaveBeenCalledWith(5, { name: 'Alpha', company_id: 999 });
    });

    it('throws ForbiddenError for PM (D-15)', async () => {
      await expect(createProgram(pm, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for Viewer (D-15)', async () => {
      await expect(createProgram(viewer, { name: 'Alpha' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('rejects a blank name with ValidationError("Name required")', async () => {
      await expect(createProgram(cpmoCompany5, { name: '' })).rejects.toBeInstanceOf(ValidationError);
      await expect(createProgram(cpmoCompany5, { name: '' })).rejects.toMatchObject({ message: 'Name required' });
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only name', async () => {
      await expect(createProgram(cpmoCompany5, { name: '   ' })).rejects.toBeInstanceOf(ValidationError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('rejects an absent name', async () => {
      await expect(createProgram(cpmoCompany5, {})).rejects.toBeInstanceOf(ValidationError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });
  });
});
