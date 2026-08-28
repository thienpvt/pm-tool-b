import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listMilestonesRepo,
  createMilestoneRepo,
  updateMilestoneRepo,
  cancelMilestoneRepo,
  getMilestoneRepo,
  listEpicsRepo,
  linkEpicRepo,
  unlinkEpicRepo,
  auditLog,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listMilestonesRepo: vi.fn(),
  createMilestoneRepo: vi.fn(),
  updateMilestoneRepo: vi.fn(),
  cancelMilestoneRepo: vi.fn(),
  getMilestoneRepo: vi.fn(),
  listEpicsRepo: vi.fn(),
  linkEpicRepo: vi.fn(),
  unlinkEpicRepo: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog }));
vi.mock('@/modules/projects/backend/repositories/milestones.repo', () => ({
  listMilestones: listMilestonesRepo,
  createMilestone: createMilestoneRepo,
  updateMilestone: updateMilestoneRepo,
  cancelMilestone: cancelMilestoneRepo,
  getMilestone: getMilestoneRepo,
  listEpics: listEpicsRepo,
  linkEpic: linkEpicRepo,
  unlinkEpic: unlinkEpicRepo,
}));

import {
  cancelMilestone,
  createMilestone,
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
  assertProjectWriteAccess.mockResolvedValue(undefined);
  auditLog.mockResolvedValue(undefined);
});

const owner = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'],
  status: 'active' as const,
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};
const foreign = {
  company_id: 9 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['viewer'],
  status: 'active' as const,
  user_id: 3,
  username: 'bob',
  display_name: 'Bob',
  email: 'bob@example.com',
};

describe('milestones.service', () => {
  it('listMilestones does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listMilestones(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listMilestonesRepo).not.toHaveBeenCalled();
  });

  it('createMilestone does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(createMilestone(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(createMilestoneRepo).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('createMilestone asserts write access before inserting', async () => {
    createMilestoneRepo.mockResolvedValue({ id: 1 });
    await expect(createMilestone(7, owner, { name: 'M1' })).resolves.toEqual({ id: 1 });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(createMilestoneRepo).toHaveBeenCalledWith(7, { name: 'M1' });
  });

  it('createMilestone calls auditLog action create on success (D-02, D-03)', async () => {
    createMilestoneRepo.mockResolvedValue({
      id: 1,
      name: 'M1',
      status: 'planned',
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      plan_end: '2026-06-30',
    });
    await createMilestone(7, owner, { name: 'M1', start_date: '2026-01-01', end_date: '2026-06-30' });
    expect(auditLog).toHaveBeenCalledWith({
      actor_id: owner.user_id,
      company_id: owner.company_id,
      entity_type: 'milestone',
      entity_id: '1',
      action: 'create',
      before: null,
      after: {
        id: 1,
        name: 'M1',
        status: 'planned',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        plan_end: '2026-06-30',
      },
    });
  });

  it('updateMilestone calls auditLog action update on success (D-02)', async () => {
    getMilestoneRepo.mockResolvedValue({
      id: 3,
      name: 'Before',
      status: 'planned',
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      plan_end: '2026-06-30',
    });
    updateMilestoneRepo.mockResolvedValue({
      id: 3,
      name: 'Renamed',
      status: 'planned',
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      plan_end: '2026-06-30',
    });
    await updateMilestone(7, owner, 3, { name: 'Renamed' });
    expect(getMilestoneRepo).toHaveBeenCalledWith(7, 3);
    expect(auditLog).toHaveBeenCalledWith({
      actor_id: owner.user_id,
      company_id: owner.company_id,
      entity_type: 'milestone',
      entity_id: '3',
      action: 'update',
      before: {
        id: 3,
        name: 'Before',
        status: 'planned',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        plan_end: '2026-06-30',
      },
      after: {
        id: 3,
        name: 'Renamed',
        status: 'planned',
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        plan_end: '2026-06-30',
      },
    });
  });

  it('updateMilestone throws NotFoundError when milestone is outside the parent project', async () => {
    updateMilestoneRepo.mockResolvedValue(undefined);
    await expect(updateMilestone(7, owner, 99, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('updateMilestone does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateMilestone(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateMilestoneRepo).not.toHaveBeenCalled();
  });

  describe('cancelMilestone', () => {
    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(cancelMilestone(7, foreign, 1)).rejects.toBeInstanceOf(ForbiddenError);
      expect(cancelMilestoneRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when milestone is missing or cross-project', async () => {
      getMilestoneRepo.mockResolvedValue(undefined);
      cancelMilestoneRepo.mockResolvedValue(undefined);
      await expect(cancelMilestone(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('sets status cancelled, writes auditLog action cancel, and does not delete the row', async () => {
      getMilestoneRepo.mockResolvedValue({ id: 3, status: 'planned' });
      cancelMilestoneRepo.mockResolvedValue({
        id: 3,
        status: 'cancelled',
        cancelled_by: owner.user_id,
      });

      await expect(cancelMilestone(7, owner, 3)).resolves.toMatchObject({
        id: 3,
        status: 'cancelled',
      });

      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(getMilestoneRepo).toHaveBeenCalledWith(7, 3);
      expect(cancelMilestoneRepo).toHaveBeenCalledWith(7, 3, owner.user_id);
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'milestone',
        entity_id: '3',
        action: 'cancel',
        before: { status: 'planned' },
        after: { status: 'cancelled' },
      });
    });
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

  it('linkEpic does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(linkEpic(7, foreign, 3, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(linkEpicRepo).not.toHaveBeenCalled();
  });

  it('linkEpic asserts write access before linking', async () => {
    linkEpicRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
    await expect(linkEpic(7, owner, 3, 10)).resolves.toEqual({ ok: true });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(linkEpicRepo).toHaveBeenCalledWith(3, 10);
  });

  it('unlinkEpic does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(unlinkEpic(7, foreign, 3, 10)).rejects.toBeInstanceOf(ForbiddenError);
    expect(unlinkEpicRepo).not.toHaveBeenCalled();
  });

  it('unlinkEpic asserts write access before unlinking', async () => {
    unlinkEpicRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
    await expect(unlinkEpic(7, owner, 3, 10)).resolves.toEqual({ ok: true });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(unlinkEpicRepo).toHaveBeenCalledWith(3, 10);
  });
});
