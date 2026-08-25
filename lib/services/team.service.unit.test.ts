import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  listTeamRepo,
  createTeamMemberRepo,
  updateTeamMemberRepo,
  deleteTeamMemberRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listTeamRepo: vi.fn(),
  createTeamMemberRepo: vi.fn(),
  updateTeamMemberRepo: vi.fn(),
  deleteTeamMemberRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/team.repo', () => ({
  listTeam: listTeamRepo,
  createTeamMember: createTeamMemberRepo,
  updateTeamMember: updateTeamMemberRepo,
  deleteTeamMember: deleteTeamMemberRepo,
}));

import { createTeamMember, deleteTeamMember, listTeam, updateTeamMember } from './team.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('team.service', () => {
  it('listTeam asserts access before the repository', async () => {
    listTeamRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listTeam(7, owner)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listTeam does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listTeam(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listTeamRepo).not.toHaveBeenCalled();
  });

  it('createTeamMember does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(createTeamMember(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(createTeamMemberRepo).not.toHaveBeenCalled();
  });

  it('updateTeamMember throws NotFoundError when no row matches', async () => {
    updateTeamMemberRepo.mockResolvedValue(undefined);
    await expect(updateTeamMember(7, owner, 99, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateTeamMember does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateTeamMember(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateTeamMemberRepo).not.toHaveBeenCalled();
  });

  it('deleteTeamMember throws NotFoundError on zero changes', async () => {
    deleteTeamMemberRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
    await expect(deleteTeamMember(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deleteTeamMember does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(deleteTeamMember(7, foreign, 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteTeamMemberRepo).not.toHaveBeenCalled();
  });
});
