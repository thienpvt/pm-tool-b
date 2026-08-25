import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listIssuesRepo,
  createIssueRepo,
  updateIssueRepo,
  deleteIssueRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listIssuesRepo: vi.fn(),
  createIssueRepo: vi.fn(),
  updateIssueRepo: vi.fn(),
  deleteIssueRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listIssues: listIssuesRepo,
  createIssue: createIssueRepo,
  updateIssue: updateIssueRepo,
  deleteIssue: deleteIssueRepo,
}));

import { createIssue, deleteIssue, listIssues, updateIssue } from './issues.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('issues.service', () => {
  it('listIssues asserts access before the repository', async () => {
    listIssuesRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listIssues(7, owner)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listIssues does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listIssues(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listIssuesRepo).not.toHaveBeenCalled();
  });

  it('createIssue asserts write access before inserting', async () => {
    createIssueRepo.mockResolvedValue({ id: 2 });
    await expect(createIssue(7, owner, { description: 'x' })).resolves.toEqual({ id: 2 });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(createIssueRepo).toHaveBeenCalledWith(7, { description: 'x' });
  });

  it('createIssue does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(createIssue(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(createIssueRepo).not.toHaveBeenCalled();
  });

  it('updateIssue throws NotFoundError when no row matches', async () => {
    updateIssueRepo.mockResolvedValue(undefined);
    await expect(updateIssue(7, owner, 99, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateIssue does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateIssue(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateIssueRepo).not.toHaveBeenCalled();
  });

  it('deleteIssue throws NotFoundError on zero changes', async () => {
    deleteIssueRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
    await expect(deleteIssue(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deleteIssue does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(deleteIssue(7, foreign, 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteIssueRepo).not.toHaveBeenCalled();
  });
});
