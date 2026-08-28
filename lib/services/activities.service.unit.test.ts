import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listActivitiesRepo,
  createActivityRepo,
  updateActivityRepo,
  deleteActivityRepo,
  listJiraKeysRepo,
  listJiraKeyed,
  maxOrderIdx,
  updateImportedActivity,
  insertImportedActivity,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listActivitiesRepo: vi.fn(),
  createActivityRepo: vi.fn(),
  updateActivityRepo: vi.fn(),
  deleteActivityRepo: vi.fn(),
  listJiraKeysRepo: vi.fn(),
  listJiraKeyed: vi.fn(),
  maxOrderIdx: vi.fn(),
  updateImportedActivity: vi.fn(),
  insertImportedActivity: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/activities.repo', () => ({
  listActivities: listActivitiesRepo,
  createActivity: createActivityRepo,
  updateActivity: updateActivityRepo,
  deleteActivity: deleteActivityRepo,
  listJiraKeys: listJiraKeysRepo,
  listJiraKeyed,
  maxOrderIdx,
  updateImportedActivity,
  insertImportedActivity,
}));

import {
  createActivity,
  deleteActivity,
  importActivities,
  listActivities,
  listActivityJiraKeys,
  updateActivity,
} from './activities.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('activities.service', () => {
  describe('listActivities', () => {
    it('asserts access before calling the repository', async () => {
      listActivitiesRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listActivities(7, owner)).resolves.toEqual([{ id: 1 }]);
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(listActivitiesRepo).toHaveBeenCalledWith(7);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(listActivities(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(listActivitiesRepo).not.toHaveBeenCalled();
    });
  });

  describe('createActivity', () => {
    it('asserts write access before inserting', async () => {
      createActivityRepo.mockResolvedValue({ id: 2 });
      await expect(createActivity(7, owner, { activity: 'x' })).resolves.toEqual({ id: 2 });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(createActivityRepo).toHaveBeenCalledWith(7, { activity: 'x' });
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(createActivity(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(createActivityRepo).not.toHaveBeenCalled();
    });
  });

  describe('updateActivity', () => {
    it('throws NotFoundError when the repository returns undefined', async () => {
      updateActivityRepo.mockResolvedValue(undefined);
      await expect(updateActivity(7, owner, 99, { status: 'Done' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateActivity(7, foreign, 3, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateActivityRepo).not.toHaveBeenCalled();
    });
  });

  describe('deleteActivity', () => {
    it('throws NotFoundError when zero rows match', async () => {
      deleteActivityRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
      await expect(deleteActivity(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteActivity(7, foreign, 3)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteActivityRepo).not.toHaveBeenCalled();
    });
  });

  describe('importActivities', () => {
    it('does not call import repos when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(importActivities(7, foreign, [])).rejects.toBeInstanceOf(ForbiddenError);
      expect(listJiraKeyed).not.toHaveBeenCalled();
    });

    it('asserts write access before importing', async () => {
      listJiraKeyed.mockResolvedValue([]);
      maxOrderIdx.mockResolvedValue(0);
      insertImportedActivity.mockResolvedValue(11);

      await importActivities(7, owner, [{ activity: 'epic', jira_key: 'EPIC-1' }]);

      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    });

    it('inserts and updates by jira key', async () => {
      listJiraKeyed.mockResolvedValue([{ id: 10, jira_key: 'EPIC-1' }]);
      maxOrderIdx.mockResolvedValue(3);
      updateImportedActivity.mockResolvedValue({});
      insertImportedActivity.mockResolvedValue(11);

      const result = await importActivities(7, owner, [
        { activity: 'child', jira_key: 'ST-1', parent_jira_key: 'EPIC-1' },
        { activity: 'epic', jira_key: 'EPIC-1' },
      ]);

      expect(result).toEqual({ inserted: 1, updated: 1, errors: [] });
      expect(updateImportedActivity).toHaveBeenCalled();
      expect(insertImportedActivity).toHaveBeenCalled();
    });
  });

  describe('listActivityJiraKeys', () => {
    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(listActivityJiraKeys(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(listJiraKeysRepo).not.toHaveBeenCalled();
    });
  });
});
