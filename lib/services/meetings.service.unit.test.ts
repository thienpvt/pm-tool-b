import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  listMeetingsRepo,
  createMeetingRepo,
  updateMeetingRepo,
  deleteMeetingRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listMeetingsRepo: vi.fn(),
  createMeetingRepo: vi.fn(),
  updateMeetingRepo: vi.fn(),
  deleteMeetingRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/meetings.repo', () => ({
  listMeetings: listMeetingsRepo,
  createMeeting: createMeetingRepo,
  updateMeeting: updateMeetingRepo,
  deleteMeeting: deleteMeetingRepo,
}));

import { createMeeting, deleteMeeting, listMeetings, updateMeeting } from './meetings.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('meetings.service', () => {
  it('listMeetings asserts access before the repository', async () => {
    listMeetingsRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listMeetings(7, owner)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listMeetings does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listMeetings(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listMeetingsRepo).not.toHaveBeenCalled();
  });

  it('createMeeting does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(createMeeting(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(createMeetingRepo).not.toHaveBeenCalled();
  });

  it('updateMeeting throws NotFoundError when no row matches', async () => {
    updateMeetingRepo.mockResolvedValue(undefined);
    await expect(updateMeeting(7, owner, 99, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateMeeting does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateMeeting(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateMeetingRepo).not.toHaveBeenCalled();
  });

  it('deleteMeeting throws NotFoundError on zero changes', async () => {
    deleteMeetingRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
    await expect(deleteMeeting(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deleteMeeting does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(deleteMeeting(7, foreign, 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deleteMeetingRepo).not.toHaveBeenCalled();
  });
});
