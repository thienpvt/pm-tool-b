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

vi.mock('@/lib/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  listProgramProjects,
  updateProgram: updateProgramRepo,
  deleteProgram: deleteProgramRepo,
  listPrograms: listProgramsRepo,
  projectCountsByProgram,
  createProgram: createProgramRepo,
}));

import {
  createProgram,
  deleteProgram,
  getProgramDetail,
  listProgramsWithCounts,
  updateProgram,
} from './programs.service';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: 9 as number | null, is_admin: 1 as number | boolean };

describe('programs.service', () => {
  it('getProgramDetail returns program + projects for owner', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    listProgramProjects.mockResolvedValue([{ id: 1 }]);
    await expect(getProgramDetail(3, owner)).resolves.toEqual({
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
    await expect(getProgramDetail(99, owner)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('admin bypasses company check', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    listProgramProjects.mockResolvedValue([]);
    await expect(getProgramDetail(3, admin)).resolves.toEqual({
      program: { id: 3, company_id: 5, name: 'Acme' },
      projects: [],
    });
  });

  it('updateProgram does not mutate when access is denied', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(updateProgram(3, foreign, { name: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateProgramRepo).not.toHaveBeenCalled();
  });

  it('deleteProgram does not delete when access is denied', async () => {
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5 });
    await expect(deleteProgram(3, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteProgramRepo).not.toHaveBeenCalled();
  });

  describe('listProgramsWithCounts', () => {
    it('merges project_count onto each program, scoped to the actor company', async () => {
      listProgramsRepo.mockResolvedValue([{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]);
      projectCountsByProgram.mockResolvedValue([{ customer_id: 1, count: 3 }]);

      await expect(listProgramsWithCounts(owner)).resolves.toEqual([
        { id: 1, name: 'Alpha', project_count: 3 },
        { id: 2, name: 'Beta', project_count: 0 },
      ]);
      expect(listProgramsRepo).toHaveBeenCalledWith(owner.company_id, false);
      expect(projectCountsByProgram).toHaveBeenCalledWith(owner.company_id, false);
    });

    it('bypasses the company scope for an admin', async () => {
      listProgramsRepo.mockResolvedValue([]);
      projectCountsByProgram.mockResolvedValue([]);
      await listProgramsWithCounts(admin);
      expect(listProgramsRepo).toHaveBeenCalledWith(admin.company_id, true);
      expect(projectCountsByProgram).toHaveBeenCalledWith(admin.company_id, true);
    });
  });

  describe('createProgram', () => {
    it('places the program in the session company for a non-admin, ignoring body.company_id', async () => {
      createProgramRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: owner.company_id });
      await createProgram(owner, { name: 'Alpha', company_id: 999 });
      expect(createProgramRepo).toHaveBeenCalledWith(owner.company_id, { name: 'Alpha', company_id: 999 });
    });

    it('honors body.company_id for an admin', async () => {
      createProgramRepo.mockResolvedValue({ id: 1, name: 'Alpha', company_id: 42 });
      await createProgram(admin, { name: 'Alpha', company_id: 42 });
      expect(createProgramRepo).toHaveBeenCalledWith(42, { name: 'Alpha', company_id: 42 });
    });

    it('rejects a blank name with ValidationError("Name required")', async () => {
      await expect(createProgram(owner, { name: '' })).rejects.toBeInstanceOf(ValidationError);
      await expect(createProgram(owner, { name: '' })).rejects.toMatchObject({ message: 'Name required' });
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only name', async () => {
      await expect(createProgram(owner, { name: '   ' })).rejects.toBeInstanceOf(ValidationError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });

    it('rejects an absent name', async () => {
      await expect(createProgram(owner, {})).rejects.toBeInstanceOf(ValidationError);
      expect(createProgramRepo).not.toHaveBeenCalled();
    });
  });
});
