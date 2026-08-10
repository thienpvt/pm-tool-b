import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProgramRepo, listProgramProjects, updateProgramRepo, deleteProgramRepo } = vi.hoisted(
  () => ({
    getProgramRepo: vi.fn(),
    listProgramProjects: vi.fn(),
    updateProgramRepo: vi.fn(),
    deleteProgramRepo: vi.fn(),
  }),
);

vi.mock('@/lib/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  listProgramProjects,
  updateProgram: updateProgramRepo,
  deleteProgram: deleteProgramRepo,
}));

import { deleteProgram, getProgramDetail, updateProgram } from './programs.service';
import { ForbiddenError, NotFoundError } from './errors';

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
});
