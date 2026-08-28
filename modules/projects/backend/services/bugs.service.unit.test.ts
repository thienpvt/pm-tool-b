import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listBugsRepo,
  listSnapshotDatesRepo,
  replaceSnapshotRepo,
  deleteSnapshotRepo,
  deleteAllBugsRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listBugsRepo: vi.fn(),
  listSnapshotDatesRepo: vi.fn(),
  replaceSnapshotRepo: vi.fn(),
  deleteSnapshotRepo: vi.fn(),
  deleteAllBugsRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/projects/backend/repositories/bugs.repo', () => ({
  listBugs: listBugsRepo,
  listSnapshotDates: listSnapshotDatesRepo,
  replaceSnapshot: replaceSnapshotRepo,
  deleteSnapshot: deleteSnapshotRepo,
  deleteAllBugs: deleteAllBugsRepo,
}));

import { deleteBugs, listBugs, listSnapshotDates, replaceSnapshot } from './bugs.service';
import { ForbiddenError, ValidationError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('bugs.service', () => {
  it('listBugs asserts access before the repository', async () => {
    listBugsRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listBugs(7, owner, null)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listBugs does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listBugs(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listBugsRepo).not.toHaveBeenCalled();
  });

  it('listSnapshotDates does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listSnapshotDates(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listSnapshotDatesRepo).not.toHaveBeenCalled();
  });

  it('replaceSnapshot asserts write access before replacing', async () => {
    replaceSnapshotRepo.mockResolvedValue(2);
    await expect(replaceSnapshot(7, owner, [])).resolves.toEqual(
      expect.objectContaining({ inserted: 2 }),
    );
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(replaceSnapshotRepo).toHaveBeenCalled();
  });

  it('replaceSnapshot rejects non-array bugs', async () => {
    await expect(replaceSnapshot(7, owner, 'nope')).rejects.toBeInstanceOf(ValidationError);
    expect(replaceSnapshotRepo).not.toHaveBeenCalled();
  });

  it('replaceSnapshot does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(replaceSnapshot(7, foreign, [])).rejects.toBeInstanceOf(ForbiddenError);
    expect(replaceSnapshotRepo).not.toHaveBeenCalled();
  });

  it('deleteBugs does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(deleteBugs(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteAllBugsRepo).not.toHaveBeenCalled();
  });
});
