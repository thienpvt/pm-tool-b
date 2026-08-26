import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listIssuesRepo,
  createIssueRepo,
  updateIssueRepo,
  findIssueByCode,
  getIssueRepo,
  deactivateIssueRepo,
  auditLog,
  appendDueDateHistory,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listIssuesRepo: vi.fn(),
  createIssueRepo: vi.fn(),
  updateIssueRepo: vi.fn(),
  findIssueByCode: vi.fn(),
  getIssueRepo: vi.fn(),
  deactivateIssueRepo: vi.fn(),
  auditLog: vi.fn(),
  appendDueDateHistory: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/services/audit.service', () => ({ auditLog }));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listIssues: listIssuesRepo,
  createIssue: createIssueRepo,
  updateIssue: updateIssueRepo,
  findIssueByCode,
  getIssue: getIssueRepo,
  deactivateIssue: deactivateIssueRepo,
}));
vi.mock('@/lib/repositories/raid-due-date-history.repo', () => ({
  appendDueDateHistory,
}));

import { createIssue, deactivateIssue, listIssues, updateIssue } from './issues.service';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  findIssueByCode.mockResolvedValue(undefined);
  auditLog.mockResolvedValue(undefined);
  appendDueDateHistory.mockResolvedValue(undefined);
});

const owner = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'],
  status: 'active',
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};
const foreign = {
  company_id: 9 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'],
  status: 'active',
  user_id: 3,
  username: 'bob',
  display_name: 'Bob',
  email: 'bob@example.com',
};

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

  describe('createIssue', () => {
    it('asserts write access before inserting', async () => {
      createIssueRepo.mockResolvedValue({ id: 2, code: 'I-001' });
      await expect(createIssue(7, owner, { description: 'x' })).resolves.toEqual({ id: 2, code: 'I-001' });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(createIssueRepo).toHaveBeenCalledWith(7, { description: 'x' });
    });

    it('throws ConflictError when code duplicates an existing row', async () => {
      findIssueByCode.mockResolvedValue({ id: 5 });
      await expect(createIssue(7, owner, { code: 'I-001' })).rejects.toBeInstanceOf(ConflictError);
      expect(createIssueRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('calls auditLog action create after successful insert (D-02, D-03)', async () => {
      const created = {
        id: 2,
        code: 'I-001',
        description: 'x',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-03-01',
        owner: 'Ava',
      };
      createIssueRepo.mockResolvedValue(created);

      await createIssue(7, owner, { description: 'x' });

      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'issue',
        entity_id: '2',
        action: 'create',
        before: null,
        after: {
          id: 2,
          code: 'I-001',
          description: 'x',
          status: 'Open',
          priority: 'Medium',
          due_date: '2026-03-01',
          owner: 'Ava',
        },
      });
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(createIssue(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(createIssueRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });
  });

  describe('updateIssue', () => {
    it('persists technology_council when provided', async () => {
      updateIssueRepo.mockResolvedValue({ id: 1, technology_council: true });
      await expect(updateIssue(7, owner, 1, { technology_council: true })).resolves.toMatchObject({
        technology_council: true,
      });
    });

    it('throws ConflictError when changing code to a sibling row code', async () => {
      findIssueByCode.mockResolvedValue({ id: 9 });
      await expect(updateIssue(7, owner, 3, { code: 'I-009' })).rejects.toBeInstanceOf(ConflictError);
      expect(updateIssueRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when no row matches', async () => {
      updateIssueRepo.mockResolvedValue(undefined);
      await expect(updateIssue(7, owner, 99, {})).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateIssue(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateIssueRepo).not.toHaveBeenCalled();
    });

    it('appends due-date history and auditLog when due_date changes', async () => {
      getIssueRepo.mockResolvedValue({
        id: 1,
        code: 'I-001',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      });
      updateIssueRepo.mockResolvedValue({
        id: 1,
        code: 'I-001',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-02-01',
        owner: 'Ava',
      });

      await updateIssue(7, owner, 1, { due_date: '2026-02-01' });

      expect(appendDueDateHistory).toHaveBeenCalledWith({
        entity_type: 'issue',
        entity_id: '1',
        old_due: '2026-01-01',
        new_due: '2026-02-01',
        changed_by: owner.user_id,
      });
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'issue',
        entity_id: '1',
        action: 'due_date_change',
        before: { due_date: '2026-01-01' },
        after: { due_date: '2026-02-01' },
      });
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
    });

    it('calls auditLog action update for status-only field changes (D-02)', async () => {
      const prior = {
        id: 1,
        code: 'I-001',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      };
      const updated = { ...prior, status: 'Closed' };
      getIssueRepo.mockResolvedValue(prior);
      updateIssueRepo.mockResolvedValue(updated);

      await updateIssue(7, owner, 1, { status: 'Closed' });

      expect(getIssueRepo).toHaveBeenCalledWith(7, 1);
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'issue',
        entity_id: '1',
        action: 'update',
        before: {
          id: 1,
          code: 'I-001',
          description: 'd',
          status: 'Open',
          priority: 'Medium',
          due_date: '2026-01-01',
          owner: 'Ava',
        },
        after: {
          id: 1,
          code: 'I-001',
          description: 'd',
          status: 'Closed',
          priority: 'Medium',
          due_date: '2026-01-01',
          owner: 'Ava',
        },
      });
    });

    it('does not append due-date history when due_date is unchanged', async () => {
      getIssueRepo.mockResolvedValue({ id: 1, due_date: '2026-01-01' });
      updateIssueRepo.mockResolvedValue({ id: 1, due_date: '2026-01-01' });

      await updateIssue(7, owner, 1, { due_date: '2026-01-01' });

      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'due_date_change' }));
    });

    it('does not append due-date history when due_date is omitted', async () => {
      const prior = {
        id: 1,
        code: 'I-001',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      };
      getIssueRepo.mockResolvedValue(prior);
      updateIssueRepo.mockResolvedValue({ ...prior, status: 'Closed' });

      await updateIssue(7, owner, 1, { status: 'Closed' });

      expect(getIssueRepo).toHaveBeenCalledWith(7, 1);
      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'due_date_change' }));
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
    });

    it('does not append history when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateIssue(7, foreign, 1, { due_date: '2026-02-01' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });
  });

  describe('deactivateIssue', () => {
    it('sets status deactivated and writes auditLog action deactivate', async () => {
      getIssueRepo.mockResolvedValue({ id: 3, status: 'Open' });
      deactivateIssueRepo.mockResolvedValue({ id: 3, status: 'deactivated' });

      await expect(deactivateIssue(7, owner, 3)).resolves.toMatchObject({ status: 'deactivated' });

      expect(deactivateIssueRepo).toHaveBeenCalledWith(7, 3);
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'issue',
        entity_id: '3',
        action: 'deactivate',
        before: { status: 'Open' },
        after: { status: 'deactivated' },
      });
    });

    it('throws NotFoundError on zero changes', async () => {
      getIssueRepo.mockResolvedValue({ id: 99, status: 'Open' });
      deactivateIssueRepo.mockResolvedValue(undefined);
      await expect(deactivateIssue(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deactivateIssue(7, foreign, 1)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deactivateIssueRepo).not.toHaveBeenCalled();
    });
  });
});
