import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  listMilestonesRepo,
  createMilestoneRepo,
  updateMilestoneRepo,
  deleteMilestoneRepo,
  listEpicsRepo,
  linkEpicRepo,
  unlinkEpicRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listMilestonesRepo: vi.fn(),
  createMilestoneRepo: vi.fn(),
  updateMilestoneRepo: vi.fn(),
  deleteMilestoneRepo: vi.fn(),
  listEpicsRepo: vi.fn(),
  linkEpicRepo: vi.fn(),
  unlinkEpicRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/milestones.repo', () => ({
  listMilestones: listMilestonesRepo,
  createMilestone: createMilestoneRepo,
  updateMilestone: updateMilestoneRepo,
  deleteMilestone: deleteMilestoneRepo,
  listEpics: listEpicsRepo,
  linkEpic: linkEpicRepo,
  unlinkEpic: unlinkEpicRepo,
}));

import {
  createMilestone,
  deleteMilestone,
  linkEpic,
  listEpics,
  listMilestones,
  unlinkEpic,
  updateMilestone,
} from './milestones.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('milestones.service', () => {
  it('listMilestones does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listMilestones(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listMilestonesRepo).not.toHaveBeenCalled();
  });

  it('createMilestone does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(createMilestone(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(createMilestoneRepo).not.toHaveBeenCalled();
  });

  it('updateMilestone throws NotFoundError when milestone is outside the parent project', async () => {
    // Scoped update returns undefined when milestone belongs to another project (T-04-13).
    updateMilestoneRepo.mockResolvedValue(undefined);
    await expect(updateMilestone(7, owner, 99, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('updateMilestone does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateMilestone(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateMilestoneRepo).not.toHaveBeenCalled();
  });

  it('deleteMilestone throws NotFoundError on zero changes', async () => {
    deleteMilestoneRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
    await expect(deleteMilestone(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('listEpics asserts parent project access before listing', async () => {
    listEpicsRepo.mockResolvedValue([]);
    await listEpics(7, owner, 3);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(listEpicsRepo).toHaveBeenCalledWith(3);
  });

  it('listEpics does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listEpics(7, foreign, 3)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listEpicsRepo).not.toHaveBeenCalled();
  });

  it('linkEpic does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(linkEpic(7, foreign, 3, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(linkEpicRepo).not.toHaveBeenCalled();
  });

  it('unlinkEpic does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(unlinkEpic(7, foreign, 3, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(unlinkEpicRepo).not.toHaveBeenCalled();
  });
});
